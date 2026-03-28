import { DiscoveredMarket } from "../types/discoveredMarket.js";
import { SemanticInterpretation } from "../types/semanticMarket.js";

export interface SemanticMarketClassifier {
  classify(market: DiscoveredMarket): SemanticInterpretation;
  classifyBinarySportsProposition(question: string): SemanticInterpretation;
  looksLikeDrawProposition(text: string): boolean;
  extractReferencedTeam(text: string): string | null;
}
