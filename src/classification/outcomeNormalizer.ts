import { NormalizedOutcomeKey } from "../types/marketShape.js";

export type SupportedNormalizedOutcomeKey = NormalizedOutcomeKey | "YES" | "NO";
export type BinaryOutcomeRole = "YES" | "NO";

export interface NormalizedBinaryOutcome {
  normalizedOutcomeKey: SupportedNormalizedOutcomeKey | null;
  binaryOutcomeRole: BinaryOutcomeRole | null;
}

export class OutcomeNormalizer {
  public normalize(outcomeLabel: string | null | undefined): SupportedNormalizedOutcomeKey | null {
    return this.normalizeBinaryOutcome(outcomeLabel).normalizedOutcomeKey;
  }

  public normalizeBinaryOutcome(
    outcomeLabel: string | null | undefined
  ): NormalizedBinaryOutcome {
    const normalized = this.normalizeText(outcomeLabel);

    if (!normalized) {
      return {
        normalizedOutcomeKey: null,
        binaryOutcomeRole: null,
      };
    }

    if (this.isYes(normalized)) {
      return {
        normalizedOutcomeKey: "YES",
        binaryOutcomeRole: "YES",
      };
    }

    if (this.isNo(normalized)) {
      return {
        normalizedOutcomeKey: "NO",
        binaryOutcomeRole: "NO",
      };
    }

    if (normalized === "draw" || normalized === "empate") {
      return {
        normalizedOutcomeKey: "DRAW",
        binaryOutcomeRole: null,
      };
    }

    if (normalized === "home" || normalized === "casa") {
      return {
        normalizedOutcomeKey: "HOME",
        binaryOutcomeRole: null,
      };
    }

    if (normalized === "away" || normalized === "fora") {
      return {
        normalizedOutcomeKey: "AWAY",
        binaryOutcomeRole: null,
      };
    }

    return {
      normalizedOutcomeKey: null,
      binaryOutcomeRole: null,
    };
  }

  public areBinaryYesNo(labels: Array<string | null | undefined>): boolean {
    if (!Array.isArray(labels) || labels.length !== 2) {
      return false;
    }

    const normalized = labels.map((label) => this.normalizeBinaryOutcome(label));

    const roles = normalized
      .map((item) => item.binaryOutcomeRole)
      .filter((item): item is BinaryOutcomeRole => item === "YES" || item === "NO");

    if (roles.length !== 2) {
      return false;
    }

    return roles.includes("YES") && roles.includes("NO");
  }

  public isYesNoPair(labels: Array<string | null | undefined>): boolean {
    return this.areBinaryYesNo(labels);
  }

  private isYes(value: string): boolean {
    return value === "yes" || value === "sim" || value === "y" || value === "true";
  }

  private isNo(value: string): boolean {
    return value === "no" || value === "nao" || value === "n" || value === "false";
  }

  private normalizeText(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    return trimmed
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }
}
