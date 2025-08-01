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

import {
  DataProduct,
  ProviderResult,
  type Filter,
  type LightDataProduct,
  type MarketplaceServerClient,
} from '@finos/legend-server-marketplace';
import { action, flow, makeObservable, observable } from 'mobx';
import type {
  LegendMarketplaceApplicationStore,
  LegendMarketplaceBaseStore,
} from './LegendMarketplaceBaseStore.js';
import type { GeneratorFn } from '@finos/legend-shared';
import { VendorDataProviderType } from '../pages/VendorData/LegendMarketplaceVendorData.js';

export interface CatalogDataset {
  id: string;
  title: string;
  description: string;
  category: string;
  source: string;
  type: string;
  lastUpdated: string;
  qualityScore: number;
  recordCount: string;
  tags: string[];
}

export interface CatalogStats {
  totalDatasets: number;
  totalTables: number;
  totalReports: number;
  totalSources: number;
}

export interface CatalogFilter {
  categories: string[];
  sources: string[];
  types: string[];
}

export class LegendMarketPlaceVendorDataState {
  readonly applicationStore: LegendMarketplaceApplicationStore;
  readonly store: LegendMarketplaceBaseStore;
  marketplaceServerClient: MarketplaceServerClient;

  responseLimit = 6;

  dataFeedProviders: ProviderResult[] = [];
  terminalProviders: ProviderResult[] = [];
  terminalProvidersAsDataProducts: LightDataProduct[] = [];
  addOnProviders: ProviderResult[] = [];
  dataProducts: DataProduct[] = [];
  homeDataProducts: LightDataProduct[] = [];
  providersFilters: Filter[] = [];

  providerDisplayState: VendorDataProviderType = VendorDataProviderType.ALL;

  catalogDatasets: CatalogDataset[] = [];
  catalogStats: CatalogStats = {
    totalDatasets: 0,
    totalTables: 0,
    totalReports: 0,
    totalSources: 0,
  };
  catalogFilters: CatalogFilter = {
    categories: [],
    sources: [],
    types: [],
  };
  selectedCategory = 'all';
  selectedSources: string[] = [];
  selectedTypes: string[] = [];
  searchSuggestions: string[] = [];
  showDatasetModal = false;
  selectedDataset: CatalogDataset | undefined = undefined;

  constructor(
    applicationStore: LegendMarketplaceApplicationStore,
    store: LegendMarketplaceBaseStore,
  ) {
    makeObservable(this, {
      dataFeedProviders: observable,
      terminalProviders: observable,
      addOnProviders: observable,
      populateProviders: action,
      providerDisplayState: observable,
      setProviderDisplayState: action,
      terminalProvidersAsDataProducts: observable,
      init: flow,
      dataProducts: observable,
      homeDataProducts: observable,
      populateDataProducts: action,
      providersFilters: observable,
      setProvidersFilters: action,
      catalogDatasets: observable,
      catalogStats: observable,
      catalogFilters: observable,
      selectedCategory: observable,
      selectedSources: observable,
      selectedTypes: observable,
      searchSuggestions: observable,
      showDatasetModal: observable,
      selectedDataset: observable,
      setSelectedCategory: action,
      setSelectedSources: action,
      setSelectedTypes: action,
      setSearchSuggestions: action,
      setShowDatasetModal: action,
      setSelectedDataset: action,
      initializeCatalogData: action,
    });

    this.applicationStore = applicationStore;
    this.store = store;
    this.marketplaceServerClient = store.marketplaceServerClient;
  }

  *init(): GeneratorFn<void> {
    try {
      yield this.populateProviders();
      this.terminalProvidersAsDataProducts = this.terminalProviders.map(
        (provider) =>
          ({
            description: provider.description,
            provider: provider.providerName,
            type: 'vendor',
          }) as LightDataProduct,
      );
    } catch (error) {
      this.applicationStore.notificationService.notifyError(
        `Failed to initialize vendors: ${error}`,
      );
    }

    try {
      yield this.populateDataProducts();
      this.homeDataProducts = this.dataProducts.map(
        (product) =>
          ({
            description: product.description,
            provider: product.productName,
            type: product.provider,
          }) as LightDataProduct,
      );
    } catch (error) {
      this.applicationStore.notificationService.notifyError(
        `Failed to initialize data products: ${error}`,
      );
    }

    this.initializeCatalogData();
  }

  setProviderDisplayState(value: VendorDataProviderType): void {
    this.providerDisplayState = value;
  }

  setProvidersFilters(value: Filter[]): void {
    this.providersFilters = value;
    this.populateData();
  }

  populateData(): void {
    this.populateProviders()
      .then(() =>
        this.applicationStore.notificationService.notifySuccess(
          'Data populated successfully.',
        ),
      )
      .catch((error: Error) =>
        this.applicationStore.notificationService.notifyError(
          `Failed to populate Data: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
  }

  setSelectedCategory(category: string): void {
    this.selectedCategory = category;
  }

  setSelectedSources(sources: string[]): void {
    this.selectedSources = sources;
  }

  setSelectedTypes(types: string[]): void {
    this.selectedTypes = types;
  }

  setSearchSuggestions(suggestions: string[]): void {
    this.searchSuggestions = suggestions;
  }

  setShowDatasetModal(show: boolean): void {
    this.showDatasetModal = show;
  }

  setSelectedDataset(dataset: CatalogDataset | undefined): void {
    this.selectedDataset = dataset;
  }

  initializeCatalogData(): void {
    this.catalogDatasets = [
      {
        id: '1',
        title: 'Market Data Feed',
        description:
          'Real-time market data including prices, volumes, and trading activity across global exchanges.',
        category: 'Market Data',
        source: 'Bloomberg',
        type: 'Dataset',
        lastUpdated: '2 hours ago',
        qualityScore: 98,
        recordCount: '2.3M',
        tags: ['real-time', 'trading', 'prices'],
      },
      {
        id: '2',
        title: 'Customer Transaction History',
        description:
          'Comprehensive transaction records for retail and institutional clients.',
        category: 'Customer Data',
        source: 'Internal Systems',
        type: 'Table',
        lastUpdated: '1 day ago',
        qualityScore: 95,
        recordCount: '15.7M',
        tags: ['transactions', 'customers', 'history'],
      },
      {
        id: '3',
        title: 'Risk Analytics Dashboard',
        description:
          'Portfolio risk metrics and stress testing results for investment strategies.',
        category: 'Risk Management',
        source: 'Risk Engine',
        type: 'Report',
        lastUpdated: '3 hours ago',
        qualityScore: 92,
        recordCount: '450K',
        tags: ['risk', 'portfolio', 'analytics'],
      },
      {
        id: '4',
        title: 'Regulatory Compliance Reports',
        description:
          'Automated compliance reporting for regulatory requirements and audit trails.',
        category: 'Compliance',
        source: 'Compliance System',
        type: 'Report',
        lastUpdated: '6 hours ago',
        qualityScore: 97,
        recordCount: '89K',
        tags: ['compliance', 'regulatory', 'audit'],
      },
      {
        id: '5',
        title: 'Trading Volume Analytics',
        description:
          'Historical and real-time trading volume analysis across asset classes.',
        category: 'Market Data',
        source: 'Trading Systems',
        type: 'Dataset',
        lastUpdated: '30 minutes ago',
        qualityScore: 94,
        recordCount: '5.2M',
        tags: ['volume', 'trading', 'analytics'],
      },
      {
        id: '6',
        title: 'Client Portfolio Holdings',
        description:
          'Current portfolio positions and holdings for all client accounts.',
        category: 'Portfolio Management',
        source: 'Portfolio System',
        type: 'Table',
        lastUpdated: '4 hours ago',
        qualityScore: 96,
        recordCount: '1.8M',
        tags: ['portfolio', 'holdings', 'clients'],
      },
    ];

    this.catalogStats = {
      totalDatasets: 847,
      totalTables: 1205,
      totalReports: 342,
      totalSources: 23,
    };

    this.catalogFilters = {
      categories: [
        'Market Data',
        'Customer Data',
        'Risk Management',
        'Compliance',
        'Portfolio Management',
      ],
      sources: [
        'Bloomberg',
        'Internal Systems',
        'Risk Engine',
        'Compliance System',
        'Trading Systems',
        'Portfolio System',
      ],
      types: ['Dataset', 'Table', 'Report'],
    };
  }

  async populateProviders(): Promise<void> {
    try {
      const filters: string = this.providersFilters
        .map((filter) => `&${filter.label}=${encodeURIComponent(filter.value)}`)
        .join('');
      this.dataFeedProviders = (
        await this.marketplaceServerClient.getVendorsByCategory(
          encodeURIComponent('Periodic Datafeed'),
          filters,
          this.responseLimit,
        )
      ).map((json) => ProviderResult.serialization.fromJson(json));

      this.terminalProviders = (
        await this.marketplaceServerClient.getVendorsByCategory(
          encodeURIComponent('Desktop'),
          filters,
          this.responseLimit,
        )
      ).map((json) => ProviderResult.serialization.fromJson(json));

      this.addOnProviders = (
        await this.marketplaceServerClient.getVendorsByCategory(
          encodeURIComponent('Add-on'),
          filters,
          this.responseLimit,
        )
      ).map((json) => ProviderResult.serialization.fromJson(json));
    } catch (error) {
      this.applicationStore.notificationService.notifyError(
        `Failed to fetch vendors: ${error}`,
      );
    }
  }

  async populateDataProducts(): Promise<void> {
    try {
      this.dataProducts = (
        await this.marketplaceServerClient.getDataProducts(this.responseLimit)
      ).map((json) => DataProduct.serialization.fromJson(json));
    } catch (error) {
      this.applicationStore.notificationService.notifyError(
        `Failed to fetch data products: ${error}`,
      );
    }
  }
}
