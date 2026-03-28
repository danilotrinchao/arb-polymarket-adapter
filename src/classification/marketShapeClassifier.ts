import { DiscoveredMarket } from "../types/discoveredMarket.js";
import { MarketShape } from "../types/marketShape.js";
import { OutcomeNormalizer } from "./outcomeNormalizer.js";

export interface ShapeClassificationResult {
  shape: MarketShape;
}

export class MarketShapeClassifier {
  constructor(private readonly outcomeNormalizer: OutcomeNormalizer) {}

  public classify(market: DiscoveredMarket): ShapeClassificationResult {
    const outcomes = market.tokens.map((x) => x.outcomeLabel);

    if (this.outcomeNormalizer.areBinaryYesNo(outcomes)) {
      return { shape: MarketShape.BINARY_YES_NO };
    }

    if (market.tokens.length === 3) {
      return { shape: MarketShape.THREE_WAY_MATCH_RESULT };
    }

    return { shape: MarketShape.UNKNOWN };
  }
}