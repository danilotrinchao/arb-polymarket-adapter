import { QuoteEligibleArtifact } from "../types/quoteEligibleArtifact.js";

interface RawOutcome {
  tokenId: string | null;
  outcomeLabel: string | null;
  normalizedOutcomeKey: string | null;
}

export class QuoteEligibleArtifactBuilder {
  public build(catalog: readonly unknown[]): QuoteEligibleArtifact[] {
    const result: QuoteEligibleArtifact[] = [];

    for (const item of catalog) {
      const artifact = this.toArtifact(item);
      if (artifact) {
        result.push(artifact);
      }
    }

    result.sort((a, b) => a.gameStartTime.localeCompare(b.gameStartTime));

    return result;
  }

  private toArtifact(input: unknown): QuoteEligibleArtifact | null {
    if (!this.isRecord(input)) {
      return null;
    }

    const quoteEligible = this.readBoolean(input.quoteEligible);
    if (!quoteEligible) {
      return null;
    }

    const conditionId = this.readString(input.conditionId);
    const marketSlug = this.readString(input.marketSlug);
    const question = this.readString(input.question);
    const gameStartTime = this.readString(input.gameStartTime);
    const semanticType = this.readString(input.semanticType);
    const referencedTeam = this.readString(input.referencedTeam);
    const tradeEligible = this.readBoolean(input.tradeEligible) ?? false;

    const outcomes = this.readOutcomes(input.outcomes);

    const yesTokenId = this.findTokenId(outcomes, "YES");
    const noTokenId = this.findTokenId(outcomes, "NO");

    if (!conditionId || !gameStartTime || !yesTokenId || !noTokenId) {
      return null;
    }

    return {
      source: "polymarket",
      conditionId,
      marketSlug,
      question,
      gameStartTime,
      semanticType,
      referencedTeam,
      tradeEligible,
      yesTokenId,
      noTokenId,
    };
  }

  private findTokenId(
    outcomes: readonly RawOutcome[],
    target: "YES" | "NO"
  ): string | null {
    const byNormalized = outcomes.find(
      (item) => item.normalizedOutcomeKey?.toUpperCase() === target
    );

    if (byNormalized?.tokenId) {
      return byNormalized.tokenId;
    }

    const byLabel = outcomes.find((item) => {
      const normalizedLabel = item.outcomeLabel?.trim().toUpperCase();
      return normalizedLabel === target;
    });

    return byLabel?.tokenId ?? null;
  }

  private readOutcomes(value: unknown): RawOutcome[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!this.isRecord(item)) return null;

        return {
          tokenId: this.readString(item.tokenId),
          outcomeLabel: this.readString(item.outcomeLabel),
          normalizedOutcomeKey: this.readString(item.normalizedOutcomeKey),
        };
      })
      .filter((item): item is RawOutcome => item !== null);
  }

  private readString(value: unknown): string | null {
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readBoolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}