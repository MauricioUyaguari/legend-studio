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
import {
  TabularDataSet,
  TDSExecutionResult,
  TDSRow,
} from '@finos/legend-graph';
import { LegendLitePlannerError } from '../LegendLitePlannerClient.js';
import {
  LEGEND_DATA_CUBE_PLANNER_MODE,
  LEGEND_LITE_PLANNER_REQUEST_ERROR_KIND,
  resolvePlannerMode,
} from '../LegendLitePlannerRequest.js';
import {
  compareShadowResults,
  getQueryLimit,
  getQuerySortColumns,
  LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE,
  LEGEND_LITE_PLANNER_SHADOW_FAILURE,
  LEGEND_LITE_PLANNER_SHADOW_OUTCOME,
  LegendLitePlannerShadow,
  type LegendLitePlannerShadowDetail,
  type LegendLitePlannerShadowRecord,
  type LegendLitePlannerShadowRun,
} from '../LegendLitePlannerShadow.js';

type Cell = string | number | boolean | null;

const TEST__result = (
  columns: string[],
  rows: Cell[][],
): TDSExecutionResult => {
  const result = new TDSExecutionResult();
  const tds = new TabularDataSet();
  tds.columns = columns;
  tds.rows = rows.map((values) => {
    const row = new TDSRow();
    row.values = values;
    return row;
  });
  result.result = tds;
  return result;
};

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
const TEST__int = (value: number): PlainObject => ({ _type: 'integer', value });
const TEST__SOURCE = { _type: 'classInstance', type: '>', value: {} };
const TEST__RUNTIME = { _type: 'packageableElementPtr', fullPath: 'local::rt' };
/** `source->slice(0, limit)->from(rt)`, the way DataCube ends the query of a grid page */
const TEST__queryWithLimit = (limit: number): PlainObject =>
  TEST__lambda(
    TEST__func('from', [
      TEST__func('slice', [TEST__SOURCE, TEST__int(0), TEST__int(limit)]),
      TEST__RUNTIME,
    ]),
  );

describe(unitTest('legend-lite planner shadow: comparison'), () => {
  const columns = ['region', 'amount'];

  test('the same rows in the same order match exactly', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [
          ['EMEA', 1.5],
          ['APAC', null],
        ]),
        TEST__result(columns, [
          ['EMEA', 1.5],
          ['APAC', null],
        ]),
        false,
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH,
      exact: true,
      sameOrder: true,
    });
  });

  test('the same rows in another order match, and the order is reported', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [
          ['EMEA', 1],
          ['APAC', 2],
          ['EMEA', 1],
        ]),
        TEST__result(columns, [
          ['APAC', 2],
          ['EMEA', 1],
          ['EMEA', 1],
        ]),
        false,
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH,
      exact: true,
      sameOrder: false,
    });
  });

  test('numbers that differ in their last digits match, not exactly', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [['EMEA', 0.1 + 0.2]]),
        TEST__result(columns, [['EMEA', 0.3]]),
        false,
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH,
      exact: false,
      sameOrder: true,
    });
    // in another order as well
    expect(
      compareShadowResults(
        TEST__result(columns, [
          ['EMEA', 0.1 + 0.2],
          ['APAC', 7],
        ]),
        TEST__result(columns, [
          ['APAC', 7],
          ['EMEA', 0.3],
        ]),
        false,
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH,
      exact: false,
      sameOrder: false,
    });
  });

  test('numbers that differ by more than the tolerance are different', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [['EMEA', 100]]),
        TEST__result(columns, [['EMEA', 100.001]]),
        false,
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
      kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.ROWS,
    });
  });

  test('a value of another type is different', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [['EMEA', 1]]),
        TEST__result(columns, [['EMEA', '1']]),
        false,
      ).outcome,
    ).toBe(LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT);
    expect(
      compareShadowResults(
        TEST__result(columns, [['EMEA', null]]),
        TEST__result(columns, [['EMEA', 0]]),
        false,
      ).outcome,
    ).toBe(LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT);
  });

  test('a repeated row counts as many times as it appears', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [
          ['EMEA', 1],
          ['EMEA', 1],
          ['APAC', 2],
        ]),
        TEST__result(columns, [
          ['EMEA', 1],
          ['APAC', 2],
          ['APAC', 2],
        ]),
        false,
      ).outcome,
    ).toBe(LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT);
  });

  test('different columns are different, whatever the rows', () => {
    expect(
      compareShadowResults(
        TEST__result(['region', 'amount'], []),
        TEST__result(['region', 'total'], []),
        false,
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
      kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.COLUMNS,
    });
    expect(
      compareShadowResults(
        TEST__result(['region', 'amount'], []),
        TEST__result(['amount', 'region'], []),
        false,
      ).kind,
    ).toBe(LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.COLUMNS);
  });

  test('a different number of rows is different, even when the limit is reached', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [['EMEA', 1]]),
        TEST__result(columns, []),
        true,
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
      kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.ROW_COUNT,
    });
  });

  test('different rows are inconclusive when the limit is reached', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [['EMEA', 1]]),
        TEST__result(columns, [['APAC', 2]]),
        true,
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.INCONCLUSIVE,
      kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.ROWS,
    });
  });

  test('with a sort, the same rows with the sorted values in another order are different', () => {
    // e.g. empty values first in one result and last in the other
    expect(
      compareShadowResults(
        TEST__result(columns, [
          ['EMEA', null],
          ['APAC', 2],
          ['AMER', 1],
        ]),
        TEST__result(columns, [
          ['APAC', 2],
          ['AMER', 1],
          ['EMEA', null],
        ]),
        false,
        ['amount'],
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
      kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.ORDER,
    });
  });

  test('with a sort, rows that tie on the sorted values may come in any order', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [
          ['EMEA', 2],
          ['APAC', 2],
          ['AMER', 1],
        ]),
        TEST__result(columns, [
          ['APAC', 2],
          ['EMEA', 2],
          ['AMER', 1],
        ]),
        false,
        ['amount'],
      ),
    ).toEqual({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH,
      exact: true,
      sameOrder: false,
    });
  });

  test('a sort by a column that is not in the result is not checked', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, [
          ['EMEA', 1],
          ['APAC', 2],
        ]),
        TEST__result(columns, [
          ['APAC', 2],
          ['EMEA', 1],
        ]),
        false,
        ['elsewhere'],
      ).outcome,
    ).toBe(LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH);
  });

  test('two empty results match', () => {
    expect(
      compareShadowResults(
        TEST__result(columns, []),
        TEST__result(columns, []),
        false,
      ).outcome,
    ).toBe(LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH);
  });
});

describe(unitTest('legend-lite planner shadow: limit of a query'), () => {
  test('the size of the slice a query ends with, under its from()', () => {
    expect(getQueryLimit(TEST__queryWithLimit(500))).toBe(500);
    expect(
      getQueryLimit(
        TEST__lambda(
          TEST__func('slice', [TEST__SOURCE, TEST__int(100), TEST__int(150)]),
        ),
      ),
    ).toBe(50);
  });

  test('the size of a limit, and functions by their full path', () => {
    expect(
      getQueryLimit(
        TEST__lambda(
          TEST__func('meta::pure::mapping::from', [
            TEST__func('meta::pure::functions::relation::limit', [
              TEST__SOURCE,
              TEST__int(0),
            ]),
            TEST__RUNTIME,
          ]),
        ),
      ),
    ).toBe(0);
  });

  test('none when the query does not end with one', () => {
    expect(
      getQueryLimit(
        TEST__lambda(
          TEST__func('from', [
            TEST__func('sort', [
              TEST__func('slice', [TEST__SOURCE, TEST__int(0), TEST__int(5)]),
              [],
            ]),
            TEST__RUNTIME,
          ]),
        ),
      ),
    ).toBeUndefined();
    expect(getQueryLimit(TEST__lambda(TEST__SOURCE))).toBeUndefined();
  });
});

describe(unitTest('legend-lite planner shadow: sort of a query'), () => {
  const TEST__col = (name: string): PlainObject => ({
    _type: 'classInstance',
    type: 'colSpec',
    value: { name },
  });
  const TEST__sort = (source: PlainObject, columns: string[]): PlainObject =>
    TEST__func('sort', [
      source,
      {
        _type: 'collection',
        multiplicity: {
          lowerBound: columns.length,
          upperBound: columns.length,
        },
        values: columns.map((name, idx) =>
          TEST__func(idx % 2 ? 'ascending' : 'descending', [TEST__col(name)]),
        ),
      },
    ]);

  test('the columns of the sort a query ends with, in order, under its slice() and from()', () => {
    expect(
      getQuerySortColumns(
        TEST__lambda(
          TEST__func('from', [
            TEST__func('slice', [
              TEST__sort(TEST__SOURCE, ['amount', 'region']),
              TEST__int(0),
              TEST__int(500),
            ]),
            TEST__RUNTIME,
          ]),
        ),
      ),
    ).toEqual(['amount', 'region']);
  });

  test('none when the query does not end with a sort', () => {
    expect(getQuerySortColumns(TEST__queryWithLimit(500))).toEqual([]);
    // a sort further in, e.g. the one before a pivot, does not order the result
    expect(
      getQuerySortColumns(
        TEST__lambda(
          TEST__func('from', [
            TEST__func('groupBy', [TEST__sort(TEST__SOURCE, ['region']), []]),
            TEST__RUNTIME,
          ]),
        ),
      ),
    ).toEqual([]);
  });
});

describe(unitTest('legend-lite planner shadow: run'), () => {
  const columns = ['region', 'amount'];
  const TEST__setup = (overrides: Partial<LegendLitePlannerShadowRun> = {}) => {
    const records: {
      record: LegendLitePlannerShadowRecord;
      detail: LegendLitePlannerShadowDetail;
    }[] = [];
    const executed: string[] = [];
    const run: LegendLitePlannerShadowRun = {
      query: TEST__queryWithLimit(500),
      engine: {
        sql: 'engine sql',
        result: TEST__result(columns, [
          ['EMEA', 1],
          ['APAC', 2],
        ]),
      },
      generatePlannerSQL: async () => 'planner sql',
      runSQL: async (sql) => {
        executed.push(sql);
        return TEST__result(columns, [
          ['APAC', 2],
          ['EMEA', 1],
        ]);
      },
      record: (record, detail) => records.push({ record, detail }),
      ...overrides,
    };
    return { run, records, executed };
  };

  test('the planner SQL is run and a match is recorded, with the texts kept apart', async () => {
    const { run, records, executed } = TEST__setup();
    await new LegendLitePlannerShadow().run(run);

    expect(executed).toEqual(['planner sql']);
    expect(records).toHaveLength(1);
    expect(records[0]?.record).toMatchObject({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH,
      exact: true,
      sameOrder: false,
      columnCount: 2,
      engineRowCount: 2,
      plannerRowCount: 2,
      limit: 500,
    });
    expect(typeof records[0]?.record.plannerPlanningTime).toBe('number');
    expect(typeof records[0]?.record.plannerExecutionTime).toBe('number');
    // the record, which is what gets sent, holds no text of the query or of the SQL
    expect(JSON.stringify(records[0]?.record)).not.toContain('sql');
    expect(records[0]?.detail).toEqual({
      engineSQL: 'engine sql',
      plannerSQL: 'planner sql',
    });
  });

  test('different rows are different when the limit is not reached', async () => {
    const { run, records } = TEST__setup({
      runSQL: async () =>
        TEST__result(columns, [
          ['EMEA', 1],
          ['APAC', 3],
        ]),
    });
    await new LegendLitePlannerShadow().run(run);
    expect(records[0]?.record).toMatchObject({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
      kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.ROWS,
    });
  });

  test('different rows are inconclusive when the limit is reached', async () => {
    const { run, records } = TEST__setup({
      query: TEST__queryWithLimit(2),
      runSQL: async () =>
        TEST__result(columns, [
          ['EMEA', 1],
          ['AMER', 3],
        ]),
    });
    await new LegendLitePlannerShadow().run(run);
    expect(records[0]?.record).toMatchObject({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.INCONCLUSIVE,
      limit: 2,
    });
  });

  test('a refusal is recorded with the message of the planner, and no SQL is run', async () => {
    const { run, records, executed } = TEST__setup({
      generatePlannerSQL: async () => {
        throw new LegendLitePlannerError(
          LEGEND_LITE_PLANNER_REQUEST_ERROR_KIND.REFUSAL,
          'no row scope',
        );
      },
    });
    await new LegendLitePlannerShadow().run(run);

    expect(executed).toHaveLength(0);
    expect(records[0]?.record).toMatchObject({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.REFUSED,
      kind: LEGEND_LITE_PLANNER_REQUEST_ERROR_KIND.REFUSAL,
      message: '[legend-lite planner] no row scope',
      engineRowCount: 2,
    });
    expect(records[0]?.detail).toEqual({ engineSQL: 'engine sql' });
  });

  test('a planner that could not be asked is a failure, not a refusal', async () => {
    const { run, records } = TEST__setup({
      generatePlannerSQL: async () => {
        throw new LegendLitePlannerError('worker', 'could not load');
      },
    });
    await new LegendLitePlannerShadow().run(run);
    expect(records[0]?.record).toMatchObject({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.FAILED,
      kind: LEGEND_LITE_PLANNER_SHADOW_FAILURE.PLAN,
    });
  });

  test('planner SQL that cannot be run is a failure, with the message of the database', async () => {
    const { run, records } = TEST__setup({
      runSQL: async () => {
        throw new Error('Parser Error: syntax error');
      },
    });
    await new LegendLitePlannerShadow().run(run);
    expect(records[0]?.record).toMatchObject({
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.FAILED,
      kind: LEGEND_LITE_PLANNER_SHADOW_FAILURE.SQL,
      message: 'Parser Error: syntax error',
    });
    expect(records[0]?.detail.plannerSQL).toBe('planner sql');
  });

  test('a long message is cut', async () => {
    const { run, records } = TEST__setup({
      runSQL: async () => {
        throw new Error('x'.repeat(5000));
      },
    });
    await new LegendLitePlannerShadow().run(run);
    expect(records[0]?.record.message).toHaveLength(500);
  });

  test('a failure to record does not escape', async () => {
    const { run } = TEST__setup({
      record: () => {
        throw new Error('telemetry is down');
      },
    });
    await expect(
      new LegendLitePlannerShadow().run(run),
    ).resolves.toBeUndefined();
  });

  test('a query with a pivot and no cast is not compared', async () => {
    const { run, records, executed } = TEST__setup({
      query: TEST__lambda(
        TEST__func('from', [
          TEST__func('limit', [
            TEST__func('pivot', [TEST__SOURCE, [], []]),
            TEST__int(0),
          ]),
          TEST__RUNTIME,
        ]),
      ),
    });
    await new LegendLitePlannerShadow().run(run);
    expect(executed).toHaveLength(0);
    expect(records).toHaveLength(0);
  });

  test('a query arriving while another is being compared is not compared', async () => {
    let release: (sql: string) => void = () => {};
    const shadow = new LegendLitePlannerShadow();
    const first = TEST__setup({
      generatePlannerSQL: () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    });
    const second = TEST__setup();

    const firstRun = shadow.run(first.run);
    await shadow.run(second.run);
    expect(second.records).toHaveLength(0);
    expect(second.executed).toHaveLength(0);

    release('planner sql');
    await firstRun;
    expect(first.records).toHaveLength(1);

    // and once the first is done, the next one is compared
    const third = TEST__setup();
    await shadow.run(third.run);
    expect(third.records).toHaveLength(1);
  });
});

describe(unitTest('legend-lite planner: mode from the settings'), () => {
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
