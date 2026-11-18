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
import { matchFunctionName, type V1_ExecutionPlan } from '@finos/legend-graph';
import {
  isPlainObject,
  isString,
  type PlainObject,
} from '@finos/legend-shared';
import {
  LegendLitePlannerError,
  type LegendLitePlannerAnswer,
} from './LegendLitePlannerClient.js';

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

export enum LEGEND_LITE_PLANNER_REQUEST_ERROR_KIND {
  /** The planner answered the route with an error status, i.e. it does not plan this query */
  REFUSAL = 'refusal',
}

const GENERATE_PLAN_PATH = '/api/pure/v1/execution/generatePlan';

const PROTOCOL_TYPE__FUNCTION = 'func';
const PROTOCOL_TYPE__LAMBDA = 'lambda';
const PROTOCOL_TYPE__MODEL_DATA = 'data';
const PROTOCOL_TYPE__RUNTIME = 'runtime';
const PROTOCOL_TYPE__CONNECTION = 'connection';
const PROTOCOL_TYPE__CONNECTION_POINTER = 'connectionPointer';
const PROTOCOL_TYPE__RELATIONAL_DATABASE_CONNECTION =
  'RelationalDatabaseConnection';

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

/**
 * Moves each connection embedded in a runtime into an element of its own, which the runtime then
 * points at. The model given is left as is; a new one is returned.
 *
 * TEMPORARY: the model DataCube synthesizes for a DuckDB-backed source embeds its connection in the
 * runtime, and legend-lite does not plan over such a connection; nor does legend-lite read a relational
 * connection without `postProcessorWithParameter`, which we leave out when it is empty.
 * Remove this when legend-lite accepts both.
 */
export const liftEmbeddedConnections = (model: PlainObject): PlainObject => {
  if (
    model._type !== PROTOCOL_TYPE__MODEL_DATA ||
    !Array.isArray(model.elements)
  ) {
    return model;
  }
  const elements = model.elements as unknown[];
  const takenPaths = new Set(
    elements
      .filter(isPlainObject)
      .map((element) => `${String(element.package)}::${String(element.name)}`),
  );
  const liftedConnections: PlainObject[] = [];

  const liftConnection = (
    runtime: PlainObject,
    identifiedConnection: PlainObject,
  ): PlainObject => {
    const connection = identifiedConnection.connection;
    if (
      !isPlainObject(connection) ||
      connection._type === PROTOCOL_TYPE__CONNECTION_POINTER
    ) {
      return identifiedConnection;
    }
    const packagePath = String(runtime.package);
    const baseName = `${String(runtime.name)}__${String(identifiedConnection.id)}`;
    let name = baseName;
    for (let i = 1; takenPaths.has(`${packagePath}::${name}`); i++) {
      name = `${baseName}_${i}`;
    }
    takenPaths.add(`${packagePath}::${name}`);
    liftedConnections.push({
      _type: PROTOCOL_TYPE__CONNECTION,
      name,
      package: packagePath,
      connectionValue:
        connection._type === PROTOCOL_TYPE__RELATIONAL_DATABASE_CONNECTION
          ? {
              ...connection,
              postProcessorWithParameter:
                connection.postProcessorWithParameter ?? [],
            }
          : connection,
    });
    return {
      ...identifiedConnection,
      connection: {
        _type: PROTOCOL_TYPE__CONNECTION_POINTER,
        connection: `${packagePath}::${name}`,
      },
    };
  };

  const liftedElements = elements.map((element) => {
    if (
      !isPlainObject(element) ||
      element._type !== PROTOCOL_TYPE__RUNTIME ||
      !isPlainObject(element.runtimeValue) ||
      !Array.isArray(element.runtimeValue.connections)
    ) {
      return element;
    }
    const runtime = element;
    const runtimeValue = element.runtimeValue;
    return {
      ...runtime,
      runtimeValue: {
        ...runtimeValue,
        connections: (runtimeValue.connections as unknown[]).map(
          (storeConnections) =>
            isPlainObject(storeConnections) &&
            Array.isArray(storeConnections.storeConnections)
              ? {
                  ...storeConnections,
                  storeConnections: (
                    storeConnections.storeConnections as unknown[]
                  ).map((identifiedConnection) =>
                    isPlainObject(identifiedConnection)
                      ? liftConnection(runtime, identifiedConnection)
                      : identifiedConnection,
                  ),
                }
              : storeConnections,
        ),
      },
    };
  });

  return liftedConnections.length
    ? { ...model, elements: [...liftedElements, ...liftedConnections] }
    : model;
};

const extractRefusalMessage = (answer: LegendLitePlannerAnswer): string => {
  try {
    const body = JSON.parse(answer.body) as unknown;
    if (isPlainObject(body) && isString(body.message) && body.message) {
      return body.message;
    }
  } catch {
    // the body is not JSON: it is shown as it is
  }
  return answer.body || `The planner answered with status ${answer.status}`;
};

/**
 * Asks legend-lite's planner for the execution plan of the input the engine's `generatePlan` takes.
 * The answer is in the engine's plan format, to be read the way the engine's answer is.
 *
 * @throws a {@link LegendLitePlannerError} when the planner does not plan the query. NOTE: by design,
 * nothing here falls back to the engine, so that what the planner cannot do is seen rather than hidden.
 */
export const generateExecutionPlanWithLegendLite = async (
  planner: {
    pureV1(
      path: string,
      query: string,
      body: string,
    ): Promise<LegendLitePlannerAnswer>;
  },
  input: PlainObject & { model: PlainObject },
): Promise<PlainObject<V1_ExecutionPlan>> => {
  const answer = await planner.pureV1(
    GENERATE_PLAN_PATH,
    '',
    JSON.stringify({ ...input, model: liftEmbeddedConnections(input.model) }),
  );
  if (answer.status !== 200) {
    throw new LegendLitePlannerError(
      LEGEND_LITE_PLANNER_REQUEST_ERROR_KIND.REFUSAL,
      extractRefusalMessage(answer),
    );
  }
  return JSON.parse(answer.body) as PlainObject<V1_ExecutionPlan>;
};
