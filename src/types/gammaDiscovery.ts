export interface GammaTagResponse {
  id?: string | number;
  slug?: string | null;
  label?: string | null;
  name?: string | null;
  forceShow?: boolean;
  updatedAt?: string | null;
  requiresTranslation?: boolean;
}

export interface GammaSeriesResponse {
  id?: string | number | null;
  ticker?: string | null;
  slug?: string | null;
  title?: string | null;
  seriesType?: string | null;
  recurrence?: string | null;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  layout?: string | null;
  active?: boolean | null;
  closed?: boolean | null;
  archived?: boolean | null;
  new?: boolean | null;
  featured?: boolean | null;
  restricted?: boolean | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  startDate?: string | null;
  commentCount?: number | null;
  requiresTranslation?: boolean | null;
}

export interface GammaSportResponse {
  id?: number | null;
  sport?: string | null;
  image?: string | null;
  resolution?: string | null;
  ordering?: string | null;
  tags?: string | null;
  series?: string | null;
  createdAt?: string | null;
}

export interface GammaEventMarketResponse {
  id?: string | number | null;
  question?: string | null;
  conditionId?: string | null;
  slug?: string | null;
  resolutionSource?: string | null;
  endDate?: string | null;
  category?: string | null;
  liquidity?: string | number | null;
  startDate?: string | null;
  fee?: string | null;
  image?: string | null;
  icon?: string | null;
  description?: string | null;
  outcomes?: string | null;
  outcomePrices?: string | null;
  volume?: string | number | null;
  active?: boolean | null;
  marketType?: string | null;
  closed?: boolean | null;
  archived?: boolean | null;
  clobTokenIds?: string | null;
  negRisk?: boolean | null;
  negRiskOther?: boolean | null;
  enableOrderBook?: boolean | null;
  ready?: boolean | null;
  funded?: boolean | null;
  accepting_orders?: boolean | null;
  acceptingOrders?: boolean | null;
}

export interface GammaEventResponse {
  id?: string | number | null;
  ticker?: string | null;
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  resolutionSource?: string | null;
  startDate?: string | null;
  creationDate?: string | null;
  endDate?: string | null;
  image?: string | null;
  icon?: string | null;
  active?: boolean | null;
  closed?: boolean | null;
  archived?: boolean | null;
  new?: boolean | null;
  featured?: boolean | null;
  restricted?: boolean | null;
  liquidity?: number | string | null;
  volume?: number | string | null;
  openInterest?: number | string | null;
  sortBy?: string | null;
  category?: string | null;
  subcategory?: string | null;
  published_at?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  competitive?: number | string | null;
  volume24hr?: number | string | null;
  volume1wk?: number | string | null;
  volume1mo?: number | string | null;
  volume1yr?: number | string | null;
  liquidityAmm?: number | string | null;
  liquidityClob?: number | string | null;
  commentCount?: number | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  series?: GammaSeriesResponse[] | null;
  tags?: Array<string | GammaTagResponse> | null;
  markets?: GammaEventMarketResponse[] | null;
  seriesSlug?: string | null;
  enableNegRisk?: boolean | null;
  negRiskAugmented?: boolean | null;
  pendingDeployment?: boolean | null;
  deploying?: boolean | null;
  requiresTranslation?: boolean | null;
}

export interface GammaDiscoveredCandidate {
  source: "gamma-event-market";
  id: string;
  eventId: string | null;
  marketId: string | null;
  conditionId: string | null;
  slug: string | null;
  question: string | null;
  title: string | null;
  tags: string[];
  startTime: string | null;
  active: boolean | null;
  closed: boolean | null;
  sportKey: string | null;
  seriesId: string | null;
  seriesSlug: string | null;
  seriesTitle: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  clobTokenIds: string[];
  outcomes: string[];
}

export interface ManagedSeriesRecord {
  sportId: number | null;
  sportKey: string | null;
  seriesId: string;
  seriesSlug: string | null;
  seriesTitle: string | null;
  resolution: string | null;
  ordering: string | null;
  tags: string[];
  createdAt: string | null;
  enabled: boolean;
  enabledReason: string | null;
}