import { MarketShape, NormalizedOutcomeKey } from "./marketShape.js";
import {
  NoSemanticMode,
  SemanticMarketType,
  YesSemanticMode,
} from "./semanticMarket.js";

export type GameStartTimeSource = "CLOB" | "GAMMA" | null;
export type BinaryOutcomeRole = "YES" | "NO";
export type SupportedNormalizedOutcomeKey = NormalizedOutcomeKey | "YES" | "NO";

export interface CatalogOutcomeEntry {
  tokenId: string;
  outcomeLabel: string;
  normalizedOutcomeKey: SupportedNormalizedOutcomeKey | null;
  binaryOutcomeRole: BinaryOutcomeRole | null;
  price: number | null;
  winner: boolean | null;
}

export interface CatalogEntry {
  catalogId: string;
  source: "polymarket";
  conditionId: string;
  question: string;
  marketSlug: string | null;

  rawGameStartTime: string | null;
  gameStartTime: string | null;
  gameStartTimeSource: GameStartTimeSource;

  shape: MarketShape;

  semanticType: SemanticMarketType;
  semanticSupported: boolean;
  semanticReasonCode: string;
  semanticReasonDetail: string;
  referencedTeam: string | null;
  yesSemanticMode: YesSemanticMode | null;
  noSemanticMode: NoSemanticMode | null;

  quoteEligible: boolean;
  quoteReasonCode: string;
  quoteReasonDetail: string;

  tradeEligible: boolean;
  tradeReasonCode: string;
  tradeReasonDetail: string;

  isEligible: boolean;
  reasonCode: string;
  reasonDetail: string;

  sportsPlausible: boolean;
  sportsReasonCode: string;
  sportsReasonDetail: string;
  matchedGammaSource: string | null;
  matchedGammaId: string | null;
  matchedGammaStartTime: string | null;

  outcomes: CatalogOutcomeEntry[];
  discoveredAt: string;
  lastSeenAt: string;
}
