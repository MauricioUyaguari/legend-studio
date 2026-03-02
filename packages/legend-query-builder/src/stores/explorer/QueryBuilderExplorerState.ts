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
import { createRef } from 'react';
import type { TreeData } from '@finos/legend-art';
import type { Type } from '@finos/legend-graph';
import type { QueryBuilderState } from '../QueryBuilderState.js';

export enum QUERY_BUILDER_EXPLORER_TREE_DND_TYPE {
  ROOT = 'ROOT',
  CLASS_PROPERTY = 'CLASS_PROPERTY',
  ENUM_PROPERTY = 'ENUM_PROPERTY',
  PRIMITIVE_PROPERTY = 'PRIMITIVE_PROPERTY',
  RELATION_COLUMN = 'RELATION_COLUMN',
}
// Base class for explorer tree node data

export abstract class QueryBuilderExplorerTreeNodeData {
  isSelected?: boolean | undefined;
  isOpen?: boolean | undefined;
  isHighlighting?: boolean | undefined;
  id: string;
  label: string;
  dndText: string;
  childrenIds: string[] = [];
  type: Type;
  /**
   * We need a ref to the tree node element so that we can handle scroll to the element
   * when we reveal the node in the tree.
   */
  elementRef = createRef<HTMLDivElement>();

  constructor(id: string, label: string, dndText: string, type: Type) {
    makeObservable(this, {
      isSelected: observable,
      isOpen: observable,
      isHighlighting: observable,
      setIsSelected: action,
      setIsOpen: action,
      setIsHighlighting: action,
    });

    this.id = id;
    this.label = label;
    this.dndText = dndText;
    this.type = type;
  }

  setIsSelected(val: boolean | undefined): void {
    this.isSelected = val;
  }

  setIsOpen(val: boolean | undefined): void {
    this.isOpen = val;
  }

  setIsHighlighting(val: boolean | undefined): void {
    this.isHighlighting = val;
  }
}

export interface QueryBuilderExplorerTreeDragSource {
  node: QueryBuilderExplorerTreeNodeData;
}

export abstract class QueryBuilderExplorerState<
  T extends QueryBuilderExplorerTreeNodeData = QueryBuilderExplorerTreeNodeData,
> {
  readonly queryBuilderState: QueryBuilderState;
  treeData?: TreeData<T> | undefined;

  constructor(queryBuilderState: QueryBuilderState) {
    this.queryBuilderState = queryBuilderState;
  }

  get nonNullableTreeData(): TreeData<T> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.treeData!;
  }

  abstract refreshTreeData(): void;
  abstract humanizePropertyName: boolean;
}
