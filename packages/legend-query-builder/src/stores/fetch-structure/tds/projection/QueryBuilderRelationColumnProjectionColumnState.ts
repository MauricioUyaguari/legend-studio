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

import { computed, makeObservable, observable } from 'mobx';
import { hashArray, type Hashable } from '@finos/legend-shared';
import type {
  Type,
  RelationColumn,
  VariableExpression,
} from '@finos/legend-graph';
import { QueryBuilderProjectionColumnState } from './QueryBuilderProjectionColumnState.js';
import type { QueryBuilderTDSState } from '../QueryBuilderTDSState.js';
import { QUERY_BUILDER_STATE_HASH_STRUCTURE } from '../../../QueryBuilderStateHashUtils.js';

/**
 * Projection column state for a RelationColumn.
 * Created when dragging a RelationColumn from the explorer tree to the projection panel.
 */
export class QueryBuilderRelationColumnProjectionColumnState
  extends QueryBuilderProjectionColumnState
  implements Hashable
{
  readonly relationColumn: RelationColumn;

  constructor(tdsState: QueryBuilderTDSState, relationColumn: RelationColumn) {
    super(tdsState, relationColumn.name);

    makeObservable(this, {
      relationColumn: observable,
      hashCode: computed,
    });

    this.relationColumn = relationColumn;
  }

  override getColumnType(): Type | undefined {
    return this.relationColumn.genericType.value.rawType;
  }

  // Relation columns don't use variables in the same way as property expressions
  isVariableUsed(_variable: VariableExpression): boolean {
    return false;
  }

  get hashCode(): string {
    return hashArray([
      QUERY_BUILDER_STATE_HASH_STRUCTURE.SIMPLE_PROJECTION_COLUMN_STATE,
      this.relationColumn.name,
      this.columnName,
    ]);
  }
}
