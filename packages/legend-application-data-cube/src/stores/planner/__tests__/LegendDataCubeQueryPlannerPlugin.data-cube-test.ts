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

import { unitTest } from '@finos/legend-shared/test';
import { describe, expect, jest, test } from '@jest/globals';
import { ApplicationStore } from '@finos/legend-application';
import { V1_EngineServerClient } from '@finos/legend-graph';
import { LegendDataCubeApplicationPlugin } from '../../../application/LegendDataCubeApplicationPlugin.js';
import { LegendDataCubePluginManager } from '../../../application/LegendDataCubePluginManager.js';
import { Core_LegendDataCubeApplicationPlugin } from '../../../application/Core_LegendDataCubeApplicationPlugin.js';
import { Core_LegendDataCube_LegendApplicationPlugin } from '../../../application/Core_LegendDataCube_LegendApplicationPlugin.js';
import { TEST__getTestLegendDataCubeApplicationConfig } from '../../../application/__test-utils__/LegendDataCubeApplicationTestUtils.js';
import { LegendDataCubeBaseStore } from '../../LegendDataCubeBaseStore.js';
import {
  LEGEND_DATA_CUBE_PLANNER_MODE,
  type LegendDataCubeDuckDBQueryPlanner,
  type LegendDataCubePlannerSelection,
} from '../LegendDataCubeQueryPlanner.js';

// `LegendDataCubeDuckDBEngine` uses `import.meta`, which jest can't parse; it is unused here
// NOTE: the factory is hoisted above the `@jest/globals` import, so it must not
// reference `jest` itself - plain functions only
jest.mock('../../LegendDataCubeDuckDBEngine', () => ({
  LegendDataCubeDuckDBEngine: function LegendDataCubeDuckDBEngine() {
    return {
      initialize: () => Promise.resolve(),
      dispose: () => Promise.resolve(),
    };
  },
}));

class TEST__PlannerPlugin extends LegendDataCubeApplicationPlugin {
  readonly createEngineServerClient = jest.fn(
    () => new V1_EngineServerClient({ baseUrl: 'http://planner.invalid' }),
  );
  readonly planner: LegendDataCubeDuckDBQueryPlanner = {
    key: 'test-planner',
    label: 'Test Planner',
    createEngineServerClient: this.createEngineServerClient,
  };

  constructor() {
    super('TEST__PlannerPlugin', '0.0.0');
  }

  override getExtraDuckDBQueryPlanners(): LegendDataCubeDuckDBQueryPlanner[] {
    return [this.planner];
  }
}

const TEST__createBaseStore = (
  extraPlugins: LegendDataCubeApplicationPlugin[],
) => {
  const pluginManager = LegendDataCubePluginManager.create();
  pluginManager
    .usePlugins([
      new Core_LegendDataCube_LegendApplicationPlugin(),
      new Core_LegendDataCubeApplicationPlugin(),
      ...extraPlugins,
    ])
    .install();
  return new LegendDataCubeBaseStore(
    new ApplicationStore(
      TEST__getTestLegendDataCubeApplicationConfig(),
      pluginManager,
    ),
  );
};

const PLANNER_SETTING_KEYS = [
  'debugger.planner.test-planner.enabled',
  'debugger.planner.test-planner.shadow',
];

describe(unitTest('DataCube query planner: contributed by a plugin'), () => {
  test('with no plugin contributing a planner, there is no planner setting', () => {
    const store = TEST__createBaseStore([]);
    expect(store.duckDBQueryPlanners).toEqual([]);
    expect(
      store.settings.filter((setting) =>
        setting.key.startsWith('debugger.planner.'),
      ),
    ).toEqual([]);
  });

  test('a contributed planner adds its two settings, off by default, and its client is not created until it is asked', () => {
    const plugin = new TEST__PlannerPlugin();
    const store = TEST__createBaseStore([plugin]);

    expect(store.duckDBQueryPlanners).toEqual([plugin.planner]);
    const settings = store.settings.filter((setting) =>
      PLANNER_SETTING_KEYS.includes(setting.key),
    );
    expect(settings.map((setting) => setting.key)).toEqual(
      PLANNER_SETTING_KEYS,
    );
    expect(settings.map((setting) => setting.defaultValue)).toEqual([
      false,
      false,
    ]);
    expect(settings[0]?.title).toContain('Test Planner');
    expect(plugin.createEngineServerClient).not.toHaveBeenCalled();
  });

  test('turning the settings on and off selects the planner, using it taking precedence over comparing it', () => {
    const plugin = new TEST__PlannerPlugin();
    const store = TEST__createBaseStore([plugin]);
    const selections: LegendDataCubePlannerSelection[] = [];
    jest
      .spyOn(store.engine, 'setPlannerSelection')
      .mockImplementation((selection) => {
        selections.push(selection);
      });
    const setting = (key: string) =>
      store.settings.find((candidate) => candidate.key === key);
    const toggle = (key: string, value: boolean) =>
      setting(key)?.action?.(
        undefined as unknown as Parameters<
          NonNullable<NonNullable<ReturnType<typeof setting>>['action']>
        >[0],
        value,
      );

    toggle('debugger.planner.test-planner.shadow', true);
    toggle('debugger.planner.test-planner.enabled', true);
    toggle('debugger.planner.test-planner.enabled', false);
    toggle('debugger.planner.test-planner.shadow', false);

    expect(selections).toEqual([
      { mode: LEGEND_DATA_CUBE_PLANNER_MODE.SHADOW, planner: plugin.planner },
      { mode: LEGEND_DATA_CUBE_PLANNER_MODE.PLANNER, planner: plugin.planner },
      { mode: LEGEND_DATA_CUBE_PLANNER_MODE.SHADOW, planner: plugin.planner },
      { mode: LEGEND_DATA_CUBE_PLANNER_MODE.ENGINE },
    ]);
    expect(plugin.createEngineServerClient).not.toHaveBeenCalled();
  });

  test('two plugins contributing planners with the same key are refused', () => {
    expect(() =>
      TEST__createBaseStore([
        new TEST__PlannerPlugin(),
        new TEST__PlannerPlugin(),
      ]),
    ).toThrow(`another planner has the key 'test-planner'`);
  });
});
