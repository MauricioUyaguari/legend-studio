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

import { action, makeObservable, observable } from 'mobx';
import type { TreeData } from '@finos/legend-art';
import type { RelationType, RelationColumn } from '@finos/legend-graph';
import type { QueryBuilderState } from '../QueryBuilderState.js';
import {
  QueryBuilderExplorerTreeNodeData,
  QueryBuilderExplorerState,
} from './QueryBuilderExplorerState.js';

/**
 * Tree node data for a relation column in the explorer tree.
 * This is a leaf node (no children) representing a column from a RelationType.
 */
export class QueryBuilderExplorerTreeRelationColumnNodeData extends QueryBuilderExplorerTreeNodeData {
  readonly relationColumn: RelationColumn;

  constructor(relationColumn: RelationColumn) {
    super(
      relationColumn.name,
      relationColumn.name,
      relationColumn.name,
      relationColumn.genericType.value.rawType,
    );
    makeObservable(this, {
      isSelected: observable,
      setIsSelected: action,
    });
    this.relationColumn = relationColumn;
  }
}

/**
 * Drag source for relation column nodes in the explorer tree.
 */
export interface QueryBuilderRelationColumnDragSource {
  node: QueryBuilderExplorerTreeRelationColumnNodeData;
}

/**
 * Explorer state for RelationType sources.
 * Provides a flat, one-level tree of RelationColumn nodes.
 */
export class QueryBuilderRelationExplorerState extends QueryBuilderExplorerState<QueryBuilderExplorerTreeRelationColumnNodeData> {
  override humanizePropertyName = false;

  constructor(queryBuilderState: QueryBuilderState) {
    super(queryBuilderState);
    makeObservable(this, {
      treeData: observable.ref,
      setTreeData: action,
      refreshTreeData: action,
    });
  }

  setTreeData(
    val: TreeData<QueryBuilderExplorerTreeRelationColumnNodeData> | undefined,
  ): void {
    this.treeData = val;
  }

  refreshTreeData(): void {
    const relationType = this.queryBuilderState.relationType;
    if (relationType) {
      this.setTreeData(this.buildTreeData(relationType));
    } else {
      this.setTreeData(undefined);
    }
  }

  private buildTreeData(
    relationType: RelationType,
  ): TreeData<QueryBuilderExplorerTreeRelationColumnNodeData> {
    const rootIds: string[] = [];
    const nodes = new Map<
      string,
      QueryBuilderExplorerTreeRelationColumnNodeData
    >();

    relationType.columns.forEach((column: RelationColumn) => {
      const node = new QueryBuilderExplorerTreeRelationColumnNodeData(column);
      rootIds.push(node.id);
      nodes.set(node.id, node);
    });

    return { rootIds, nodes };
  }
}
