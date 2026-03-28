export type FootballSemanticType =
  | "TEAM_TO_WIN_YES_NO"
  | "DRAW_YES_NO";

export interface FootballCatalogToken {
  tokenId: string;
  outcome: string;
}

export interface FootballMatchCatalogEntry {
  catalogId: string;
  eventId: string | null;
  marketId: string | null;
  conditionId: string;
  eventSlug: string | null;
  marketSlug: string | null;
  question: string;
  title: string | null;
  sportKey: string | null;
  seriesId: string | null;
  seriesSlug: string | null;
  seriesTitle: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  startTime: string | null;
  semanticType: FootballSemanticType;
  referencedTeam: string | null;
  quoteEligible: boolean;
  tradeEligible: boolean;
  quoteReasonCode: string;
  tradeReasonCode: string;
  tokens: FootballCatalogToken[];
}

export interface FootballQuoteEligibleEntry {
  conditionId: string;
  eventId: string | null;
  marketId: string | null;
  question: string;
  semanticType: FootballSemanticType;
  referencedTeam: string | null;
  startTime: string | null;
  tokenIds: string[];
  tradeEligible: boolean;
}

export interface FootballMatchCatalogFile {
  generatedAt: string;
  count: number;
  markets: FootballMatchCatalogEntry[];
}

export interface FootballQuoteEligibleFile {
  generatedAt: string;
  count: number;
  markets: FootballQuoteEligibleEntry[];
}