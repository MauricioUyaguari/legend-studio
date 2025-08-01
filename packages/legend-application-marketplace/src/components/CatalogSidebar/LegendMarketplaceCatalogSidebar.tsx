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
import { Checkbox, FormControlLabel, FormGroup } from '@mui/material';
import { clsx } from '@finos/legend-art';
import { useLegendMarketplaceBaseStore } from '../../application/LegendMarketplaceFrameworkProvider.js';

export const LegendMarketplaceCatalogSidebar = observer((): JSX.Element => {
  const store = useLegendMarketplaceBaseStore();
  const vendorDataState = store.marketplaceVendorDataState;

  const handleCategoryClick = (category: string): void => {
    vendorDataState.setSelectedCategory(category);
  };

  const handleSourceChange = (source: string, checked: boolean): void => {
    const currentSources = [...vendorDataState.selectedSources];
    if (checked) {
      currentSources.push(source);
    } else {
      const index = currentSources.indexOf(source);
      if (index > -1) {
        currentSources.splice(index, 1);
      }
    }
    vendorDataState.setSelectedSources(currentSources);
  };

  const handleTypeChange = (type: string, checked: boolean): void => {
    const currentTypes = [...vendorDataState.selectedTypes];
    if (checked) {
      currentTypes.push(type);
    } else {
      const index = currentTypes.indexOf(type);
      if (index > -1) {
        currentTypes.splice(index, 1);
      }
    }
    vendorDataState.setSelectedTypes(currentTypes);
  };

  return (
    <div className="legend-marketplace-catalog-sidebar">
      <div className="legend-marketplace-catalog-sidebar__section">
        <h3 className="legend-marketplace-catalog-sidebar__section-title">
          Categories
        </h3>
        <div className="legend-marketplace-catalog-sidebar__categories">
          <div
            className={clsx(
              'legend-marketplace-catalog-sidebar__category-item',
              {
                'legend-marketplace-catalog-sidebar__category-item--active':
                  vendorDataState.selectedCategory === 'all',
              },
            )}
            onClick={() => handleCategoryClick('all')}
          >
            All Categories
          </div>
          {vendorDataState.catalogFilters.categories.map((category) => (
            <div
              key={category}
              className={clsx(
                'legend-marketplace-catalog-sidebar__category-item',
                {
                  'legend-marketplace-catalog-sidebar__category-item--active':
                    vendorDataState.selectedCategory === category,
                },
              )}
              onClick={() => handleCategoryClick(category)}
            >
              {category}
            </div>
          ))}
        </div>
      </div>

      <div className="legend-marketplace-catalog-sidebar__section">
        <h3 className="legend-marketplace-catalog-sidebar__section-title">
          Data Sources
        </h3>
        <FormGroup>
          {vendorDataState.catalogFilters.sources.map((source) => (
            <FormControlLabel
              key={source}
              control={
                <Checkbox
                  checked={vendorDataState.selectedSources.includes(source)}
                  onChange={(e) => handleSourceChange(source, e.target.checked)}
                  size="small"
                />
              }
              label={source}
              className="legend-marketplace-catalog-sidebar__checkbox"
            />
          ))}
        </FormGroup>
      </div>

      <div className="legend-marketplace-catalog-sidebar__section">
        <h3 className="legend-marketplace-catalog-sidebar__section-title">
          Data Types
        </h3>
        <FormGroup>
          {vendorDataState.catalogFilters.types.map((type) => (
            <FormControlLabel
              key={type}
              control={
                <Checkbox
                  checked={vendorDataState.selectedTypes.includes(type)}
                  onChange={(e) => handleTypeChange(type, e.target.checked)}
                  size="small"
                />
              }
              label={type}
              className="legend-marketplace-catalog-sidebar__checkbox"
            />
          ))}
        </FormGroup>
      </div>
    </div>
  );
});
