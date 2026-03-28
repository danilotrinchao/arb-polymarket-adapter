import {
  DiscoveredMarket,
  PolymarketSamplingMarketResponse,
  PolymarketTokenResponse,
} from "../types/discoveredMarket.js";
import { CatalogEntry, GameStartTimeSource } from "../types/catalogEntry.js";
import { GammaDiscoveredCandidate } from "../types/gammaDiscovery.js";
import { MarketShapeClassifier } from "../classification/marketShapeClassifier.js";
import { EligibilityService } from "../classification/eligibilityService.js";
import { GammaMarketMatcher } from "../classification/gammaMarketMatcher.js";
import { FootballMarketScope } from "../classification/footballMarketScope.js";
import { SemanticMarketClassifier } from "../classification/semanticMarketClassifier.js";

export class CatalogBuilderService {
  constructor(
    private readonly shapeClassifier: MarketShapeClassifier,
    private readonly eligibilityService: EligibilityService,
    private readonly gammaMarketMatcher: GammaMarketMatcher,
    private readonly footballMarketScope: FootballMarketScope,
    private readonly semanticClassifier: SemanticMarketClassifier
  ) {}

  public build(
    markets: PolymarketSamplingMarketResponse[],
    gammaCandidates: GammaDiscoveredCandidate[]
  ): CatalogEntry[] {
    const now = new Date().toISOString();
    const gammaIndex = this.gammaMarketMatcher.buildIndex(gammaCandidates);

    return markets
      .map((raw) => this.toDiscoveredMarket(raw))
      .filter((x): x is DiscoveredMarket => x !== null)
      .map((market) => {
        const gammaDecision = this.gammaMarketMatcher.evaluate(market, gammaIndex);

        const footballScopeDecision = gammaDecision.matchedCandidate
          ? this.footballMarketScope.evaluateCandidate(gammaDecision.matchedCandidate)
          : {
              isFootballMatchMarket: false,
              isFutureMarket: false,
              reasonCode: "NO_GAMMA_FOOTBALL_MATCH",
              reasonDetail: "No matched Gamma football candidate to evaluate scope",
            };

        const shapeResult = this.shapeClassifier.classify(market);
        const semantic = this.semanticClassifier.classify(market); // ← corrigido

        const effectiveGameStartTime =
          market.gameStartTime ?? gammaDecision.matchedGammaStartTime;

        const gameStartTimeSource: GameStartTimeSource = market.gameStartTime
          ? "CLOB"
          : gammaDecision.matchedGammaStartTime
          ? "GAMMA"
          : null;

        const decision = this.eligibilityService.decide(
          market,
          footballScopeDecision,
          shapeResult.shape,
          semantic,
          effectiveGameStartTime,
          gameStartTimeSource
        );

        return {
          catalogId: market.conditionId,
          source: "polymarket",
          conditionId: market.conditionId,
          question: market.question,
          marketSlug: market.marketSlug,

          rawGameStartTime: market.gameStartTime,
          gameStartTime: effectiveGameStartTime,
          gameStartTimeSource,

          shape: shapeResult.shape,

          semanticType: semantic.semanticType,
          semanticSupported: semantic.isSemanticallySupported,
          semanticReasonCode: semantic.semanticReasonCode,
          semanticReasonDetail: semantic.semanticReasonDetail,
          referencedTeam: semantic.referencedTeam,
          yesSemanticMode: semantic.yesSemanticMode,
          noSemanticMode: semantic.noSemanticMode,

          quoteEligible: decision.quoteEligible,
          quoteReasonCode: decision.quoteReasonCode,
          quoteReasonDetail: decision.quoteReasonDetail,

          tradeEligible: decision.tradeEligible,
          tradeReasonCode: decision.tradeReasonCode,
          tradeReasonDetail: decision.tradeReasonDetail,

          isEligible: decision.quoteEligible,
          reasonCode: decision.quoteReasonCode,
          reasonDetail: decision.quoteReasonDetail,

          sportsPlausible: footballScopeDecision.isFootballMatchMarket,
          sportsReasonCode: footballScopeDecision.reasonCode,
          sportsReasonDetail: footballScopeDecision.reasonDetail,
          matchedGammaSource: gammaDecision.matchedGammaSource,
          matchedGammaId: gammaDecision.matchedGammaId,
          matchedGammaStartTime: gammaDecision.matchedGammaStartTime,

          outcomes: decision.normalizedOutcomes,
          discoveredAt: now,
          lastSeenAt: now,
        } satisfies CatalogEntry;
      });
  }

  private toDiscoveredMarket(raw: PolymarketSamplingMarketResponse): DiscoveredMarket | null {
    if (!raw.condition_id || !raw.question || !raw.tokens || raw.tokens.length === 0) {
      return null;
    }

    const tokens = raw.tokens
      .filter(
        (
          t: PolymarketTokenResponse
        ): t is PolymarketTokenResponse & { token_id: string; outcome: string } =>
          typeof t.token_id === "string" &&
          t.token_id.trim().length > 0 &&
          typeof t.outcome === "string" &&
          t.outcome.trim().length > 0
      )
      .map((t) => ({
        tokenId: t.token_id,
        outcomeLabel: t.outcome,
        price: typeof t.price === "number" ? t.price : null,
        winner: typeof t.winner === "boolean" ? t.winner : null,
      }));

    if (tokens.length === 0) {
      return null;
    }

    return {
      source: "polymarket",
      conditionId: raw.condition_id,
      question: raw.question,
      marketSlug: raw.market_slug ?? null,
      gameStartTime: raw.game_start_time ?? null,
      active: raw.active ?? false,
      closed: raw.closed ?? false,
      archived: raw.archived ?? false,
      acceptingOrders: raw.accepting_orders ?? false,
      enableOrderBook: raw.enable_order_book ?? false,
      negRisk: raw.neg_risk ?? false,
      tokens,
      rawTags: raw.tags ?? [],
    };
  }
}