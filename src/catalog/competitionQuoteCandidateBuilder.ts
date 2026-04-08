import { OutcomeNormalizer } from "../classification/outcomeNormalizer.js";
import { SemanticClassifier } from "../classification/semanticClassifier.js";
import { CatalogEntry } from "../types/catalogEntry.js";
import { GammaDiscoveredCandidate } from "../types/gammaDiscovery.js";

export interface CompetitionQuoteBuildExample {
  conditionId: string | null;
  marketSlug: string | null;
  question: string | null;
  outcomes: string[];
  reason: string;
  originalStartTime: string | null;
  resolvedGameStartTime: string | null;
}

export interface CompetitionQuoteBuildDiagnostics {
  totalCandidates: number;
  builtEntries: number;
  missingConditionId: number;
  missingQuestion: number;
  missingMarketSlug: number;
  missingStartTime: number;
  missingTokenIds: number;
  unsupportedOutcomeShape: number;
  unsupportedSemantic: number;
  preservedStartTime: number;
  correctedStartTime: number;
  inferredFromSlug: number;
  inferredFromQuestion: number;
  defaultedTime: number;
  examples: CompetitionQuoteBuildExample[];
}

export interface CompetitionQuoteBuildResult {
  entries: CatalogEntry[];
  diagnostics: CompetitionQuoteBuildDiagnostics;
}

type InferenceSource = "SLUG" | "QUESTION" | null;

interface ResolvedGameStartTime {
  rawGameStartTime: string | null;
  gameStartTime: string | null;
  corrected: boolean;
  inferredFrom: InferenceSource;
  defaultedTime: boolean;
}

export class CompetitionQuoteCandidateBuilder {
  private readonly maxExamples = 15;
  private readonly fallbackHourUtc = 18;

  constructor(
    private readonly outcomeNormalizer: OutcomeNormalizer,
    private readonly semanticClassifier: SemanticClassifier
  ) {}

  public build(candidates: readonly GammaDiscoveredCandidate[]): CompetitionQuoteBuildResult {
    const diagnostics: CompetitionQuoteBuildDiagnostics = {
      totalCandidates: candidates.length,
      builtEntries: 0,
      missingConditionId: 0,
      missingQuestion: 0,
      missingMarketSlug: 0,
      missingStartTime: 0,
      missingTokenIds: 0,
      unsupportedOutcomeShape: 0,
      unsupportedSemantic: 0,
      preservedStartTime: 0,
      correctedStartTime: 0,
      inferredFromSlug: 0,
      inferredFromQuestion: 0,
      defaultedTime: 0,
      examples: [],
    };

    const now = new Date().toISOString();
    const entries: CatalogEntry[] = [];

    for (const candidate of candidates) {
      if (!candidate.conditionId) {
        diagnostics.missingConditionId++;
        this.pushExample(diagnostics, candidate, "MISSING_CONDITION_ID", null);
        continue;
      }

      const question = candidate.question?.trim() ?? null;
      if (!question) {
        diagnostics.missingQuestion++;
        this.pushExample(diagnostics, candidate, "MISSING_QUESTION", null);
        continue;
      }

      const marketSlug = candidate.slug?.trim() ?? null;
      if (!marketSlug) {
        diagnostics.missingMarketSlug++;
        this.pushExample(diagnostics, candidate, "MISSING_MARKET_SLUG", null);
        continue;
      }

      const resolvedStartTime = this.resolveReliableGameStartTime(candidate);

      if (!resolvedStartTime.gameStartTime) {
        diagnostics.missingStartTime++;
        this.pushExample(diagnostics, candidate, "MISSING_START_TIME", resolvedStartTime);
        continue;
      }

      if (resolvedStartTime.corrected) {
        diagnostics.correctedStartTime++;
      } else {
        diagnostics.preservedStartTime++;
      }

      if (resolvedStartTime.inferredFrom === "SLUG") {
        diagnostics.inferredFromSlug++;
      } else if (resolvedStartTime.inferredFrom === "QUESTION") {
        diagnostics.inferredFromQuestion++;
      }

      if (resolvedStartTime.defaultedTime) {
        diagnostics.defaultedTime++;
      }

      if (
        candidate.clobTokenIds.length !== 2 ||
        candidate.outcomes.length !== 2 ||
        candidate.clobTokenIds.some((x) => !x || x.trim().length === 0) ||
        candidate.outcomes.some((x) => !x || x.trim().length === 0)
      ) {
        diagnostics.missingTokenIds++;
        this.pushExample(
          diagnostics,
          candidate,
          "MISSING_OR_INVALID_CLOB_TOKEN_IDS",
          resolvedStartTime
        );
        continue;
      }

      if (!this.outcomeNormalizer.areBinaryYesNo(candidate.outcomes)) {
        diagnostics.unsupportedOutcomeShape++;
        this.pushExample(
          diagnostics,
          candidate,
          "UNSUPPORTED_OUTCOME_SHAPE_NOT_YES_NO",
          resolvedStartTime
        );
        continue;
      }

      const semantic = this.semanticClassifier.classifyBinarySportsProposition(question);

      if (semantic.semanticType !== "TEAM_TO_WIN_YES_NO" && semantic.semanticType !== "DRAW_YES_NO") {
        diagnostics.unsupportedSemantic++;
        this.pushExample(
          diagnostics,
          candidate,
          `UNSUPPORTED_SEMANTIC_${semantic.semanticType}`,
          resolvedStartTime
        );
        continue;
      }

      const pairedOutcomes = candidate.outcomes.map((outcomeLabel, index) => {
        const normalized = this.outcomeNormalizer.normalizeBinaryOutcome(outcomeLabel);

        return {
          tokenId: candidate.clobTokenIds[index]!,
          outcomeLabel,
          normalizedOutcomeKey: normalized.normalizedOutcomeKey,
          binaryOutcomeRole: normalized.binaryOutcomeRole,
          price: null,
          winner: null,
        };
      });

      const entry: CatalogEntry = {
        catalogId: candidate.conditionId,
        source: "polymarket",
        conditionId: candidate.conditionId,
        question,
        marketSlug,

        rawGameStartTime: resolvedStartTime.rawGameStartTime,
        gameStartTime: resolvedStartTime.gameStartTime,
        gameStartTimeSource: "GAMMA",

        shape: "BINARY_YES_NO" as CatalogEntry["shape"],

        semanticType: semantic.semanticType,
        semanticSupported: semantic.isSemanticallySupported,
        semanticReasonCode: semantic.semanticReasonCode,
        semanticReasonDetail: semantic.semanticReasonDetail,
        referencedTeam: semantic.referencedTeam,
        yesSemanticMode: semantic.yesSemanticMode,
        noSemanticMode: semantic.noSemanticMode,

        quoteEligible: true,
        quoteReasonCode: "SEMANTIC_BINARY_QUOTE_ELIGIBLE",
        quoteReasonDetail:
          "Competition-scoped Gamma market passed yes/no shape and supported semantic checks",

        tradeEligible: false,
        tradeReasonCode: "NEG_RISK_UNSUPPORTED",
        tradeReasonDetail:
          "Quote is allowed, but automated trading is blocked for negRisk markets in the current scope",

        isEligible: true,
        reasonCode: "SEMANTIC_BINARY_QUOTE_ELIGIBLE",
        reasonDetail:
          "Competition-scoped Gamma market passed yes/no shape and supported semantic checks",

        sportsPlausible: true,
        sportsReasonCode: "COMPETITION_SCOPE_GAMMA_SERIES_MATCH",
        sportsReasonDetail:
          "Candidate came from explicit competition-series discovery in Gamma",

        matchedGammaSource: candidate.source,
        matchedGammaId: candidate.id,
        matchedGammaStartTime: candidate.startTime,

        outcomes: pairedOutcomes,
        discoveredAt: now,
        lastSeenAt: now,
      };

      entries.push(entry);
    }

    diagnostics.builtEntries = entries.length;

    return {
      entries,
      diagnostics,
    };
  }

  private resolveReliableGameStartTime(
    candidate: GammaDiscoveredCandidate
  ): ResolvedGameStartTime {
    const rawGameStartTime = candidate.startTime?.trim() ?? null;

    const fromSlug = this.extractDateFromSlug(candidate.slug);
    const fromQuestion = this.extractDateFromQuestion(candidate.question);
    const inferredDate = fromSlug ?? fromQuestion;
    const inferredFrom: InferenceSource = fromSlug ? "SLUG" : fromQuestion ? "QUESTION" : null;

    if (!inferredDate) {
      return {
        rawGameStartTime,
        gameStartTime: rawGameStartTime,
        corrected: false,
        inferredFrom: null,
        defaultedTime: false,
      };
    }

    if (!rawGameStartTime) {
      return {
        rawGameStartTime: null,
        gameStartTime: this.buildIsoWithFallbackTime(inferredDate),
        corrected: true,
        inferredFrom,
        defaultedTime: true,
      };
    }

    const rawDate = this.tryParseDate(rawGameStartTime);

    if (!rawDate) {
      return {
        rawGameStartTime,
        gameStartTime: this.buildIsoWithFallbackTime(inferredDate),
        corrected: true,
        inferredFrom,
        defaultedTime: true,
      };
    }

    const rawDateOnly = this.toIsoDate(rawDate);

    if (rawDateOnly === inferredDate) {
      return {
        rawGameStartTime,
        gameStartTime: rawGameStartTime,
        corrected: false,
        inferredFrom,
        defaultedTime: false,
      };
    }

    const corrected = new Date(
      Date.UTC(
        Number.parseInt(inferredDate.slice(0, 4), 10),
        Number.parseInt(inferredDate.slice(5, 7), 10) - 1,
        Number.parseInt(inferredDate.slice(8, 10), 10),
        rawDate.getUTCHours(),
        rawDate.getUTCMinutes(),
        rawDate.getUTCSeconds(),
        rawDate.getUTCMilliseconds()
      )
    ).toISOString();

    return {
      rawGameStartTime,
      gameStartTime: corrected,
      corrected: true,
      inferredFrom,
      defaultedTime: false,
    };
  }

  private extractDateFromSlug(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const match = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    return match?.[1] ?? null;
  }

  private extractDateFromQuestion(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const match = value.match(/\bon\s+(20\d{2}-\d{2}-\d{2})\b/i);
    return match?.[1] ?? null;
  }

  private tryParseDate(value: string): Date | null {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private buildIsoWithFallbackTime(date: string): string {
    return `${date}T${String(this.fallbackHourUtc).padStart(2, "0")}:00:00.000Z`;
  }

  private pushExample(
    diagnostics: CompetitionQuoteBuildDiagnostics,
    candidate: GammaDiscoveredCandidate,
    reason: string,
    resolved: ResolvedGameStartTime | null
  ): void {
    if (diagnostics.examples.length >= this.maxExamples) {
      return;
    }

    diagnostics.examples.push({
      conditionId: candidate.conditionId,
      marketSlug: candidate.slug,
      question: candidate.question,
      outcomes: candidate.outcomes,
      reason,
      originalStartTime: candidate.startTime ?? null,
      resolvedGameStartTime: resolved?.gameStartTime ?? null,
    });
  }
}
