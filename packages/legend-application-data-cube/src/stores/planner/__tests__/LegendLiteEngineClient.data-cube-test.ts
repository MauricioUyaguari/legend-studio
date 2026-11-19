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

import { unitTest } from '@finos/legend-shared/test';
import { beforeAll, describe, expect, test } from '@jest/globals';
import { isPlainObject, type PlainObject } from '@finos/legend-shared';
import {
  DatabaseType,
  PackageableElementPointerType,
  V1_Column,
  V1_Database,
  V1_DuckDBDatasourceSpecification,
  V1_EngineRuntime,
  V1_IdentifiedConnection,
  V1_PackageableElementPointer,
  V1_PackageableRuntime,
  V1_PureModelContextData,
  V1_RelationalDatabaseConnection,
  V1_Schema,
  V1_StoreConnections,
  V1_Table,
  V1_TestAuthenticationStrategy,
  V1_VarChar,
  V1_serializePureModelContextData,
} from '@finos/legend-graph';
import { TEST__getTestGraphManagerState } from '@finos/legend-graph/test';
import {
  LEGEND_LITE_ENGINE_ERROR_KIND,
  LegendLiteEngineError,
  type LegendLiteEngineAnswer,
} from '../LegendLiteEngineTransport.js';
import {
  LegendLiteEngineClient,
  liftEmbeddedConnections,
} from '../LegendLiteEngineClient.js';

// the serializers of the model are set up when a graph manager is initialized, as they are in the application
beforeAll(async () => {
  await TEST__getTestGraphManagerState().graphManager.initialize({
    env: 'test',
    tabSize: 2,
    clientConfig: {},
  });
});

/**
 * The model DataCube synthesizes for a DuckDB-backed source, built and serialized the way
 * `LegendDataCubeDataCubeEngine._synthesizeMinimalModelContext()` does.
 */
const TEST__synthesizeMinimalModel = (): PlainObject => {
  const column = new V1_Column();
  column.name = 'region';
  column.type = new V1_VarChar();
  const table = new V1_Table();
  table.name = 'cache1';
  table.columns = [column];
  const schema = new V1_Schema();
  schema.name = 'main';
  schema.tables = [table];
  const database = new V1_Database();
  database.name = 'db';
  database.package = 'local';
  database.schemas = [schema];

  const connection = new V1_RelationalDatabaseConnection();
  connection.databaseType = DatabaseType.DuckDB;
  connection.type = DatabaseType.DuckDB;
  const dataSourceSpec = new V1_DuckDBDatasourceSpecification();
  dataSourceSpec.path = '/tmpFile';
  connection.store = database.path;
  connection.datasourceSpecification = dataSourceSpec;
  connection.authenticationStrategy = new V1_TestAuthenticationStrategy();

  const runtime = new V1_EngineRuntime();
  const storeConnections = new V1_StoreConnections();
  storeConnections.store = new V1_PackageableElementPointer(
    PackageableElementPointerType.STORE,
    database.path,
  );
  const identifiedConnection = new V1_IdentifiedConnection();
  identifiedConnection.connection = connection;
  identifiedConnection.id = 'c0';
  storeConnections.storeConnections = [identifiedConnection];
  runtime.connections = [storeConnections];

  const packageableRuntime = new V1_PackageableRuntime();
  packageableRuntime.runtimeValue = runtime;
  packageableRuntime.package = 'local';
  packageableRuntime.name = 'rt';

  const model = new V1_PureModelContextData();
  model.elements = [database, packageableRuntime];
  return V1_serializePureModelContextData(model);
};

const TEST__getElements = (model: PlainObject): PlainObject[] =>
  (model.elements as unknown[]).filter(isPlainObject);

const TEST__getElement = (model: PlainObject, type: string): PlainObject => {
  const element = TEST__getElements(model).find((el) => el._type === type);
  if (!element) {
    throw new Error(`The model has no element of type '${type}'`);
  }
  return element;
};

/** The connection a runtime element holds at its first store's first connection. */
const TEST__getRuntimeConnection = (runtime: PlainObject): PlainObject =>
  (
    (
      ((runtime.runtimeValue as PlainObject).connections as PlainObject[])[0]
        ?.storeConnections as PlainObject[]
    )[0] as PlainObject
  ).connection as PlainObject;

describe(unitTest('legend-lite engine client: embedded connections'), () => {
  test('the synthesized model embeds its connection, without postProcessorWithParameter', () => {
    // NOTE: this is what the shim exists for; if this test fails, the model no longer
    // has the shape legend-lite refuses, and the shim may no longer be needed
    const connection = TEST__getRuntimeConnection(
      TEST__getElement(TEST__synthesizeMinimalModel(), 'runtime'),
    );
    expect(connection._type).toBe('RelationalDatabaseConnection');
    expect(connection).not.toHaveProperty('postProcessorWithParameter');
  });

  test('an embedded connection becomes an element the runtime points at', () => {
    const model = TEST__synthesizeMinimalModel();
    const embedded = TEST__getRuntimeConnection(
      TEST__getElement(model, 'runtime'),
    );
    const lifted = liftEmbeddedConnections(model);

    expect(TEST__getElements(lifted).map((el) => el._type)).toEqual([
      'relational',
      'runtime',
      'connection',
    ]);
    const connection = TEST__getElement(lifted, 'connection');
    expect(connection.package).toBe('local');
    expect(connection.name).toBe('rt__c0');
    expect(connection.connectionValue).toEqual({
      ...embedded,
      postProcessorWithParameter: [],
    });
    expect(
      TEST__getRuntimeConnection(TEST__getElement(lifted, 'runtime')),
    ).toEqual({ _type: 'connectionPointer', connection: 'local::rt__c0' });
    // everything else is carried over as it was
    expect(TEST__getElement(lifted, 'relational')).toEqual(
      TEST__getElement(model, 'relational'),
    );
  });

  test('the model given is not changed', () => {
    const model = TEST__synthesizeMinimalModel();
    const before = JSON.stringify(model);
    liftEmbeddedConnections(model);
    expect(JSON.stringify(model)).toBe(before);
  });

  test('a model with nothing embedded is returned as it is', () => {
    const lifted = liftEmbeddedConnections(TEST__synthesizeMinimalModel());
    expect(liftEmbeddedConnections(lifted)).toBe(lifted);
  });

  test('postProcessorWithParameter is kept when the connection has it', () => {
    const model = TEST__synthesizeMinimalModel();
    TEST__getRuntimeConnection(
      TEST__getElement(model, 'runtime'),
    ).postProcessorWithParameter = [{ pp: 'x' }];
    expect(
      (
        TEST__getElement(liftEmbeddedConnections(model), 'connection')
          .connectionValue as PlainObject
      ).postProcessorWithParameter,
    ).toEqual([{ pp: 'x' }]);
  });

  test('the new element does not take the path of an existing one', () => {
    const model = TEST__synthesizeMinimalModel();
    (model.elements as unknown[]).push({
      _type: 'class',
      package: 'local',
      name: 'rt__c0',
    });
    const lifted = liftEmbeddedConnections(model);
    expect(TEST__getElement(lifted, 'connection').name).toBe('rt__c0_1');
    expect(
      TEST__getRuntimeConnection(TEST__getElement(lifted, 'runtime'))
        .connection,
    ).toBe('local::rt__c0_1');
  });

  test('a model that is not model data is returned as it is', () => {
    const pointer = { _type: 'pointer', sdlcInfo: {} };
    expect(liftEmbeddedConnections(pointer)).toBe(pointer);
  });
});

describe(unitTest('legend-lite engine client: generatePlan'), () => {
  /** What stands for the engine module: it answers every request the same way, and keeps what it was asked. */
  const TEST__setup = (answer: LegendLiteEngineAnswer) => {
    const calls: { path: string; query: string; body: string }[] = [];
    let disposed = false;
    const client = new LegendLiteEngineClient({
      pureV1: async (path: string, query: string, body: string) => {
        calls.push({ path, query, body });
        return answer;
      },
      dispose: () => {
        disposed = true;
      },
    });
    return { client, calls, isDisposed: () => disposed };
  };
  const TEST__input = () => ({
    clientVersion: 'vX_X_X',
    function: { _type: 'lambda', body: [], parameters: [] },
    model: TEST__synthesizeMinimalModel(),
    context: { _type: 'BaseExecutionContext' },
    parameterValues: [],
  });

  test('legend-lite is asked the route of the engine, with the input and the model made acceptable', async () => {
    const plan = { _type: 'simple', rootExecutionNode: {} };
    const { client, calls } = TEST__setup({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(plan),
    });
    const input = TEST__input();

    expect(await client.generatePlan(input)).toEqual(plan);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe('/api/pure/v1/execution/generatePlan');
    expect(calls[0]?.query).toBe('');
    expect(JSON.parse(calls[0]?.body ?? '')).toEqual({
      ...input,
      model: liftEmbeddedConnections(input.model),
    });
  });

  test('a refusal is thrown with the message of legend-lite, and legend-lite is asked once', async () => {
    const { client, calls } = TEST__setup({
      status: 500,
      contentType: 'application/json',
      body: '{"code":-1,"message":"IllegalStateException: no row scope","status":"error"}',
    });

    let thrown: unknown;
    try {
      await client.generatePlan(TEST__input());
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LegendLiteEngineError);
    expect((thrown as LegendLiteEngineError).kind).toBe(
      LEGEND_LITE_ENGINE_ERROR_KIND.REFUSAL,
    );
    expect((thrown as LegendLiteEngineError).message).toBe(
      '[legend-lite] IllegalStateException: no row scope',
    );
    expect(calls).toHaveLength(1);
  });

  test('a refusal whose body is not JSON shows the body', async () => {
    await expect(
      TEST__setup({
        status: 404,
        contentType: 'text/plain',
        body: 'no route',
      }).client.generatePlan(TEST__input()),
    ).rejects.toThrow('[legend-lite] no route');
  });

  test('a refusal with no body says its status', async () => {
    await expect(
      TEST__setup({
        status: 404,
        contentType: 'text/plain',
        body: '',
      }).client.generatePlan(TEST__input()),
    ).rejects.toThrow('[legend-lite] legend-lite answered with status 404');
  });

  test('a model that is not model data is sent as it is', async () => {
    const { client, calls } = TEST__setup({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
    const pointer = { _type: 'pointer', sdlcInfo: {} };
    await client.generatePlan({ ...TEST__input(), model: pointer });
    expect((JSON.parse(calls[0]?.body ?? '') as PlainObject).model).toEqual(
      pointer,
    );
  });

  test('stopping the client stops the engine module', () => {
    const { client, isDisposed } = TEST__setup({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
    expect(isDisposed()).toBe(false);
    client.dispose();
    expect(isDisposed()).toBe(true);
  });
});
