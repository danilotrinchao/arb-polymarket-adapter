export interface QuoteEligibleArtifact {
  source: "polymarket";
  conditionId: string;
  marketSlug: string | null;
  question: string | null;
  gameStartTime: string;
  semanticType: string | null;
  referencedTeam: string | null;
  tradeEligible: boolean;
  yesTokenId: string;
  noTokenId: string;
}