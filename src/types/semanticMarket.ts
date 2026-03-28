import { DiscoveredMarket } from "./discoveredMarket.js";

export type SemanticMarketType =
  | "TEAM_TO_WIN_YES_NO"
  | "DRAW_YES_NO"
  | "UNKNOWN_BINARY_PROPOSITION"
  | "UNSUPPORTED_SHAPE";

export type BinaryOutcomeRole = "YES" | "NO";

export type YesSemanticMode =
  | "TEAM_WINS"
  | "DRAW_OCCURS";

export type NoSemanticMode =
  | "TEAM_DOES_NOT_WIN"
  | "DRAW_DOES_NOT_OCCUR";

export type NormalizedOutcomeKey =
  | "YES"
  | "NO"
  | "DRAW"
  | "HOME"
  | "AWAY";

export interface SemanticInterpretation {
  semanticType: SemanticMarketType;
  semanticReasonCode: string;
  semanticReasonDetail: string;
  isSemanticallySupported: boolean;
  yesSemanticMode: YesSemanticMode | null;
  noSemanticMode: NoSemanticMode | null;
  canonicalSelectionHint: NormalizedOutcomeKey | null;
  referencedTeam: string | null;
}

export interface SemanticMarketClassifier {
  classify(market: DiscoveredMarket): SemanticInterpretation;
  classifyBinarySportsProposition(question: string): SemanticInterpretation;
  looksLikeDrawProposition(text: string): boolean;
  extractReferencedTeam(text: string): string | null;
}