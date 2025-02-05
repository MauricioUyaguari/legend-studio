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

import type { DataCubeColumn } from '../model/DataCubeColumn.js';
import { DataCubeQueryAggregateOperation } from './DataCubeQueryAggregateOperation.js';
import {
  DataCubeQueryAggregateOperator,
  DataCubeColumnDataType,
  DataCubeFunction,
  ofDataType,
} from '../DataCubeQueryEngine.js';
import { _aggCol_basic } from '../DataCubeQueryBuilderUtils.js';
import type { DataCubeColumnConfiguration } from '../model/DataCubeConfiguration.js';

export class DataCubeQueryAggregateOperation__Count extends DataCubeQueryAggregateOperation {
  override get label() {
    return 'count';
  }

  override get textLabel() {
    return 'count';
  }

  override get description() {
    return 'count';
  }

  override get operator() {
    return DataCubeQueryAggregateOperator.COUNT;
  }

  isCompatibleWithColumn(column: DataCubeColumn) {
    return ofDataType(column.type, [
      // NOTE: technically all data types are suported,
      // but we can't because we must preserve the type
      // of the original column
      //
      // typically, what users usually do is to create a "dummy"
      // extended column of value=1 and aggregate on that for the count

      DataCubeColumnDataType.NUMBER,
    ]);
  }

  buildAggregateColumn(column: DataCubeColumnConfiguration) {
    return _aggCol_basic(column, DataCubeFunction.COUNT);
  }
}
