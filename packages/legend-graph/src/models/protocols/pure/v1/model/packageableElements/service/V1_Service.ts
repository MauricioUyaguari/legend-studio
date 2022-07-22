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

import { hashArray, type Hashable } from '@finos/legend-shared';
import { CORE_HASH_STRUCTURE } from '../../../../../../../MetaModelConst.js';
import {
  type V1_PackageableElementVisitor,
  V1_PackageableElement,
} from '../../../model/packageableElements/V1_PackageableElement.js';
import type { V1_ServiceExecution } from './V1_ServiceExecution.js';
import type { V1_StereotypePtr } from '../../../model/packageableElements/domain/V1_StereotypePtr.js';
import type { V1_TaggedValue } from '../../../model/packageableElements/domain/V1_TaggedValue.js';
import type { V1_DEPRECATED__ServiceTest } from './V1_DEPRECATED__ServiceTest.js';
import type { V1_TestSuite } from '../../test/V1_TestSuite.js';

export class V1_Service extends V1_PackageableElement implements Hashable {
  stereotypes: V1_StereotypePtr[] = [];
  taggedValues: V1_TaggedValue[] = [];
  pattern!: string;
  owners: string[] = [];
  documentation!: string;
  autoActivateUpdates = true;
  execution!: V1_ServiceExecution;
  test?: V1_DEPRECATED__ServiceTest | undefined;
  testSuites: V1_TestSuite[] = [];

  override get hashCode(): string {
    return hashArray([
      CORE_HASH_STRUCTURE.SERVICE,
      hashArray(this.stereotypes),
      hashArray(this.taggedValues),
      this.path,
      this.pattern,
      hashArray(this.owners),
      this.documentation,
      this.autoActivateUpdates.toString(),
      this.execution,
      this.test ?? '',
      hashArray(this.testSuites),
    ]);
  }

  accept_PackageableElementVisitor<T>(
    visitor: V1_PackageableElementVisitor<T>,
  ): T {
    return visitor.visit_Service(this);
  }
}