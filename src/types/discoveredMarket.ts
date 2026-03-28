export interface PolymarketSamplingMarketResponse {
  enable_order_book?: boolean;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  accepting_orders?: boolean;
  accepting_order_timestamp?: string;
  minimum_order_size?: number;
  minimum_tick_size?: number;
  condition_id?: string;
  question_id?: string;
  question?: string;
  description?: string;
  market_slug?: string;
  end_date_iso?: string;
  game_start_time?: string;
  seconds_delay?: number;
  fpmm?: string;
  maker_base_fee?: number;
  taker_base_fee?: number;
  notifications_enabled?: boolean;
  neg_risk?: boolean;
  neg_risk_market_id?: string;
  neg_risk_request_id?: string;
  icon?: string;
  image?: string;
  is_50_50_outcome?: boolean;
  tags?: string[];
  tokens?: PolymarketTokenResponse[];
}

export interface PolymarketTokenResponse {
  token_id?: string;
  outcome?: string;
  price?: number;
  winner?: boolean;
}

export interface DiscoveredToken {
  tokenId: string;
  outcomeLabel: string;
  price: number | null;
  winner: boolean | null;
}

export interface DiscoveredMarket {
  source: "polymarket";
  conditionId: string;
  question: string;
  marketSlug: string | null;
  gameStartTime: string | null;
  active: boolean;
  closed: boolean;
  archived: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
  negRisk: boolean;
  tokens: DiscoveredToken[];
  rawTags: string[];
}