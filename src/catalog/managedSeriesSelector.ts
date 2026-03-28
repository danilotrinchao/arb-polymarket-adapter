import { env } from "../config/env.js";
import {
  GammaSportResponse,
  ManagedSeriesRecord,
} from "../types/gammaDiscovery.js";

export interface ManagedSeriesSelection {
  discovered: ManagedSeriesRecord[];
  enabled: ManagedSeriesRecord[];
}

export class ManagedSeriesSelector {
  public select(sports: GammaSportResponse[]): ManagedSeriesSelection {
    const discoveredBySeriesId = new Map<string, ManagedSeriesRecord>();

    for (const raw of sports) {
      const seriesId = this.normalizeSeriesId(raw.series);
      if (!seriesId) {
        continue;
      }

      if (discoveredBySeriesId.has(seriesId)) {
        continue;
      }

      const sportKey = this.normalizeString(raw.sport);
      const enabledBySeries = env.enabledSeriesIds.includes(seriesId);
      const enabledBySport =
        sportKey !== null && env.enabledSportKeys.includes(sportKey);

      let enabledReason: string | null = null;

      if (enabledBySeries) {
        enabledReason = "ENABLED_BY_SERIES_ID";
      } else if (enabledBySport) {
        enabledReason = "ENABLED_BY_SPORT_KEY";
      }

      discoveredBySeriesId.set(seriesId, {
        sportId: typeof raw.id === "number" ? raw.id : null,
        sportKey,
        seriesId,
        seriesSlug: sportKey, // fallback seguro
        seriesTitle: null,    // /sports não fornece isso de forma confiável
        resolution: this.normalizeString(raw.resolution),
        ordering: this.normalizeString(raw.ordering),
        tags: this.parseCommaTags(raw.tags),
        createdAt: this.normalizeString(raw.createdAt),
        enabled: enabledBySeries || enabledBySport,
        enabledReason,
      });
    }

    const discovered = [...discoveredBySeriesId.values()].sort((a, b) =>
      a.seriesId.localeCompare(b.seriesId)
    );

    const enabled = discovered.filter((item) => item.enabled);

    if (enabled.length === 0) {
      throw new Error(
        "Nenhuma série foi habilitada. Configure POLY_ENABLED_SERIES_IDS e/ou POLY_ENABLED_SPORT_KEYS."
      );
    }

    return {
      discovered,
      enabled,
    };
  }

  private normalizeSeriesId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (trimmed.toUpperCase() === "TBD") {
      return null;
    }

    return trimmed;
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseCommaTags(value: unknown): string[] {
    if (typeof value !== "string") {
      return [];
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}