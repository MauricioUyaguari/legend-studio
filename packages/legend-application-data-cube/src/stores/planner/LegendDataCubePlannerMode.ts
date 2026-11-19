/**
 * Copyright (c) 2026-present, Goldman Sachs
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

import { DataCubeFunction } from '@finos/legend-data-cube';
import { matchFunctionName } from '@finos/legend-graph';
import {
  isPlainObject,
  isString,
  type PlainObject,
} from '@finos/legend-shared';

/**
 * What decides how the SQL of a query on a DuckDB-backed source (i.e. a cached source, a local file,
 * a cached Iceberg table) is generated. DataCube runs that SQL itself, on its own DuckDB.
 */
export enum LEGEND_DATA_CUBE_PLANNER_MODE {
  /** The engine server generates every plan. This is the default. */
  ENGINE = 'engine',
  /**
   * The engine server generates every plan and the user sees its result; afterwards, in the background,
   * legend-lite's planner is asked for the same query and the two results are compared (experimental)
   */
  SHADOW = 'shadow',
  /** legend-lite's planner, in the browser, generates the plans it can (experimental) */
  LEGEND_LITE = 'legend-lite',
}

/** The mode two settings stand for; using the planner takes precedence over comparing it. */
export const resolvePlannerMode = (
  isLegendLiteEnabled: boolean,
  isShadowEnabled: boolean,
): LEGEND_DATA_CUBE_PLANNER_MODE =>
  isLegendLiteEnabled
    ? LEGEND_DATA_CUBE_PLANNER_MODE.LEGEND_LITE
    : isShadowEnabled
      ? LEGEND_DATA_CUBE_PLANNER_MODE.SHADOW
      : LEGEND_DATA_CUBE_PLANNER_MODE.ENGINE;

export enum LEGEND_DATA_CUBE_PLANNER {
  ENGINE = 'engine',
  LEGEND_LITE = 'legend-lite',
}

const PROTOCOL_TYPE__FUNCTION = 'func';
const PROTOCOL_TYPE__LAMBDA = 'lambda';

/**
 * Checks if the query has a pivot which is not immediately followed by a cast.
 *
 * TEMPORARY: such a pivot's columns depend on the data, so legend-lite plans it as two statements (the
 * column keys first, then the query), and its answer in the engine's plan format holds no single
 * statement we can run. DataCube runs exactly this query to discover the columns of a pivot; whenever
 * it already knows them, it casts right after the pivot. So these queries stay with the engine.
 * Remove this when legend-lite answers this query with one statement for DuckDB.
 */
export const hasCastlessPivot = (
  value: unknown,
  enclosingFunction?: string | undefined,
): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasCastlessPivot(item, enclosingFunction));
  }
  if (!isPlainObject(value)) {
    return false;
  }
  if (value._type === PROTOCOL_TYPE__FUNCTION && isString(value.function)) {
    if (
      matchFunctionName(value.function, DataCubeFunction.PIVOT) &&
      !(
        enclosingFunction !== undefined &&
        matchFunctionName(enclosingFunction, DataCubeFunction.CAST)
      )
    ) {
      return true;
    }
    return hasCastlessPivot(value.parameters, value.function);
  }
  if (value._type === PROTOCOL_TYPE__LAMBDA) {
    return hasCastlessPivot(value.body, undefined);
  }
  return false;
};

/**
 * Chooses the planner of a query on a DuckDB-backed source.
 *
 * NOTE: this is a fixed rule by the shape of the query, decided before anything is asked. It is not a
 * fallback: a query sent to legend-lite's planner that the planner refuses is NOT retried on the engine.
 */
export const chooseDuckDBPlanner = (
  mode: LEGEND_DATA_CUBE_PLANNER_MODE,
  query: PlainObject,
): LEGEND_DATA_CUBE_PLANNER =>
  mode === LEGEND_DATA_CUBE_PLANNER_MODE.LEGEND_LITE && !hasCastlessPivot(query)
    ? LEGEND_DATA_CUBE_PLANNER.LEGEND_LITE
    : LEGEND_DATA_CUBE_PLANNER.ENGINE;
