export type LiquidityProbeSport = "football" | "nba";

export interface LiquidityProbeMarketInput {
  sport: LiquidityProbeSport;
  league: string;
  conditionId: string;
  marketSlug: string | null;
  question: string;
  tokenAId: string;
  tokenBId: string;
  sideAName: string;
  sideBName: string;
}

export interface LiquiditySnapshotRecord {
  timestampUtc: string;
  sport: LiquidityProbeSport;
  league: string;
  conditionId: string;
  marketSlug: string | null;
  question: string;

  tokenAId: string;
  tokenBId: string;

  sideAName: string;
  sideBName: string;

  bestBidA: number | null;
  bestAskA: number | null;
  bestBidB: number | null;
  bestAskB: number | null;

  midA: number | null;
  midB: number | null;

  spreadA: number | null;
  spreadB: number | null;

  depthBidA: number | null;
  depthAskA: number | null;
  depthBidB: number | null;
  depthAskB: number | null;

  lastTradePriceA: number | null;
  lastTradePriceB: number | null;

  hasTwoSidedBookA: boolean;
  hasTwoSidedBookB: boolean;
  hasTwoSidedBook: boolean;
  bookHealthy: boolean;
}