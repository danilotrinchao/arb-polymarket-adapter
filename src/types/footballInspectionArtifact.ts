export interface FootballInspectionOutcomeArtifact {
  tokenId: string;
  outcomeLabel: string;
  normalizedOutcomeKey: string | null;
  binaryOutcomeRole: string | null;
  price: number | null;
  winner: boolean | null;
}

export interface FootballMatchCatalogArtifact {
  catalogId: string;
  conditionId: string;
  question: string;
  marketSlug: string | null;

  gameStartTime: string | null;
  gameStartTimeSource: string | null;

  shape: string;
  semanticType: string;
  semanticSupported: boolean;
  referencedTeam: string | null;
  yesSemanticMode: string | null;
  noSemanticMode: string | null;

  sportsPlausible: boolean;
  sportsReasonCode: string;
  sportsReasonDetail: string;

  matchedGammaSource: string | null;
  matchedGammaId: string | null;
  matchedGammaStartTime: string | null;

  quoteEligible: boolean;
  quoteReasonCode: string;
  quoteReasonDetail: string;

  tradeEligible: boolean;
  tradeReasonCode: string;
  tradeReasonDetail: string;

  outcomes: FootballInspectionOutcomeArtifact[];
}

export interface FootballQuoteCandidateArtifact {
  catalogId: string;
  conditionId: string;
  question: string;
  marketSlug: string | null;

  gameStartTime: string | null;
  gameStartTimeSource: string | null;

  shape: string;
  semanticType: string;
  referencedTeam: string | null;

  quoteEligible: boolean;
  quoteReasonCode: string;
  quoteReasonDetail: string;

  tradeEligible: boolean;
  tradeReasonCode: string;
  tradeReasonDetail: string;

  matchedGammaId: string | null;
  matchedGammaSource: string | null;
  matchedGammaStartTime: string | null;

  outcomes: FootballInspectionOutcomeArtifact[];
}