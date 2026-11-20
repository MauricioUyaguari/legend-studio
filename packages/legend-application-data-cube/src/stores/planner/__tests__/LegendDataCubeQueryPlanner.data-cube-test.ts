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
import { describe, expect, test } from '@jest/globals';
import { type PlainObject } from '@finos/legend-shared';
import { V1_EngineServerClient } from '@finos/legend-graph';
import {
  chooseDuckDBQueryPlanner,
  ENGINE_PLANNER_SELECTION,
  getPlannerSettingKeys,
  LEGEND_DATA_CUBE_PLANNER_MODE,
  resolvePlannerSelection,
  validateDuckDBQueryPlanners,
  type LegendDataCubeDuckDBQueryPlanner,
} from '../LegendDataCubeQueryPlanner.js';

const TEST__func = (name: string, parameters: unknown[]): PlainObject => ({
  _type: 'func',
  function: name,
  parameters,
});
const TEST__lambda = (body: PlainObject): PlainObject => ({
  _type: 'lambda',
  body: [body],
  parameters: [],
});
const TEST__SOURCE = { _type: 'classInstance', type: '>', value: {} };

const TEST__planner = (
  key: string,
  overrides: Partial<LegendDataCubeDuckDBQueryPlanner> = {},
): LegendDataCubeDuckDBQueryPlanner => ({
  key,
  label: `planner ${key}`,
  createEngineServerClient: () =>
    new V1_EngineServerClient({ baseUrl: 'http://planner.invalid' }),
  ...overrides,
});

const TEST__settings =
  (enabled: string[]) =>
  (settingKey: string): boolean =>
    enabled.includes(settingKey);

describe(unitTest('DataCube query planner: planners from plugins'), () => {
  test('each planner has two settings, named by its key', () => {
    expect(getPlannerSettingKeys({ key: 'my-planner' })).toEqual({
      use: 'debugger.planner.my-planner.enabled',
      shadow: 'debugger.planner.my-planner.shadow',
    });
  });

  test('planners with keys of their own are accepted', () => {
    const planners = [TEST__planner('a'), TEST__planner('b')];
    expect(validateDuckDBQueryPlanners(planners)).toBe(planners);
    expect(validateDuckDBQueryPlanners([])).toEqual([]);
  });

  test('two planners with the same key are refused', () => {
    expect(() =>
      validateDuckDBQueryPlanners([TEST__planner('a'), TEST__planner('a')]),
    ).toThrow(`another planner has the key 'a'`);
  });

  test('a planner with no key is refused', () => {
    expect(() => validateDuckDBQueryPlanners([TEST__planner('')])).toThrow(
      'its key is empty',
    );
  });
});

describe(
  unitTest('DataCube query planner: selection from the settings'),
  () => {
    const a = TEST__planner('a');
    const b = TEST__planner('b');

    test('with no planner, the engine plans, whatever is stored in the settings', () => {
      expect(
        resolvePlannerSelection(
          [],
          TEST__settings([
            'debugger.planner.a.enabled',
            'debugger.planner.a.shadow',
          ]),
        ),
      ).toEqual(ENGINE_PLANNER_SELECTION);
    });

    test('with no setting on, the engine plans', () => {
      expect(resolvePlannerSelection([a, b], TEST__settings([]))).toEqual(
        ENGINE_PLANNER_SELECTION,
      );
    });

    test('using a planner takes precedence over comparing one', () => {
      expect(
        resolvePlannerSelection(
          [a, b],
          TEST__settings([
            'debugger.planner.a.shadow',
            'debugger.planner.b.enabled',
          ]),
        ),
      ).toEqual({ mode: LEGEND_DATA_CUBE_PLANNER_MODE.PLANNER, planner: b });
      expect(
        resolvePlannerSelection(
          [a],
          TEST__settings(['debugger.planner.a.shadow']),
        ),
      ).toEqual({ mode: LEGEND_DATA_CUBE_PLANNER_MODE.SHADOW, planner: a });
    });

    test('among planners, the first contributed takes precedence', () => {
      expect(
        resolvePlannerSelection(
          [a, b],
          TEST__settings([
            'debugger.planner.b.enabled',
            'debugger.planner.a.enabled',
          ]),
        ),
      ).toEqual({ mode: LEGEND_DATA_CUBE_PLANNER_MODE.PLANNER, planner: a });
    });
  },
);

describe(unitTest('DataCube query planner: choice of planner'), () => {
  const query = TEST__lambda(TEST__func('filter', [TEST__SOURCE]));
  const pivot = TEST__lambda(TEST__func('pivot', [TEST__SOURCE]));
  const everything = TEST__planner('everything');
  const noPivot = TEST__planner('no-pivot', {
    isQuerySupported: (lambda) => !JSON.stringify(lambda).includes('pivot'),
  });

  test('with the engine selected, every query goes to the engine', () => {
    expect(
      chooseDuckDBQueryPlanner(ENGINE_PLANNER_SELECTION, query),
    ).toBeUndefined();
  });

  test('when the planner is compared, every query still goes to the engine', () => {
    expect(
      chooseDuckDBQueryPlanner(
        { mode: LEGEND_DATA_CUBE_PLANNER_MODE.SHADOW, planner: everything },
        query,
      ),
    ).toBeUndefined();
  });

  test('when the planner is used, it is asked for every query it supports', () => {
    const selection = {
      mode: LEGEND_DATA_CUBE_PLANNER_MODE.PLANNER,
      planner: everything,
    } as const;
    expect(chooseDuckDBQueryPlanner(selection, query)).toBe(everything);
    expect(chooseDuckDBQueryPlanner(selection, pivot)).toBe(everything);
  });

  test('a query the planner does not support goes to the engine', () => {
    const selection = {
      mode: LEGEND_DATA_CUBE_PLANNER_MODE.PLANNER,
      planner: noPivot,
    } as const;
    expect(chooseDuckDBQueryPlanner(selection, query)).toBe(noPivot);
    expect(chooseDuckDBQueryPlanner(selection, pivot)).toBeUndefined();
  });
});
