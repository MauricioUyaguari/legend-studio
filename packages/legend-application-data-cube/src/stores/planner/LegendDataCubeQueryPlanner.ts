/**
 * Copyright (c) 2020-present, Goldman Sachs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { V1_EngineServerClient, V1_Lambda } from '@finos/legend-graph';
import { IllegalStateError, type PlainObject } from '@finos/legend-shared';

/**
 * The client a query planner generates plans with: an engine server client (or a subclass of one,
 * e.g. one which answers in the browser instead of over the network), which DataCube asks exactly
 * as it asks the engine server, through `generatePlan()`.
 */
export type LegendDataCubeQueryPlannerClient = V1_EngineServerClient & {
  /** Releases what the client holds (e.g. a worker); called when DataCube's engine is disposed */
  dispose?: () => void;
};

/**
 * A planner other than the engine server, for queries on DuckDB-backed sources (i.e. cached sources,
 * local files and cached Iceberg tables): for those, DataCube asks for an execution plan only to take
 * the generated SQL out of it, and runs that SQL itself, on its own DuckDB. So, for those sources, any
 * planner which answers `generatePlan()` with a plan holding DuckDB SQL can take the engine server's
 * place.
 *
 * Contributed by a plugin, see `LegendDataCubeApplicationPlugin.getExtraDuckDBQueryPlanners()`. Each
 * contributed planner adds two settings, both off by default: one to use the planner instead of the
 * engine server, and one to keep using the engine server and compare the planner with it in the
 * background.
 */
export interface LegendDataCubeDuckDBQueryPlanner {
  /** Identifies the planner, in the keys of its settings and in telemetry; unique among planners */
  key: string;
  /** Names the planner to the user, in the titles of its settings and in its error messages */
  label: string;
  /**
   * Creates the client the planner generates plans with. Called at most once, when the planner is
   * first needed, so that nothing of it is loaded unless it is used.
   */
  createEngineServerClient(): LegendDataCubeQueryPlannerClient;
  /**
   * Whether the planner is asked for this query (the protocol JSON of its lambda); a query it is not
   * asked for goes to the engine server, in every mode. When absent, it is asked for every query.
   *
   * NOTE: this must be a fixed rule by the shape of the query, decided before anything is asked. It is
   * not a fallback: a query sent to the planner which the planner fails on is NOT retried on the engine
   * server.
   */
  isQuerySupported?(query: PlainObject<V1_Lambda>): boolean;
}

/** How the SQL of queries on DuckDB-backed sources is generated. */
export enum LEGEND_DATA_CUBE_PLANNER_MODE {
  /** The engine server generates every plan. This is the default. */
  ENGINE = 'engine',
  /**
   * The engine server generates every plan and the user sees its result; afterwards, in the background,
   * the planner is asked for the same query and the two results are compared (experimental)
   */
  SHADOW = 'shadow',
  /** The planner generates the plans it is asked for (experimental) */
  PLANNER = 'planner',
}

export type LegendDataCubePlannerSelection =
  | { mode: LEGEND_DATA_CUBE_PLANNER_MODE.ENGINE }
  | {
      mode:
        | LEGEND_DATA_CUBE_PLANNER_MODE.SHADOW
        | LEGEND_DATA_CUBE_PLANNER_MODE.PLANNER;
      planner: LegendDataCubeDuckDBQueryPlanner;
    };

export const ENGINE_PLANNER_SELECTION: LegendDataCubePlannerSelection = {
  mode: LEGEND_DATA_CUBE_PLANNER_MODE.ENGINE,
};

/** The keys of the two settings of a planner, see `LegendDataCubeDuckDBQueryPlanner`. */
export const getPlannerSettingKeys = (planner: {
  key: string;
}): { use: string; shadow: string } => ({
  use: `debugger.planner.${planner.key}.enabled`,
  shadow: `debugger.planner.${planner.key}.shadow`,
});

/**
 * Checks the planners the plugins contribute: each must have a key of its own, since the key names its
 * settings.
 */
export const validateDuckDBQueryPlanners = (
  planners: LegendDataCubeDuckDBQueryPlanner[],
): LegendDataCubeDuckDBQueryPlanner[] => {
  const keys = new Set<string>();
  planners.forEach((planner) => {
    if (!planner.key) {
      throw new IllegalStateError(
        `Can't register DuckDB query planner '${planner.label}': its key is empty`,
      );
    }
    if (keys.has(planner.key)) {
      throw new IllegalStateError(
        `Can't register DuckDB query planner '${planner.label}': another planner has the key '${planner.key}'`,
      );
    }
    keys.add(planner.key);
  });
  return planners;
};

/**
 * The selection the settings stand for. Using a planner takes precedence over comparing one; among
 * planners, the first (in the order the plugins contribute them) takes precedence. With no planner
 * contributed, every plan is the engine server's, whatever is stored in the settings.
 */
export const resolvePlannerSelection = (
  planners: LegendDataCubeDuckDBQueryPlanner[],
  isEnabled: (settingKey: string) => boolean,
): LegendDataCubePlannerSelection => {
  const used = planners.find((planner) =>
    isEnabled(getPlannerSettingKeys(planner).use),
  );
  if (used) {
    return { mode: LEGEND_DATA_CUBE_PLANNER_MODE.PLANNER, planner: used };
  }
  const shadowed = planners.find((planner) =>
    isEnabled(getPlannerSettingKeys(planner).shadow),
  );
  if (shadowed) {
    return { mode: LEGEND_DATA_CUBE_PLANNER_MODE.SHADOW, planner: shadowed };
  }
  return ENGINE_PLANNER_SELECTION;
};

/**
 * Whether the planner is asked for this query; see `LegendDataCubeDuckDBQueryPlanner.isQuerySupported()`.
 */
export const isQuerySupportedByPlanner = (
  planner: LegendDataCubeDuckDBQueryPlanner,
  query: PlainObject<V1_Lambda>,
): boolean => planner.isQuerySupported?.(query) ?? true;

/**
 * Chooses the planner which generates the plan of a query on a DuckDB-backed source: `undefined` means
 * the engine server.
 */
export const chooseDuckDBQueryPlanner = (
  selection: LegendDataCubePlannerSelection,
  query: PlainObject<V1_Lambda>,
): LegendDataCubeDuckDBQueryPlanner | undefined =>
  selection.mode === LEGEND_DATA_CUBE_PLANNER_MODE.PLANNER &&
  isQuerySupportedByPlanner(selection.planner, query)
    ? selection.planner
    : undefined;
