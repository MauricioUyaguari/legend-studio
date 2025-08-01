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
import { LegendMarketplaceSearchBar } from '../../components/SearchBar/LegendMarketplaceSearchBar.js';
import { useApplicationStore } from '@finos/legend-application';
import {
  generateSearchResultsRoute,
  generateVendorDetailsRoute,
} from '../../__lib__/LegendMarketplaceNavigation.js';
import type { LightDataProduct } from '@finos/legend-server-marketplace';
import { LegendMarketplaceLightDataProductCard } from '../../components/DataProductCard/LegendMarketplaceLightDataProductCard.js';
import { Grid2 as Grid } from '@mui/material';
import { LegendMarketplacePage } from '../LegendMarketplacePage.js';
import { useLegendMarketplaceBaseStore } from '../../application/LegendMarketplaceFrameworkProvider.js';
import { useEffect, useState } from 'react';
import { LegendMarketplaceCatalogSidebar } from '../../components/CatalogSidebar/LegendMarketplaceCatalogSidebar.js';
import { LegendMarketplaceCatalogCard } from '../../components/CatalogCard/LegendMarketplaceCatalogCard.js';
import { LegendMarketplaceCatalogModal } from '../../components/CatalogModal/LegendMarketplaceCatalogModal.js';
import { LegendMarketplaceCatalogStats } from '../../components/CatalogStats/LegendMarketplaceCatalogStats.js';
import type { CatalogDataset } from '../../stores/LegendMarketPlaceVendorDataState.js';

export const LegendMarketplaceHome = observer(() => {
  const applicationStore = useApplicationStore();
  const store = useLegendMarketplaceBaseStore();
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareDataset, setShareDataset] = useState<CatalogDataset | undefined>(
    undefined,
  );

  const onSearch = (
    provider: string | undefined,
    query: string | undefined,
  ): void => {
    applicationStore.navigationService.navigator.goToLocation(
      generateSearchResultsRoute(provider, query),
    );
  };

  const handleDatasetClick = (dataset: CatalogDataset): void => {
    store.marketplaceVendorDataState.setSelectedDataset(dataset);
    store.marketplaceVendorDataState.setShowDatasetModal(true);
  };

  const handleDatasetShare = (dataset: CatalogDataset): void => {
    setShareDataset(dataset);
    setShowShareModal(true);
  };

  const handleModalClose = (): void => {
    store.marketplaceVendorDataState.setShowDatasetModal(false);
    store.marketplaceVendorDataState.setSelectedDataset(undefined);
  };

  const handleShareModalClose = (): void => {
    setShowShareModal(false);
    setShareDataset(undefined);
  };

  const getFilteredDatasets = (): CatalogDataset[] => {
    const vendorDataState = store.marketplaceVendorDataState;
    let filtered = [...vendorDataState.catalogDatasets];

    if (vendorDataState.selectedCategory !== 'all') {
      filtered = filtered.filter(
        (dataset) => dataset.category === vendorDataState.selectedCategory,
      );
    }

    if (vendorDataState.selectedSources.length > 0) {
      filtered = filtered.filter((dataset) =>
        vendorDataState.selectedSources.includes(dataset.source),
      );
    }

    if (vendorDataState.selectedTypes.length > 0) {
      filtered = filtered.filter((dataset) =>
        vendorDataState.selectedTypes.includes(dataset.type),
      );
    }

    return filtered;
  };

  useEffect(() => {
    store.marketplaceVendorDataState.init();
  }, [store.marketplaceVendorDataState]);

  return (
    <LegendMarketplacePage className="legend-marketplace-home">
      <div className="legend-marketplace-home__landing">
        <div className="legend-marketplace-home__landing__title">
          <h1>
            <span style={{ color: '#76A1E3' }}>All data in </span>
            <span style={{ color: 'white' }}>One Place</span>
          </h1>
        </div>
        <div className="legend-marketplace-home__landing__description">
          <h3>Discover the right data and accelerate analytic productivity.</h3>
        </div>
        <div className="legend-marketplace-home__landing__search-bar">
          <LegendMarketplaceSearchBar onSearch={onSearch} />
        </div>
        <div className="legend-marketplace-home__landing__stats">
          <LegendMarketplaceCatalogStats />
        </div>
      </div>

      <div className="legend-marketplace-home__catalog">
        <div className="legend-marketplace-home__catalog__sidebar">
          <LegendMarketplaceCatalogSidebar />
        </div>

        <div className="legend-marketplace-home__catalog__content">
          <div className="legend-marketplace-home__catalog__header">
            <h2>Featured Datasets</h2>
            <p>Explore our curated collection of high-quality data assets</p>
          </div>

          <div className="legend-marketplace-home__catalog__cards">
            <Grid
              container={true}
              spacing={{ xs: 2, md: 3 }}
              columns={{ xs: 1, sm: 2, lg: 3 }}
            >
              {getFilteredDatasets().map((dataset) => (
                <Grid key={dataset.id} size={1}>
                  <LegendMarketplaceCatalogCard
                    dataset={dataset}
                    onClick={handleDatasetClick}
                    onShare={handleDatasetShare}
                  />
                </Grid>
              ))}
            </Grid>
          </div>
        </div>
      </div>

      <div className="legend-marketplace-home__vendors-title">
        <h3>Explore our Solutions</h3>
      </div>
      <div className="legend-marketplace-home__vendors-cards">
        <Grid
          container={true}
          spacing={{ xs: 2, md: 3, xl: 4 }}
          columns={{ xs: 1, sm: 2, md: 3, xl: 6 }}
          sx={{ justifyContent: 'center' }}
        >
          {store.marketplaceVendorDataState.terminalProvidersAsDataProducts.map(
            (asset) => (
              <Grid
                key={`${asset.provider}.${asset.type}.${asset.description}`}
                size={1}
              >
                <LegendMarketplaceLightDataProductCard
                  dataAsset={asset}
                  onClick={(dataAsset: LightDataProduct) => {
                    applicationStore.navigationService.navigator.goToLocation(
                      generateVendorDetailsRoute(dataAsset.provider),
                    );
                  }}
                />
              </Grid>
            ),
          )}
        </Grid>
      </div>

      <LegendMarketplaceCatalogModal
        open={store.marketplaceVendorDataState.showDatasetModal}
        dataset={store.marketplaceVendorDataState.selectedDataset}
        onClose={handleModalClose}
        onShare={handleDatasetShare}
      />

      <LegendMarketplaceCatalogModal
        open={showShareModal}
        dataset={shareDataset}
        onClose={handleShareModalClose}
        onShare={() => {
          applicationStore.notificationService.notifySuccess(
            'Share link copied to clipboard!',
          );
          handleShareModalClose();
        }}
      />
    </LegendMarketplacePage>
  );
});
