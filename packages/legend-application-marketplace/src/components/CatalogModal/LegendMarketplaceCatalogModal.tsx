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
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Typography,
  Divider,
} from '@mui/material';
import { clsx } from '@finos/legend-art';
import type { CatalogDataset } from '../../stores/LegendMarketPlaceVendorDataState.js';

export const LegendMarketplaceCatalogModal = (props: {
  open: boolean;
  dataset: CatalogDataset | undefined;
  onClose: () => void;
  onShare: (dataset: CatalogDataset) => void;
}): JSX.Element => {
  const { open, dataset, onClose, onShare } = props;

  if (!dataset) {
    return <></>;
  }

  const getQualityColor = (score: number): string => {
    if (score >= 95) {
      return 'success';
    }
    if (score >= 85) {
      return 'warning';
    }
    return 'error';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth={true}
      className="legend-marketplace-catalog-modal"
    >
      <DialogTitle className="legend-marketplace-catalog-modal__title">
        <div className="legend-marketplace-catalog-modal__title-content">
          <Typography variant="h5" component="h2">
            {dataset.title}
          </Typography>
          <div className="legend-marketplace-catalog-modal__title-badges">
            <Chip
              label={dataset.type}
              size="small"
              className="legend-marketplace-catalog-modal__type-chip"
            />
            <span
              className={clsx(
                'legend-marketplace-catalog-modal__quality-score',
                `legend-marketplace-catalog-modal__quality-score--${getQualityColor(dataset.qualityScore)}`,
              )}
            >
              Quality: {dataset.qualityScore}%
            </span>
          </div>
        </div>
      </DialogTitle>

      <DialogContent className="legend-marketplace-catalog-modal__content">
        <Typography variant="body1" paragraph={true}>
          {dataset.description}
        </Typography>

        <Divider className="legend-marketplace-catalog-modal__divider" />

        <div className="legend-marketplace-catalog-modal__metadata">
          <div className="legend-marketplace-catalog-modal__metadata-grid">
            <div className="legend-marketplace-catalog-modal__metadata-item">
              <Typography
                variant="subtitle2"
                className="legend-marketplace-catalog-modal__metadata-label"
              >
                Category
              </Typography>
              <Typography variant="body2">{dataset.category}</Typography>
            </div>

            <div className="legend-marketplace-catalog-modal__metadata-item">
              <Typography
                variant="subtitle2"
                className="legend-marketplace-catalog-modal__metadata-label"
              >
                Data Source
              </Typography>
              <Typography variant="body2">{dataset.source}</Typography>
            </div>

            <div className="legend-marketplace-catalog-modal__metadata-item">
              <Typography
                variant="subtitle2"
                className="legend-marketplace-catalog-modal__metadata-label"
              >
                Record Count
              </Typography>
              <Typography variant="body2">
                {dataset.recordCount} records
              </Typography>
            </div>

            <div className="legend-marketplace-catalog-modal__metadata-item">
              <Typography
                variant="subtitle2"
                className="legend-marketplace-catalog-modal__metadata-label"
              >
                Last Updated
              </Typography>
              <Typography variant="body2">{dataset.lastUpdated}</Typography>
            </div>
          </div>
        </div>

        <Divider className="legend-marketplace-catalog-modal__divider" />

        <div className="legend-marketplace-catalog-modal__tags">
          <Typography
            variant="subtitle2"
            className="legend-marketplace-catalog-modal__tags-title"
          >
            Tags
          </Typography>
          <div className="legend-marketplace-catalog-modal__tags-list">
            {dataset.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                className="legend-marketplace-catalog-modal__tag"
              />
            ))}
          </div>
        </div>
      </DialogContent>

      <DialogActions className="legend-marketplace-catalog-modal__actions">
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button
          onClick={() => onShare(dataset)}
          variant="contained"
          color="primary"
        >
          Share Dataset
        </Button>
      </DialogActions>
    </Dialog>
  );
};
