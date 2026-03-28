export interface CatalogPublishSummary {
  generatedAt: string;
  totalCatalog: number;
  sportsPlausible: number;
  quoteEligible: number;
  tradeEligible: number;
}

export interface RedisQuoteEligibleOutcome {
  tokenId: string;
  outcomeLabel: string;
  normalizedOutcomeKey: string | null;
  binaryOutcomeRole: string | null;
  price: number | null;
  winner: boolean | null;
}

export interface RedisQuoteEligibleMarket {
  catalogId: string;
  conditionId: string;
  question: string;
  marketSlug: string | null;
  gameStartTime: string | null;
  gameStartTimeSource: string | null;

  semanticType: string;
  referencedTeam: string | null;
  yesSemanticMode: string | null;
  noSemanticMode: string | null;

  matchedGammaId: string | null;
  matchedGammaStartTime: string | null;

  quoteReasonCode: string;
  tradeReasonCode: string;

  outcomes: RedisQuoteEligibleOutcome[];

  discoveredAt: string;
  lastSeenAt: string;
}

export interface FootballQuoteEligibleSnapshot {
  snapshotType: "FOOTBALL_QUOTE_ELIGIBLE";
  version: string;
  generatedAt: string;
  summary: CatalogPublishSummary;
  markets: RedisQuoteEligibleMarket[];
}
