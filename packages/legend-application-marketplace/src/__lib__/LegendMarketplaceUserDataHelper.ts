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

import type { UserDataService } from '@finos/legend-application';
import type { DataProductFilterConfig } from '../stores/lakehouse/MarketplaceLakehouseStore.js';

export enum LEGEND_MARKETPLACE_USER_DATA_KEY {
  DATA_PRODUCT_FILTER_CONFIG = 'home.data-product.filter-config',
}

export class LegendMarketplaceUserDataHelper {
  static getSavedDataProductFilterConfig(
    service: UserDataService,
  ): DataProductFilterConfig | undefined {
    return service.getObjectValue(
      LEGEND_MARKETPLACE_USER_DATA_KEY.DATA_PRODUCT_FILTER_CONFIG,
    ) as DataProductFilterConfig | undefined;
  }

  static saveDataProductFilterConfig(
    service: UserDataService,
    dataProductFilterConfig: DataProductFilterConfig,
  ): void {
    service.persistValue(
      LEGEND_MARKETPLACE_USER_DATA_KEY.DATA_PRODUCT_FILTER_CONFIG,
      dataProductFilterConfig,
    );
  }
}
