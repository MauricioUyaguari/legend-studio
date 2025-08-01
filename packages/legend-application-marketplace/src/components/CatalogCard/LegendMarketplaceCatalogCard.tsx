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

import { type JSX } from 'react';
import { Chip, Button } from '@mui/material';
import { clsx } from '@finos/legend-art';
import { LegendMarketplaceCard } from '../MarketplaceCard/LegendMarketplaceCard.js';
import type { CatalogDataset } from '../../stores/LegendMarketPlaceVendorDataState.js';

export const LegendMarketplaceCatalogCard = (props: {
  dataset: CatalogDataset;
  onClick: (dataset: CatalogDataset) => void;
  onShare: (dataset: CatalogDataset) => void;
}): JSX.Element => {
  const { dataset, onClick, onShare } = props;

  const getQualityColor = (score: number): string => {
    if (score >= 95) {
      return 'success';
    }
    if (score >= 85) {
      return 'warning';
    }
    return 'error';
  };

  const content = (
    <div className="legend-marketplace-catalog-card__content">
      <div className="legend-marketplace-catalog-card__header">
        <Chip
          label={dataset.type}
          size="small"
          className="legend-marketplace-catalog-card__type-chip"
        />
        <div className="legend-marketplace-catalog-card__quality">
          <span
            className={clsx(
              'legend-marketplace-catalog-card__quality-score',
              `legend-marketplace-catalog-card__quality-score--${getQualityColor(dataset.qualityScore)}`,
            )}
          >
            {dataset.qualityScore}%
          </span>
        </div>
      </div>

      <h3 className="legend-marketplace-catalog-card__title">
        {dataset.title}
      </h3>

      <p className="legend-marketplace-catalog-card__description">
        {dataset.description.length > 120
          ? `${dataset.description.substring(0, 120)}...`
          : dataset.description}
      </p>

      <div className="legend-marketplace-catalog-card__metadata">
        <div className="legend-marketplace-catalog-card__metadata-item">
          <span className="legend-marketplace-catalog-card__metadata-label">
            Source:
          </span>
          <span className="legend-marketplace-catalog-card__metadata-value">
            {dataset.source}
          </span>
        </div>
        <div className="legend-marketplace-catalog-card__metadata-item">
          <span className="legend-marketplace-catalog-card__metadata-label">
            Records:
          </span>
          <span className="legend-marketplace-catalog-card__metadata-value">
            {dataset.recordCount}
          </span>
        </div>
        <div className="legend-marketplace-catalog-card__metadata-item">
          <span className="legend-marketplace-catalog-card__metadata-label">
            Updated:
          </span>
          <span className="legend-marketplace-catalog-card__metadata-value">
            {dataset.lastUpdated}
          </span>
        </div>
      </div>

      <div className="legend-marketplace-catalog-card__tags">
        {dataset.tags.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            variant="outlined"
            className="legend-marketplace-catalog-card__tag"
          />
        ))}
      </div>
    </div>
  );

  const actions = (
    <div className="legend-marketplace-catalog-card__actions">
      <Button
        size="small"
        variant="outlined"
        onClick={(e) => {
          e.stopPropagation();
          onShare(dataset);
        }}
      >
        Share
      </Button>
      <Button size="small" variant="contained" onClick={() => onClick(dataset)}>
        View Details
      </Button>
    </div>
  );

  return (
    <LegendMarketplaceCard
      content={content}
      actions={actions}
      size="large"
      className="legend-marketplace-catalog-card"
    />
  );
};
