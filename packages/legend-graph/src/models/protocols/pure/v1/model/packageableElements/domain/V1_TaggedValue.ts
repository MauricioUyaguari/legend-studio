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
import type { V1_TagPtr } from '../../../model/packageableElements/domain/V1_TagPtr.js';

export class V1_TaggedValue implements Hashable {
  tag!: V1_TagPtr;
  value!: string;

  get hashCode(): string {
    return hashArray([CORE_HASH_STRUCTURE.TAGGED_VALUE, this.tag, this.value]);
  }
}