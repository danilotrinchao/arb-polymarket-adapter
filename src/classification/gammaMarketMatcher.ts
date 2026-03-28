import { DiscoveredMarket } from "../types/discoveredMarket.js";
import { GammaDiscoveredCandidate } from "../types/gammaDiscovery.js";

export interface GammaDiscoveryIndex {
  all: GammaDiscoveredCandidate[];
  byConditionId: Map<string, GammaDiscoveredCandidate[]>;
  bySlug: Map<string, GammaDiscoveredCandidate[]>;
  byNormalizedText: Map<string, GammaDiscoveredCandidate[]>;
}

export interface GammaMarketMatchDecision {
  matched: boolean;
  reasonCode: string;
  reasonDetail: string;
  matchedGammaSource: string | null;
  matchedGammaId: string | null;
  matchedGammaStartTime: string | null;
  matchedCandidate: GammaDiscoveredCandidate | null;
}

export class GammaMarketMatcher {
  public buildIndex(candidates: GammaDiscoveredCandidate[]): GammaDiscoveryIndex {
    const byConditionId = new Map<string, GammaDiscoveredCandidate[]>();
    const bySlug = new Map<string, GammaDiscoveredCandidate[]>();
    const byNormalizedText = new Map<string, GammaDiscoveredCandidate[]>();

    for (const candidate of candidates) {
      if (candidate.conditionId) {
        this.push(byConditionId, candidate.conditionId.toLowerCase(), candidate);
      }

      if (candidate.slug) {
        this.push(bySlug, this.normalizeText(candidate.slug), candidate);
      }

      const texts = [candidate.question, candidate.title].filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0
      );

      for (const text of texts) {
        this.push(byNormalizedText, this.normalizeText(text), candidate);
      }
    }

    return {
      all: candidates,
      byConditionId,
      bySlug,
      byNormalizedText,
    };
  }

  public evaluate(
    market: DiscoveredMarket,
    index: GammaDiscoveryIndex
  ): GammaMarketMatchDecision {
    const conditionMatches = index.byConditionId.get(market.conditionId.toLowerCase()) ?? [];
    if (conditionMatches.length > 0) {
      const candidate = conditionMatches[0];
      if (candidate) {
        return this.accept(
          "GAMMA_MATCH_CONDITION_ID",
          "Matched Gamma football candidate by conditionId",
          candidate
        );
      }
    }

    if (market.marketSlug) {
      const slugMatches = index.bySlug.get(this.normalizeText(market.marketSlug)) ?? [];
      if (slugMatches.length > 0) {
        const candidate = slugMatches[0];
        if (candidate) {
          return this.accept(
            "GAMMA_MATCH_SLUG",
            "Matched Gamma football candidate by slug",
            candidate
          );
        }
      }
    }

    const questionMatches = index.byNormalizedText.get(this.normalizeText(market.question)) ?? [];
    if (questionMatches.length > 0) {
      const candidate = questionMatches[0];
      if (candidate) {
        return this.accept(
          "GAMMA_MATCH_QUESTION",
          "Matched Gamma football candidate by normalized question",
          candidate
        );
      }
    }

    return {
      matched: false,
      reasonCode: "NO_GAMMA_FOOTBALL_MATCH",
      reasonDetail: "No deterministic Gamma football match found for this CLOB market",
      matchedGammaSource: null,
      matchedGammaId: null,
      matchedGammaStartTime: null,
      matchedCandidate: null,
    };
  }

  private accept(
    reasonCode: string,
    reasonDetail: string,
    candidate: GammaDiscoveredCandidate
  ): GammaMarketMatchDecision {
    return {
      matched: true,
      reasonCode,
      reasonDetail,
      matchedGammaSource: candidate.source,
      matchedGammaId: candidate.id,
      matchedGammaStartTime: candidate.startTime ?? null,
      matchedCandidate: candidate,
    };
  }

  private normalizeText(value: string): string {
    return value
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private push(
    map: Map<string, GammaDiscoveredCandidate[]>,
    key: string,
    value: GammaDiscoveredCandidate
  ): void {
    const current = map.get(key);
    if (current) {
      current.push(value);
      return;
    }

    map.set(key, [value]);
  }
}