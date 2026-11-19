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
import { describe, expect, test } from '@jest/globals';
import { type PlainObject } from '@finos/legend-shared';
import { DataCubeFunction } from '@finos/legend-data-cube';
import {
  chooseDuckDBPlanner,
  hasCastlessPivot,
  LEGEND_DATA_CUBE_PLANNER,
  LEGEND_DATA_CUBE_PLANNER_MODE,
  resolvePlannerMode,
} from '../LegendDataCubePlannerMode.js';

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
const TEST__COLS = { _type: 'classInstance', type: 'colSpecArray', value: {} };

describe(unitTest('DataCube planner mode: choice of planner'), () => {
  const pivot = TEST__func('pivot', [TEST__SOURCE, TEST__COLS, TEST__COLS]);
  const pivotDiscovery = TEST__lambda(
    TEST__func('from', [
      TEST__func('limit', [pivot, { _type: 'integer', value: 0 }]),
      { _type: 'packageableElementPtr', fullPath: 'local::rt' },
    ]),
  );
  const pivotWithCast = TEST__lambda(
    TEST__func('from', [
      TEST__func('groupBy', [
        TEST__func('cast', [pivot, { _type: 'genericTypeInstance' }]),
        TEST__COLS,
        TEST__COLS,
      ]),
      { _type: 'packageableElementPtr', fullPath: 'local::rt' },
    ]),
  );
  const noPivot = TEST__lambda(
    TEST__func('from', [
      TEST__func('filter', [TEST__SOURCE, TEST__lambda(TEST__SOURCE)]),
      { _type: 'packageableElementPtr', fullPath: 'local::rt' },
    ]),
  );

  test('a pivot that is not followed by a cast is found', () => {
    expect(hasCastlessPivot(pivotDiscovery)).toBe(true);
  });

  test('a pivot followed by a cast is not', () => {
    expect(hasCastlessPivot(pivotWithCast)).toBe(false);
  });

  test('a query with no pivot is not', () => {
    expect(hasCastlessPivot(noPivot)).toBe(false);
  });

  test('functions are matched by full path as well as by name', () => {
    expect(
      hasCastlessPivot(
        TEST__lambda(
          TEST__func(DataCubeFunction.PIVOT, [TEST__SOURCE, TEST__COLS]),
        ),
      ),
    ).toBe(true);
    expect(
      hasCastlessPivot(
        TEST__lambda(
          TEST__func(DataCubeFunction.CAST, [
            TEST__func(DataCubeFunction.PIVOT, [TEST__SOURCE, TEST__COLS]),
            { _type: 'genericTypeInstance' },
          ]),
        ),
      ),
    ).toBe(false);
  });

  test('a cast further out does not count', () => {
    expect(
      hasCastlessPivot(
        TEST__lambda(
          TEST__func('cast', [
            TEST__func('limit', [pivot, { _type: 'integer', value: 0 }]),
            { _type: 'genericTypeInstance' },
          ]),
        ),
      ),
    ).toBe(true);
  });

  test('with the engine mode, every query goes to the engine', () => {
    [pivotDiscovery, pivotWithCast, noPivot].forEach((query) =>
      expect(
        chooseDuckDBPlanner(LEGEND_DATA_CUBE_PLANNER_MODE.ENGINE, query),
      ).toBe(LEGEND_DATA_CUBE_PLANNER.ENGINE),
    );
  });

  test('with the legend-lite mode, only a pivot with no cast stays with the engine', () => {
    expect(
      chooseDuckDBPlanner(LEGEND_DATA_CUBE_PLANNER_MODE.LEGEND_LITE, noPivot),
    ).toBe(LEGEND_DATA_CUBE_PLANNER.LEGEND_LITE);
    expect(
      chooseDuckDBPlanner(
        LEGEND_DATA_CUBE_PLANNER_MODE.LEGEND_LITE,
        pivotWithCast,
      ),
    ).toBe(LEGEND_DATA_CUBE_PLANNER.LEGEND_LITE);
    expect(
      chooseDuckDBPlanner(
        LEGEND_DATA_CUBE_PLANNER_MODE.LEGEND_LITE,
        pivotDiscovery,
      ),
    ).toBe(LEGEND_DATA_CUBE_PLANNER.ENGINE);
  });
});

describe(unitTest('DataCube planner mode: mode from the settings'), () => {
  test('using the planner takes precedence over comparing it', () => {
    expect(resolvePlannerMode(false, false)).toBe(
      LEGEND_DATA_CUBE_PLANNER_MODE.ENGINE,
    );
    expect(resolvePlannerMode(false, true)).toBe(
      LEGEND_DATA_CUBE_PLANNER_MODE.SHADOW,
    );
    expect(resolvePlannerMode(true, false)).toBe(
      LEGEND_DATA_CUBE_PLANNER_MODE.LEGEND_LITE,
    );
    expect(resolvePlannerMode(true, true)).toBe(
      LEGEND_DATA_CUBE_PLANNER_MODE.LEGEND_LITE,
    );
  });
});
