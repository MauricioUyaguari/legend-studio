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
import {
  matchFunctionName,
  type TDSExecutionResult,
} from '@finos/legend-graph';
import { isPlainObject, isString } from '@finos/legend-shared';
import {
  LEGEND_LITE_ENGINE_ERROR_KIND,
  LegendLiteEngineError,
} from './LegendLiteEngineTransport.js';
import { hasCastlessPivot } from './LegendDataCubePlannerMode.js';

/**
 * Shadow mode: the engine plans every query, as usual, and its result is what the user sees. Afterwards,
 * off the user's path, legend-lite's planner is asked for the same query, its SQL is run on the same
 * DuckDB, and the two results are compared. Nothing here can affect what the user sees.
 */

export enum LEGEND_LITE_PLANNER_SHADOW_OUTCOME {
  /** Same columns and same rows */
  MATCH = 'match',
  /** Different columns, a different number of rows, or different rows */
  DIFFERENT = 'different',
  /**
   * The rows differ, but the query does not determine which rows are returned (its limit was reached),
   * so the two results may both be right
   */
  INCONCLUSIVE = 'inconclusive',
  /** The planner does not plan this query */
  REFUSED = 'refused',
  /** The planner could not be asked, or its SQL could not be run */
  FAILED = 'failed',
}

export enum LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE {
  COLUMNS = 'columns',
  ROW_COUNT = 'row-count',
  ROWS = 'rows',
  /** The same rows, but not in the order the sort of the query asks for */
  ORDER = 'order',
}

export enum LEGEND_LITE_PLANNER_SHADOW_FAILURE {
  /** Asking the planner failed (as opposed to the planner refusing the query) */
  PLAN = 'plan',
  /** DuckDB could not run the planner's SQL */
  SQL = 'sql',
}

/**
 * What is recorded about one comparison. NOTE: this holds counts, timings and messages only. It
 * deliberately holds neither the query nor any SQL, as those carry column names and filter values.
 */
export type LegendLitePlannerShadowRecord = {
  outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME;
  /** What differs, what failed, or the kind of refusal the planner reported */
  kind?: string | undefined;
  message?: string | undefined;
  /** For a match: whether every value is identical, as opposed to numbers equal within the tolerance */
  exact?: boolean | undefined;
  /** For a match: whether the rows also came back in the same order */
  sameOrder?: boolean | undefined;
  columnCount: number;
  engineRowCount: number;
  plannerRowCount?: number | undefined;
  /** How long the planner took to generate the plan, in milliseconds */
  plannerPlanningTime?: number | undefined;
  /** How long DuckDB took to run the planner's SQL, in milliseconds */
  plannerExecutionTime?: number | undefined;
  /** The number of rows the query is limited to, when it has a limit we can read */
  limit?: number | undefined;
};

/** What a record does not hold; for local debugging only, never to be sent anywhere. */
export type LegendLitePlannerShadowDetail = {
  engineSQL: string;
  plannerSQL?: string | undefined;
};

export type LegendLitePlannerShadowComparison = {
  outcome:
    | LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH
    | LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT
    | LEGEND_LITE_PLANNER_SHADOW_OUTCOME.INCONCLUSIVE;
  kind?: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE | undefined;
  exact?: boolean | undefined;
  sameOrder?: boolean | undefined;
};

type Cell = string | number | boolean | null;

// two numbers are taken as equal within this relative difference: the two SQL texts may add up the
// same numbers in a different order, which changes the last digits of a floating point result
const NUMBER_RELATIVE_TOLERANCE = 1e-9;
const NUMBER_SORT_KEY_PRECISION = 9;

// a result larger than this is not shadowed: the comparison holds both results in memory
const MAX_ROWS_TO_COMPARE = 50000;

const MAX_MESSAGE_LENGTH = 500;

const PROTOCOL_TYPE__FUNCTION = 'func';
const PROTOCOL_TYPE__LAMBDA = 'lambda';
const PROTOCOL_TYPE__INTEGER = 'integer';
const PROTOCOL_TYPE__CLASS_INSTANCE = 'classInstance';
const CLASS_INSTANCE_TYPE__COL_SPEC = 'colSpec';

const areCellsEqual = (a: Cell, b: Cell): boolean => {
  if (a === b) {
    return true;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) {
      return true;
    }
    return (
      Math.abs(a - b) <=
      NUMBER_RELATIVE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b))
    );
  }
  return false;
};

const areRowsEqual = (
  a: Cell[][],
  b: Cell[][],
  areEqual: (x: Cell, y: Cell) => boolean,
): boolean =>
  a.every((row, rowIdx) => {
    const other = b[rowIdx];
    return (
      other !== undefined &&
      row.length === other.length &&
      row.every((cell, idx) => areEqual(cell, other[idx] as Cell))
    );
  });

const areCellsIdentical = (a: Cell, b: Cell): boolean =>
  a === b ||
  (typeof a === 'number' &&
    typeof b === 'number' &&
    Number.isNaN(a) &&
    Number.isNaN(b));

/** Orders rows so that two results holding the same rows, in any order, line up. */
const sortRows = (rows: Cell[][], roundNumbers: boolean): Cell[][] => {
  const keyOf = (row: Cell[]): string =>
    JSON.stringify(
      row.map((cell) =>
        typeof cell === 'number'
          ? roundNumbers
            ? cell.toPrecision(NUMBER_SORT_KEY_PRECISION)
            : String(cell)
          : cell,
      ),
    );
  return rows
    .map((row) => ({ row, key: keyOf(row) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.row);
};

/**
 * Reads the number of rows a query is limited to, i.e. the size of the `slice()` or `limit()`
 * it ends with (ignoring the `from()` around it). Gives `undefined` when the query has no such limit,
 * or one we cannot read.
 */
export const getQueryLimit = (query: unknown): number | undefined => {
  let current: unknown = query;
  if (isPlainObject(current) && current._type === PROTOCOL_TYPE__LAMBDA) {
    current = Array.isArray(current.body) ? current.body[0] : undefined;
  }
  while (
    isPlainObject(current) &&
    current._type === PROTOCOL_TYPE__FUNCTION &&
    isString(current.function) &&
    Array.isArray(current.parameters)
  ) {
    const parameters = current.parameters as unknown[];
    const integerAt = (idx: number): number | undefined => {
      const parameter = parameters[idx];
      return isPlainObject(parameter) &&
        parameter._type === PROTOCOL_TYPE__INTEGER &&
        typeof parameter.value === 'number'
        ? parameter.value
        : undefined;
    };
    if (matchFunctionName(current.function, DataCubeFunction.FROM)) {
      current = parameters[0];
    } else if (matchFunctionName(current.function, DataCubeFunction.SLICE)) {
      const start = integerAt(1);
      const stop = integerAt(2);
      return start !== undefined && stop !== undefined
        ? stop - start
        : undefined;
    } else if (matchFunctionName(current.function, DataCubeFunction.LIMIT)) {
      return integerAt(1);
    } else {
      return undefined;
    }
  }
  return undefined;
};

const collectColumnNames = (value: unknown, names: string[]): void => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectColumnNames(item, names));
  } else if (isPlainObject(value)) {
    if (
      value._type === PROTOCOL_TYPE__CLASS_INSTANCE &&
      value.type === CLASS_INSTANCE_TYPE__COL_SPEC &&
      isPlainObject(value.value) &&
      isString(value.value.name)
    ) {
      names.push(value.value.name);
    } else {
      Object.values(value).forEach((item) => collectColumnNames(item, names));
    }
  }
};

/**
 * Reads the columns a query sorts its result by, in order, i.e. those of the `sort()` it ends with
 * (ignoring the `slice()`, `limit()` and `from()` around it). Gives none when the query does not end
 * with a sort.
 */
export const getQuerySortColumns = (query: unknown): string[] => {
  let current: unknown = query;
  if (isPlainObject(current) && current._type === PROTOCOL_TYPE__LAMBDA) {
    current = Array.isArray(current.body) ? current.body[0] : undefined;
  }
  while (
    isPlainObject(current) &&
    current._type === PROTOCOL_TYPE__FUNCTION &&
    isString(current.function) &&
    Array.isArray(current.parameters)
  ) {
    const parameters = current.parameters as unknown[];
    if (
      matchFunctionName(current.function, [
        DataCubeFunction.FROM,
        DataCubeFunction.SLICE,
        DataCubeFunction.LIMIT,
      ])
    ) {
      current = parameters[0];
    } else if (matchFunctionName(current.function, DataCubeFunction.SORT)) {
      const names: string[] = [];
      collectColumnNames(parameters.slice(1), names);
      return names;
    } else {
      return [];
    }
  }
  return [];
};

/**
 * Compares the result of the engine's SQL with the result of the planner's SQL for the same query.
 *
 * Rows are compared whatever their order: a query often does not fully determine the order (no sort,
 * or a sort with ties), and then two correct results can come back ordered differently. What a sort
 * does determine is the order of the values of the columns it sorts by, so that is compared as well.
 *
 * @param isLimitReached whether the query is limited and returned as many rows as its limit, or its
 * limit could not be read. Then which rows are returned may not be determined either, so results with
 * different rows are inconclusive rather than different.
 * @param sortColumns the columns the query sorts its result by, if any (see `getQuerySortColumns()`)
 */
export const compareShadowResults = (
  engine: TDSExecutionResult,
  planner: TDSExecutionResult,
  isLimitReached: boolean,
  sortColumns: string[] = [],
): LegendLitePlannerShadowComparison => {
  const engineColumns = engine.result.columns;
  const plannerColumns = planner.result.columns;
  if (
    engineColumns.length !== plannerColumns.length ||
    engineColumns.some((column, idx) => column !== plannerColumns[idx])
  ) {
    return {
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
      kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.COLUMNS,
    };
  }
  const engineRows = engine.result.rows.map((row) => row.values);
  const plannerRows = planner.result.rows.map((row) => row.values);
  if (engineRows.length !== plannerRows.length) {
    return {
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
      kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.ROW_COUNT,
    };
  }
  const sameOrder = areRowsEqual(engineRows, plannerRows, areCellsEqual);
  if (sameOrder) {
    return {
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH,
      exact: areRowsEqual(engineRows, plannerRows, areCellsIdentical),
      sameOrder,
    };
  }
  const isExactInAnyOrder = areRowsEqual(
    sortRows(engineRows, false),
    sortRows(plannerRows, false),
    areCellsIdentical,
  );
  if (
    isExactInAnyOrder ||
    areRowsEqual(
      sortRows(engineRows, true),
      sortRows(plannerRows, true),
      areCellsEqual,
    )
  ) {
    // the same rows in another order: fine, unless the values of the columns the query sorts by,
    // whose order the query does determine, come in another order
    const sortColumnIndices = sortColumns.map((column) =>
      engineColumns.indexOf(column),
    );
    const sortValuesOf = (rows: Cell[][]): Cell[][] =>
      rows.map((row) => sortColumnIndices.map((idx) => row[idx] as Cell));
    if (
      sortColumnIndices.length &&
      sortColumnIndices.every((idx) => idx >= 0) &&
      !areRowsEqual(
        sortValuesOf(engineRows),
        sortValuesOf(plannerRows),
        areCellsEqual,
      )
    ) {
      return {
        outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
        kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.ORDER,
      };
    }
    return {
      outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.MATCH,
      exact: isExactInAnyOrder,
      sameOrder: false,
    };
  }
  return {
    outcome: isLimitReached
      ? LEGEND_LITE_PLANNER_SHADOW_OUTCOME.INCONCLUSIVE
      : LEGEND_LITE_PLANNER_SHADOW_OUTCOME.DIFFERENT,
    kind: LEGEND_LITE_PLANNER_SHADOW_DIFFERENCE.ROWS,
  };
};

const hasLimit = (query: unknown): boolean => {
  if (Array.isArray(query)) {
    return query.some(hasLimit);
  }
  if (!isPlainObject(query)) {
    return false;
  }
  if (
    query._type === PROTOCOL_TYPE__FUNCTION &&
    isString(query.function) &&
    (matchFunctionName(query.function, DataCubeFunction.SLICE) ||
      matchFunctionName(query.function, DataCubeFunction.LIMIT))
  ) {
    return true;
  }
  return (
    (query._type === PROTOCOL_TYPE__FUNCTION && hasLimit(query.parameters)) ||
    (query._type === PROTOCOL_TYPE__LAMBDA && hasLimit(query.body))
  );
};

/** Whether a query may have left rows out, in which case which rows it returned may not be determined. */
const getLimitReached = (
  query: unknown,
  limit: number | undefined,
  rowCount: number,
): boolean => (limit === undefined ? hasLimit(query) : rowCount >= limit);

const messageOf = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(
    0,
    MAX_MESSAGE_LENGTH,
  );

export type LegendLitePlannerShadowRun = {
  /** The query, as the protocol JSON of its lambda */
  query: unknown;
  /** What the user was shown: the engine's SQL and the result of running it */
  engine: { sql: string; result: TDSExecutionResult };
  /** Asks legend-lite's planner for the SQL of the same query */
  generatePlannerSQL: () => Promise<string>;
  /** Runs a statement on the DuckDB the engine's SQL was run on */
  runSQL: (sql: string) => Promise<TDSExecutionResult>;
  record: (
    record: LegendLitePlannerShadowRecord,
    detail: LegendLitePlannerShadowDetail,
  ) => void;
};

export class LegendLitePlannerShadow {
  private _isRunning = false;

  /**
   * Compares the planner with the engine for one query the user has already been given the result of.
   *
   * NOTE: this never throws, and its promise never rejects: whatever goes wrong here is recorded, since
   * none of it is the user's concern. The caller must not wait for it.
   *
   * A query is not compared (and nothing is recorded) when another comparison is still running, so
   * that shadowing never queues up work behind the user; when it has a pivot with no cast, which stays
   * with the engine in every mode (see `hasCastlessPivot()`); or when its result is too large.
   */
  async run(run: LegendLitePlannerShadowRun): Promise<void> {
    if (
      this._isRunning ||
      hasCastlessPivot(run.query) ||
      run.engine.result.result.rows.length > MAX_ROWS_TO_COMPARE
    ) {
      return;
    }
    this._isRunning = true;
    const detail: LegendLitePlannerShadowDetail = { engineSQL: run.engine.sql };
    const limit = getQueryLimit(run.query);
    const base = {
      columnCount: run.engine.result.result.columns.length,
      engineRowCount: run.engine.result.result.rows.length,
      limit,
    };
    let record: LegendLitePlannerShadowRecord;
    try {
      record = { ...base, ...(await this._compare(run, detail, limit)) };
    } catch (error) {
      // NOTE: we should not get here, as each step catches its own failures
      record = {
        ...base,
        outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.FAILED,
        message: messageOf(error),
      };
    } finally {
      this._isRunning = false;
    }
    try {
      run.record(record, detail);
    } catch {
      // a record that could not be made is not the user's concern either
    }
  }

  private async _compare(
    run: LegendLitePlannerShadowRun,
    detail: LegendLitePlannerShadowDetail,
    limit: number | undefined,
  ): Promise<
    Omit<
      LegendLitePlannerShadowRecord,
      'columnCount' | 'engineRowCount' | 'limit'
    >
  > {
    const planningStart = performance.now();
    let plannerSQL: string;
    try {
      plannerSQL = await run.generatePlannerSQL();
    } catch (error) {
      const isRefusal =
        error instanceof LegendLiteEngineError &&
        error.kind === LEGEND_LITE_ENGINE_ERROR_KIND.REFUSAL;
      return {
        outcome: isRefusal
          ? LEGEND_LITE_PLANNER_SHADOW_OUTCOME.REFUSED
          : LEGEND_LITE_PLANNER_SHADOW_OUTCOME.FAILED,
        kind: isRefusal ? error.kind : LEGEND_LITE_PLANNER_SHADOW_FAILURE.PLAN,
        message: messageOf(error),
      };
    }
    const plannerPlanningTime = performance.now() - planningStart;
    detail.plannerSQL = plannerSQL;

    const executionStart = performance.now();
    let plannerResult: TDSExecutionResult;
    try {
      plannerResult = await run.runSQL(plannerSQL);
    } catch (error) {
      return {
        outcome: LEGEND_LITE_PLANNER_SHADOW_OUTCOME.FAILED,
        kind: LEGEND_LITE_PLANNER_SHADOW_FAILURE.SQL,
        message: messageOf(error),
        plannerPlanningTime,
      };
    }
    const plannerExecutionTime = performance.now() - executionStart;

    const engineRowCount = run.engine.result.result.rows.length;
    return {
      ...compareShadowResults(
        run.engine.result,
        plannerResult,
        // NOTE: a limit we cannot read is taken as reached
        getLimitReached(run.query, limit, engineRowCount),
        getQuerySortColumns(run.query),
      ),
      plannerRowCount: plannerResult.result.rows.length,
      plannerPlanningTime,
      plannerExecutionTime,
    };
  }
}
