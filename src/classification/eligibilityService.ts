import { CatalogOutcomeEntry, GameStartTimeSource } from "../types/catalogEntry.js";
import { DiscoveredMarket } from "../types/discoveredMarket.js";
import { MarketShape } from "../types/marketShape.js";
import { SemanticInterpretation } from "../types/semanticMarket.js";
import { FootballMarketScopeDecision } from "./footballMarketScope.js";
import { OutcomeNormalizer } from "./outcomeNormalizer.js";

export interface EligibilityDecision {
  quoteEligible: boolean;
  quoteReasonCode: string;
  quoteReasonDetail: string;

  tradeEligible: boolean;
  tradeReasonCode: string;
  tradeReasonDetail: string;

  normalizedOutcomes: CatalogOutcomeEntry[];
}

// Usado pela trilha NBA e futuras trilhas de esporte
export interface SportsMatchScopeDecision {
  isInScope: boolean;
  isFutureMarket: boolean;
  reasonCode: string;
  reasonDetail: string;
}

export class EligibilityService {
  constructor(private readonly outcomeNormalizer: OutcomeNormalizer) {}

  // Trilha de futebol — assinatura preservada sem alteração
  public decide(
    market: DiscoveredMarket,
    footballScopeDecision: FootballMarketScopeDecision,
    shape: MarketShape,
    semantic: SemanticInterpretation,
    effectiveGameStartTime: string | null,
    _gameStartTimeSource: GameStartTimeSource
  ): EligibilityDecision {
    const normalizedOutcomes = this.normalizeOutcomes(market);

    if (!footballScopeDecision.isFootballMatchMarket) {
      return {
        quoteEligible: false,
        quoteReasonCode: footballScopeDecision.reasonCode,
        quoteReasonDetail: footballScopeDecision.reasonDetail,

        tradeEligible: false,
        tradeReasonCode: footballScopeDecision.reasonCode,
        tradeReasonDetail: footballScopeDecision.reasonDetail,

        normalizedOutcomes,
      };
    }

    if (shape !== "BINARY_YES_NO") {
      return {
        quoteEligible: false,
        quoteReasonCode: "SHAPE_NOT_SUPPORTED",
        quoteReasonDetail: `Only BINARY_YES_NO football markets are supported. Received: ${shape}`,

        tradeEligible: false,
        tradeReasonCode: "SHAPE_NOT_SUPPORTED",
        tradeReasonDetail: `Only BINARY_YES_NO football markets are supported. Received: ${shape}`,

        normalizedOutcomes,
      };
    }

    const hasExactlyTwoOutcomes = normalizedOutcomes.length === 2;
    const hasYes = normalizedOutcomes.some((o) => o.binaryOutcomeRole === "YES");
    const hasNo = normalizedOutcomes.some((o) => o.binaryOutcomeRole === "NO");
    const hasBrokenOutcome = normalizedOutcomes.some(
      (o) => o.normalizedOutcomeKey === null || o.binaryOutcomeRole === null
    );

    if (!hasExactlyTwoOutcomes || !hasYes || !hasNo || hasBrokenOutcome) {
      return {
        quoteEligible: false,
        quoteReasonCode: "OUTCOME_NORMALIZATION_FAILED",
        quoteReasonDetail:
          "Could not normalize the market outcomes into a deterministic YES/NO pair",

        tradeEligible: false,
        tradeReasonCode: "OUTCOME_NORMALIZATION_FAILED",
        tradeReasonDetail:
          "Could not normalize the market outcomes into a deterministic YES/NO pair",

        normalizedOutcomes,
      };
    }

    if (!semantic.isSemanticallySupported && semantic.semanticType !== "DRAW_YES_NO") {
      return {
        quoteEligible: false,
        quoteReasonCode: semantic.semanticReasonCode,
        quoteReasonDetail: semantic.semanticReasonDetail,

        tradeEligible: false,
        tradeReasonCode: semantic.semanticReasonCode,
        tradeReasonDetail: semantic.semanticReasonDetail,

        normalizedOutcomes,
      };
    }

    if (!effectiveGameStartTime) {
      return {
        quoteEligible: false,
        quoteReasonCode: "SPORTS_MARKET_MISSING_GAME_START_TIME",
        quoteReasonDetail:
          "Football market matched successfully, but no effective game start time was available",

        tradeEligible: false,
        tradeReasonCode: "SPORTS_MARKET_MISSING_GAME_START_TIME",
        tradeReasonDetail:
          "Football market matched successfully, but no effective game start time was available",

        normalizedOutcomes,
      };
    }

    if (!market.enableOrderBook) {
      return {
        quoteEligible: false,
        quoteReasonCode: "ORDER_BOOK_DISABLED",
        quoteReasonDetail: "Market does not have order book enabled",

        tradeEligible: false,
        tradeReasonCode: "ORDER_BOOK_DISABLED",
        tradeReasonDetail: "Market does not have order book enabled",

        normalizedOutcomes,
      };
    }

    const quoteEligible = true;
    const quoteReasonCode = "SEMANTIC_BINARY_QUOTE_ELIGIBLE";
    const quoteReasonDetail =
      "Football match market passed scope, shape, semantic and outcome normalization checks";

    if (market.negRisk) {
      return {
        quoteEligible,
        quoteReasonCode,
        quoteReasonDetail,

        tradeEligible: false,
        tradeReasonCode: "NEG_RISK_UNSUPPORTED",
        tradeReasonDetail:
          "Quote is allowed, but automated trading is blocked for negRisk markets in the current scope",

        normalizedOutcomes,
      };
    }

    return {
      quoteEligible,
      quoteReasonCode,
      quoteReasonDetail,

      tradeEligible: true,
      tradeReasonCode: "TRADE_ELIGIBLE",
      tradeReasonDetail:
        "Football match market is eligible for quote and trade in the current scope",

      normalizedOutcomes,
    };
  }

  // Trilha genérica — usada pela NBA e futuras trilhas de esporte
  public decideForScope(
    market: DiscoveredMarket,
    scope: SportsMatchScopeDecision,
    shape: MarketShape,
    semantic: SemanticInterpretation,
    effectiveGameStartTime: string | null,
    _gameStartTimeSource: GameStartTimeSource
  ): EligibilityDecision {
    if (!scope.isInScope) {
      return {
        quoteEligible: false,
        quoteReasonCode: scope.reasonCode,
        quoteReasonDetail: scope.reasonDetail,

        tradeEligible: false,
        tradeReasonCode: scope.reasonCode,
        tradeReasonDetail: scope.reasonDetail,

        normalizedOutcomes: this.normalizeOutcomes(market),
      };
    }

    let normalizedOutcomes: CatalogOutcomeEntry[] = [];

    if (shape === MarketShape.BINARY_YES_NO) {
      normalizedOutcomes = this.normalizeOutcomes(market);

      const hasExactlyTwoOutcomes = normalizedOutcomes.length === 2;
      const hasYes = normalizedOutcomes.some((o) => o.binaryOutcomeRole === "YES");
      const hasNo = normalizedOutcomes.some((o) => o.binaryOutcomeRole === "NO");
      const hasBrokenOutcome = normalizedOutcomes.some(
        (o) => o.normalizedOutcomeKey === null || o.binaryOutcomeRole === null
      );

      if (!hasExactlyTwoOutcomes || !hasYes || !hasNo || hasBrokenOutcome) {
        return {
          quoteEligible: false,
          quoteReasonCode: "OUTCOME_NORMALIZATION_FAILED",
          quoteReasonDetail:
            "Could not normalize the market outcomes into a deterministic YES/NO pair",

          tradeEligible: false,
          tradeReasonCode: "OUTCOME_NORMALIZATION_FAILED",
          tradeReasonDetail:
            "Could not normalize the market outcomes into a deterministic YES/NO pair",

          normalizedOutcomes,
        };
      }

      if (!semantic.isSemanticallySupported) {
        return {
          quoteEligible: false,
          quoteReasonCode: semantic.semanticReasonCode,
          quoteReasonDetail: semantic.semanticReasonDetail,

          tradeEligible: false,
          tradeReasonCode: semantic.semanticReasonCode,
          tradeReasonDetail: semantic.semanticReasonDetail,

          normalizedOutcomes,
        };
      }
    } else if (shape === MarketShape.HEAD_TO_HEAD_NAMED_OUTCOMES) {
      if (semantic.semanticType !== "TEAM_VS_TEAM_WINNER" || !semantic.isSemanticallySupported) {
        return {
          quoteEligible: false,
          quoteReasonCode: semantic.semanticReasonCode,
          quoteReasonDetail: semantic.semanticReasonDetail,

          tradeEligible: false,
          tradeReasonCode: semantic.semanticReasonCode,
          tradeReasonDetail: semantic.semanticReasonDetail,

          normalizedOutcomes: this.normalizeOutcomes(market),
        };
      }

      if (market.tokens.length !== 2) {
        return {
          quoteEligible: false,
          quoteReasonCode: "OUTCOME_NORMALIZATION_FAILED",
          quoteReasonDetail: "Expected exactly 2 outcomes for HEAD_TO_HEAD_NAMED_OUTCOMES",

          tradeEligible: false,
          tradeReasonCode: "OUTCOME_NORMALIZATION_FAILED",
          tradeReasonDetail: "Expected exactly 2 outcomes for HEAD_TO_HEAD_NAMED_OUTCOMES",

          normalizedOutcomes: this.normalizeOutcomes(market),
        };
      }

      const outcomeLabels = market.tokens.map((t) => t.outcomeLabel.trim());
      const firstLabel = outcomeLabels[0] ?? "";
      const secondLabel = outcomeLabels[1] ?? "";

      if (firstLabel.length === 0 || secondLabel.length === 0 || firstLabel === secondLabel) {
        return {
          quoteEligible: false,
          quoteReasonCode: "OUTCOME_NORMALIZATION_FAILED",
          quoteReasonDetail: "NBA HEAD_TO_HEAD_NAMED_OUTCOMES requires two distinct non-empty outcomes",

          tradeEligible: false,
          tradeReasonCode: "OUTCOME_NORMALIZATION_FAILED",
          tradeReasonDetail: "NBA HEAD_TO_HEAD_NAMED_OUTCOMES requires two distinct non-empty outcomes",

          normalizedOutcomes: this.normalizeOutcomes(market),
        };
      }

      normalizedOutcomes = market.tokens.map((token, idx) => ({
        tokenId: token.tokenId,
        outcomeLabel: token.outcomeLabel,
        normalizedOutcomeKey: idx === 0 ? "SIDE_A" : "SIDE_B",
        binaryOutcomeRole: idx === 0 ? "SIDE_A" : "SIDE_B",
        price: token.price,
        winner: token.winner,
      }));
    } else {
      return {
        quoteEligible: false,
        quoteReasonCode: "SHAPE_NOT_SUPPORTED",
        quoteReasonDetail: `Only BINARY_YES_NO and HEAD_TO_HEAD_NAMED_OUTCOMES sports markets are supported. Received: ${shape}`,

        tradeEligible: false,
        tradeReasonCode: "SHAPE_NOT_SUPPORTED",
        tradeReasonDetail: `Only BINARY_YES_NO and HEAD_TO_HEAD_NAMED_OUTCOMES sports markets are supported. Received: ${shape}`,

        normalizedOutcomes: this.normalizeOutcomes(market),
      };
    }

    if (!effectiveGameStartTime) {
      return {
        quoteEligible: false,
        quoteReasonCode: "SPORTS_MARKET_MISSING_GAME_START_TIME",
        quoteReasonDetail:
          "Sports market matched successfully, but no effective game start time was available",

        tradeEligible: false,
        tradeReasonCode: "SPORTS_MARKET_MISSING_GAME_START_TIME",
        tradeReasonDetail:
          "Sports market matched successfully, but no effective game start time was available",

        normalizedOutcomes,
      };
    }

    if (!market.enableOrderBook) {
      return {
        quoteEligible: false,
        quoteReasonCode: "ORDER_BOOK_DISABLED",
        quoteReasonDetail: "Market does not have order book enabled",

        tradeEligible: false,
        tradeReasonCode: "ORDER_BOOK_DISABLED",
        tradeReasonDetail: "Market does not have order book enabled",

        normalizedOutcomes,
      };
    }

    const quoteEligible = true;
    const quoteReasonCode = "SEMANTIC_BINARY_QUOTE_ELIGIBLE";
    const quoteReasonDetail =
      "Sports match market passed scope, shape, semantic and outcome normalization checks";

    if (market.negRisk) {
      return {
        quoteEligible,
        quoteReasonCode,
        quoteReasonDetail,

        tradeEligible: false,
        tradeReasonCode: "NEG_RISK_UNSUPPORTED",
        tradeReasonDetail:
          "Quote is allowed, but automated trading is blocked for negRisk markets in the current scope",

        normalizedOutcomes,
      };
    }

    return {
      quoteEligible,
      quoteReasonCode,
      quoteReasonDetail,

      tradeEligible: true,
      tradeReasonCode: "TRADE_ELIGIBLE",
      tradeReasonDetail:
        "Sports match market is eligible for quote and trade in the current scope",

      normalizedOutcomes,
    };
  }

  private normalizeOutcomes(market: DiscoveredMarket): CatalogOutcomeEntry[] {
    return market.tokens.map((token) => {
      const normalized = this.outcomeNormalizer.normalizeBinaryOutcome(token.outcomeLabel);

      return {
        tokenId: token.tokenId,
        outcomeLabel: token.outcomeLabel,
        normalizedOutcomeKey: normalized.normalizedOutcomeKey,
        binaryOutcomeRole: normalized.binaryOutcomeRole,
        price: token.price,
        winner: token.winner,
      };
    });
  }
}
