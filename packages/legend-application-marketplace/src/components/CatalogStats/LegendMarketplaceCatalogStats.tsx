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

import { observer } from 'mobx-react-lite';
import { type JSX } from 'react';
import { useLegendMarketplaceBaseStore } from '../../application/LegendMarketplaceFrameworkProvider.js';

export const LegendMarketplaceCatalogStats = observer((): JSX.Element => {
  const store = useLegendMarketplaceBaseStore();
  const stats = store.marketplaceVendorDataState.catalogStats;

  return (
    <div className="legend-marketplace-catalog-stats">
      <div className="legend-marketplace-catalog-stats__item">
        <div className="legend-marketplace-catalog-stats__number">
          {stats.totalDatasets.toLocaleString()}
        </div>
        <div className="legend-marketplace-catalog-stats__label">Datasets</div>
      </div>
      <div className="legend-marketplace-catalog-stats__item">
        <div className="legend-marketplace-catalog-stats__number">
          {stats.totalTables.toLocaleString()}
        </div>
        <div className="legend-marketplace-catalog-stats__label">Tables</div>
      </div>
      <div className="legend-marketplace-catalog-stats__item">
        <div className="legend-marketplace-catalog-stats__number">
          {stats.totalReports.toLocaleString()}
        </div>
        <div className="legend-marketplace-catalog-stats__label">Reports</div>
      </div>
      <div className="legend-marketplace-catalog-stats__item">
        <div className="legend-marketplace-catalog-stats__number">
          {stats.totalSources}
        </div>
        <div className="legend-marketplace-catalog-stats__label">Sources</div>
      </div>
    </div>
  );
});
