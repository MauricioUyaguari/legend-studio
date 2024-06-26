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

import { action, computed, makeObservable, observable } from 'mobx';
import type { DataCubeState } from '../DataCubeState.js';
import type {
  DataCubeQuerySnapshot,
  DataCubeQuerySnapshotColumn,
  DataCubeQuerySnapshotSortColumn,
} from '../core/DataCubeQuerySnapshot.js';
import type { DataCubeQueryEditorSubState } from './DataCubeEditorQuerySnapshotBuilder.js';
import { deepEqual } from '@finos/legend-shared';
import { DATA_CUBE_COLUMN_SORT_DIRECTION } from '../DataCubeMetaModelConst.js';

export class DataCubeEditorSortColumnState {
  readonly column: DataCubeQuerySnapshotColumn;
  direction: DATA_CUBE_COLUMN_SORT_DIRECTION;

  constructor(
    column: DataCubeQuerySnapshotColumn,
    direction: DATA_CUBE_COLUMN_SORT_DIRECTION,
  ) {
    makeObservable(this, {
      direction: observable,
      setDirection: action,
    });

    this.column = column;
    this.direction = direction;
  }

  setDirection(val: DATA_CUBE_COLUMN_SORT_DIRECTION): void {
    this.direction = val;
  }
}

export class DataCubeEditorSortState implements DataCubeQueryEditorSubState {
  readonly dataCubeState!: DataCubeState;

  availableColumns: DataCubeEditorSortColumnState[] = [];
  selectedColumns: DataCubeEditorSortColumnState[] = [];
  availableColumnsSearchText = '';
  selectedColumnsSearchText = '';

  constructor(dataCubeState: DataCubeState) {
    this.dataCubeState = dataCubeState;

    makeObservable(this, {
      availableColumns: observable,
      selectedColumns: observable,
      availableColumnsSearchText: observable,
      selectedColumnsSearchText: observable,
      setAvailableColumns: action,
      setSelectedColumns: action,
      addAvailableColumn: action,
      addSelectedColumn: action,
      addAllAvailableColumns: action,
      addAllSelectedColumns: action,
      setSelectedColumnsSearchText: action,
      setAvailableColumnsSearchText: action,
      availableColumnsSearchResults: computed,
      selectedColumnsSearchResults: computed,
    });
  }

  setAvailableColumns(val: DataCubeEditorSortColumnState[]): void {
    this.availableColumns = val;
  }

  setSelectedColumns(val: DataCubeEditorSortColumnState[]): void {
    this.selectedColumns = val;
  }

  addAvailableColumn(columnName: string): void {
    const column = this.availableColumns.find(
      (col) => col.column.name === columnName,
    );
    if (column) {
      this.setAvailableColumns(
        this.availableColumns.filter((col) => col.column.name !== columnName),
      );
      this.setSelectedColumns(this.selectedColumns.concat(column));
    }
  }

  addSelectedColumn(columnName: string): void {
    const column = this.selectedColumns.find(
      (col) => col.column.name === columnName,
    );
    if (column) {
      this.setSelectedColumns(
        this.selectedColumns.filter((col) => col.column.name !== columnName),
      );
      this.setAvailableColumns(this.availableColumns.concat(column));
    }
  }

  addAllAvailableColumns(): void {
    this.setSelectedColumns(this.selectedColumns.concat(this.availableColumns));
    this.setAvailableColumns([]);
  }

  addAllSelectedColumns(): void {
    this.setAvailableColumns(
      this.availableColumns.concat(this.selectedColumns),
    );
    this.setSelectedColumns([]);
  }

  setAvailableColumnsSearchText(val: string): void {
    this.availableColumnsSearchText = val;
  }

  setSelectedColumnsSearchText(val: string): void {
    this.selectedColumnsSearchText = val;
  }

  get availableColumnsSearchResults(): DataCubeEditorSortColumnState[] {
    if (this.availableColumnsSearchText) {
      return this.availableColumns.filter((col) =>
        col.column.name
          .toLowerCase()
          .includes(this.availableColumnsSearchText.toLowerCase()),
      );
    } else {
      return this.availableColumns;
    }
  }

  get selectedColumnsSearchResults(): DataCubeEditorSortColumnState[] {
    if (this.selectedColumnsSearchText) {
      return this.selectedColumns.filter((col) =>
        col.column.name
          .toLowerCase()
          .includes(this.selectedColumnsSearchText.toLowerCase()),
      );
    } else {
      return this.selectedColumns;
    }
  }

  applySnaphot(snapshot: DataCubeQuerySnapshot): void {
    const sortColumns = snapshot.sortColumns;
    this.setAvailableColumns(
      snapshot.columns
        .filter(
          (col) => !sortColumns.find((sortCol) => sortCol.name === col.name),
        )
        .map(
          (col) =>
            new DataCubeEditorSortColumnState(
              col,
              DATA_CUBE_COLUMN_SORT_DIRECTION.ASCENDING,
            ),
        ),
    );
    this.setSelectedColumns(
      sortColumns.map(
        (sortCol) =>
          new DataCubeEditorSortColumnState(
            snapshot.columns.find((col) => col.name === sortCol.name)!,
            sortCol.direction,
          ),
      ),
    );
  }

  buildSnapshot(
    newSnapshot: DataCubeQuerySnapshot,
    baseSnapshot: DataCubeQuerySnapshot,
  ): boolean {
    const newSortColumns: DataCubeQuerySnapshotSortColumn[] =
      this.selectedColumns.map((sortInfo) => ({
        name: sortInfo.column.name,
        type: sortInfo.column.type,
        direction: sortInfo.direction,
      }));

    if (!deepEqual(newSortColumns, baseSnapshot.sortColumns)) {
      newSnapshot.sortColumns = newSortColumns;
      return true;
    }
    return false;
  }
}
