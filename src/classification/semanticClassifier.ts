import { OutcomeNormalizer } from "./outcomeNormalizer.js";
import { DiscoveredMarket } from "../types/discoveredMarket.js";
import { SemanticInterpretation } from "../types/semanticMarket.js";
import { SemanticMarketClassifier } from "./semanticMarketClassifier.js";

export class SemanticClassifier implements SemanticMarketClassifier {
  constructor(private readonly outcomeNormalizer: OutcomeNormalizer) {
    void this.outcomeNormalizer;
  }

  public classify(market: DiscoveredMarket): SemanticInterpretation {
    const headToHead = this.classifyHeadToHeadWinner(market);
    if (headToHead) {
      return headToHead;
    }

    const rawText = `${market.question} ${market.marketSlug ?? ""}`;
    return this.classifyText(rawText);
  }

  public classifyBinarySportsProposition(question: string): SemanticInterpretation {
    return this.classifyText(question);
  }

  private classifyHeadToHeadWinner(market: DiscoveredMarket): SemanticInterpretation | null {
    const text = market.question.trim();
    const vsPattern = /^(.+?)\s+vs\.?\s+(.+?)$/i;
    const vsMatch = text.match(vsPattern);
    if (!vsMatch) {
      return null;
    }

    const left = this.normalizeText(vsMatch[1] as string);
    const right = this.normalizeText(vsMatch[2] as string);

    if (!left || !right || left === right) {
      return null;
    }

    if (market.tokens.length !== 2) {
      return null;
    }

    const normalizedOutcomes = market.tokens.map((t) => this.normalizeText(t.outcomeLabel));
    if (normalizedOutcomes.some((o) => !o)) {
      return null;
    }

    const [outcomeA, outcomeB] = normalizedOutcomes as [string, string];
    if (outcomeA === outcomeB) {
      return null;
    }

    const players = [left, right];

    if (
      (outcomeA === left && outcomeB === right) ||
      (outcomeA === right && outcomeB === left)
    ) {
      return {
        semanticType: "TEAM_VS_TEAM_WINNER",
        semanticReasonCode: "TEAM_VS_TEAM_WINNER_DETECTED",
        semanticReasonDetail:
          "Detected a head-to-head two-team winner market with named outcomes",
        isSemanticallySupported: true,
        yesSemanticMode: null,
        noSemanticMode: null,
        canonicalSelectionHint: null,
        referencedTeam: null,
      };
    }

    return null;
  }

  public looksLikeDrawProposition(text: string): boolean {
    const normalized = this.normalizeText(text);

    return (
      normalized.includes("draw") ||
      normalized.includes("empate") ||
      normalized.includes("end in a draw") ||
      normalized.includes("finish in a draw") ||
      normalized.includes("match be a draw")
    );
  }

  public extractReferencedTeam(text: string): string | null {
    const normalized = this.normalizeText(text);

    const patterns = [
      /will the ([a-z0-9 ]+?) beat /,
      /will ([a-z0-9 ]+?) beat /,
      /will the ([a-z0-9 ]+?) win\b/,
      /will ([a-z0-9 ]+?) win\b/,
      /does ([a-z0-9 ]+?) win\b/,
      /can ([a-z0-9 ]+?) win\b/,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      const team = match?.[1]?.trim();

      if (team) {
        return team;
      }
    }

    return null;
  }

  private classifyText(text: string): SemanticInterpretation {
    const normalized = this.normalizeText(text);

    if (this.looksLikeDrawProposition(normalized)) {
      return {
        semanticType: "DRAW_YES_NO",
        semanticReasonCode: "DRAW_PROPOSITION_DETECTED",
        semanticReasonDetail: "Detected a draw-oriented binary football proposition",
        isSemanticallySupported: true,
        yesSemanticMode: "DRAW_OCCURS",
        noSemanticMode: "DRAW_DOES_NOT_OCCUR",
        canonicalSelectionHint: null,
        referencedTeam: null,
      };
    }

    const referencedTeam = this.extractReferencedTeam(normalized);
    if (referencedTeam) {
      return {
        semanticType: "TEAM_TO_WIN_YES_NO",
        semanticReasonCode: "TEAM_TO_WIN_PROPOSITION_DETECTED",
        semanticReasonDetail: "Detected a team-to-win binary football proposition",
        isSemanticallySupported: true,
        yesSemanticMode: "TEAM_WINS",
        noSemanticMode: "TEAM_DOES_NOT_WIN",
        canonicalSelectionHint: null,
        referencedTeam,
      };
    }

    return {
      semanticType: "UNKNOWN_BINARY_PROPOSITION",
      semanticReasonCode: "SEMANTIC_PATTERN_NOT_RECOGNIZED",
      semanticReasonDetail: "Could not map proposition to a supported football semantic",
      isSemanticallySupported: false,
      yesSemanticMode: null,
      noSemanticMode: null,
      canonicalSelectionHint: null,
      referencedTeam: null,
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
}
