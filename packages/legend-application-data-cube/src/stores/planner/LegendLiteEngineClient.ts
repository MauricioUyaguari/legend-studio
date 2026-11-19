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

import type { V1_ExecuteInput, V1_ExecutionPlan } from '@finos/legend-graph';
import {
  isPlainObject,
  isString,
  type PlainObject,
} from '@finos/legend-shared';
import {
  LEGEND_LITE_ENGINE_ERROR_KIND,
  LegendLiteEngineError,
  type LegendLiteEngineAnswer,
} from './LegendLiteEngineTransport.js';

/**
 * A client of legend-lite's engine module, which answers routes of the engine's `pure/v1` API in the
 * browser instead of on the engine server.
 *
 * This mirrors the engine server client (`V1_EngineServerClient`): a method here has the name of the
 * method there, takes the same input and gives the same output, so that a caller chooses a client and
 * nothing else changes. It has only the routes we use from legend-lite so far; when another route is
 * needed, add the method here, with the name and the types it has there.
 *
 * What differs from the engine server client:
 * - a route legend-lite refuses throws a {@link LegendLiteEngineError}, with legend-lite's message
 * - whatever must be adjusted in a request for legend-lite to accept it is adjusted here, so that
 *   callers send what they would send the engine server
 *
 * NOTE: this is experimental. Nothing uses this client unless the corresponding setting is turned on.
 */

const PROTOCOL_TYPE__MODEL_DATA = 'data';
const PROTOCOL_TYPE__RUNTIME = 'runtime';
const PROTOCOL_TYPE__CONNECTION = 'connection';
const PROTOCOL_TYPE__CONNECTION_POINTER = 'connectionPointer';
const PROTOCOL_TYPE__RELATIONAL_DATABASE_CONNECTION =
  'RelationalDatabaseConnection';

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

const extractRefusalMessage = (answer: LegendLiteEngineAnswer): string => {
  try {
    const body = JSON.parse(answer.body) as unknown;
    if (isPlainObject(body) && isString(body.message) && body.message) {
      return body.message;
    }
  } catch {
    // the body is not JSON: it is shown as it is
  }
  return answer.body || `legend-lite answered with status ${answer.status}`;
};

/** What the client needs to reach legend-lite's engine module (see `LegendLiteEngineTransport`). */
export interface LegendLiteEngineRouter {
  pureV1(
    path: string,
    query: string,
    body: string,
  ): Promise<LegendLiteEngineAnswer>;
  dispose(): void;
}

export class LegendLiteEngineClient {
  private readonly _router: LegendLiteEngineRouter;

  constructor(router: LegendLiteEngineRouter) {
    this._router = router;
  }

  /** Stops the engine module; the next request starts it again. */
  dispose(): void {
    this._router.dispose();
  }

  /**
   * Asks a route which takes and gives JSON.
   *
   * @throws a {@link LegendLiteEngineError} when legend-lite refuses the request. NOTE: by design,
   * nothing here falls back to the engine server, so that what legend-lite cannot do is seen rather
   * than hidden.
   */
  private async _post<T>(path: string, data: PlainObject): Promise<T> {
    const answer = await this._router.pureV1(path, '', JSON.stringify(data));
    if (answer.status < 200 || answer.status >= 300) {
      throw new LegendLiteEngineError(
        LEGEND_LITE_ENGINE_ERROR_KIND.REFUSAL,
        extractRefusalMessage(answer),
      );
    }
    return JSON.parse(answer.body) as T;
  }

  // ------------------------------------------- Routes -------------------------------------------

  _pure = (): string => `/api/pure/v1`;

  // ------------------------------------------- Execute -------------------------------------------

  _execution = (): string => `${this._pure()}/execution`;

  generatePlan = (
    input: PlainObject<V1_ExecuteInput>,
  ): Promise<PlainObject<V1_ExecutionPlan>> =>
    this._post(`${this._execution()}/generatePlan`, {
      ...input,
      model: isPlainObject(input.model)
        ? liftEmbeddedConnections(input.model)
        : input.model,
    });
}
