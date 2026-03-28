import axios, { AxiosInstance } from "axios";
import { env } from "../config/env.js";
import {
  GammaDiscoveredCandidate,
  GammaEventMarketResponse,
  GammaEventResponse,
  GammaSportResponse,
  GammaTagResponse,
  GammaSeriesResponse,
} from "../types/gammaDiscovery.js";

type GammaArrayResponse<T> = T[] | { data?: T[] };

export class GammaFootballDiscoveryClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.polymarketGammaBaseUrl,
      timeout: env.gammaRequestTimeoutMs,
    });
  }

  public async fetchSports(): Promise<GammaSportResponse[]> {
    return this.fetchArrayOnce<GammaSportResponse>("/sports");
  }

  public async fetchActiveEventsBySeriesIds(
    seriesIds: readonly string[]
  ): Promise<GammaEventResponse[]> {
    const normalizedSeriesIds = [
      ...new Set(
        seriesIds
          .map((value) => this.normalizeSeriesId(value))
          .filter((value): value is string => value !== null)
      ),
    ];

    const all: GammaEventResponse[] = [];
    const seenEventIds = new Set<string>();

    for (const seriesId of normalizedSeriesIds) {
      const events = await this.fetchPagedArray<GammaEventResponse>("/events", {
        series_id: seriesId,
        active: true,
        closed: false,
      });

      for (const event of events) {
        const eventId = this.readString(event.id) ?? this.readString(event.slug);
        const dedupeKey = eventId ?? crypto.randomUUID();

        if (seenEventIds.has(dedupeKey)) {
          continue;
        }

        seenEventIds.add(dedupeKey);
        all.push(event);
      }
    }

    return all;
  }

  public toDiscoveredCandidates(
    events: readonly GammaEventResponse[]
  ): GammaDiscoveredCandidate[] {
    const result: GammaDiscoveredCandidate[] = [];
    const seen = new Set<string>();

    for (const event of events) {
      const eventId = this.readString(event.id);
      const eventSlug = this.readString(event.slug);
      const eventTitle = this.readString(event.title);
      const eventStartDate = this.readString(event.startDate);
      const eventTags = this.extractTags(event.tags);
      const eventSeries = this.readFirstSeries(event.series);

      const seriesId = this.readString(eventSeries?.id);
      const seriesSlug = this.readString(eventSeries?.slug);
      const seriesTitle = this.readString(eventSeries?.title);

      const homeTeam = this.readString(event.homeTeam);
      const awayTeam = this.readString(event.awayTeam);

      const markets = Array.isArray(event.markets) ? event.markets : [];

      for (const market of markets) {
        const marketId = this.readString(market.id);
        const conditionId = this.readString(market.conditionId);
        const marketSlug = this.readString(market.slug);
        const question = this.readString(market.question);
        const startTime = this.readString(market.startDate) ?? eventStartDate;

        const clobTokenIds = this.parseJsonStringArray(market.clobTokenIds);
        const outcomes = this.parseJsonStringArray(market.outcomes);

        const dedupeKey =
          conditionId ??
          `${eventId ?? "no-event"}::${marketId ?? "no-market"}::${marketSlug ?? "no-slug"}`;

        if (seen.has(dedupeKey)) {
          continue;
        }

        seen.add(dedupeKey);

        result.push({
          source: "gamma-event-market",
          id: dedupeKey,
          eventId,
          marketId,
          conditionId,
          slug: marketSlug ?? eventSlug,
          question,
          title: eventTitle,
          tags: eventTags,
          startTime,
          active: this.readBoolean(market.active),
          closed: this.readBoolean(market.closed),
          sportKey: seriesSlug,
          seriesId,
          seriesSlug,
          seriesTitle,
          homeTeam,
          awayTeam,
          clobTokenIds,
          outcomes,
        });
      }
    }

    return result;
  }

  private async fetchArrayOnce<T>(path: string): Promise<T[]> {
    const response = await this.getWithRetry<GammaArrayResponse<T>>(path);
    return this.extractArray(response);
  }

  private async fetchPagedArray<T>(
    path: string,
    baseParams: Record<string, unknown> = {}
  ): Promise<T[]> {
    const all: T[] = [];
    let offset = 0;
    const limit = env.gammaPageLimit;

    while (true) {
      const response = await this.getWithRetry<GammaArrayResponse<T>>(path, {
        ...baseParams,
        limit,
        offset,
      });

      const page = this.extractArray(response);

      if (page.length === 0) {
        break;
      }

      all.push(...page);

      if (page.length < limit) {
        break;
      }

      offset += limit;
    }

    return all;
  }

  private extractArray<T>(payload: GammaArrayResponse<T>): T[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    return Array.isArray(payload.data) ? payload.data : [];
  }

  private async getWithRetry<T>(
    path: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    let lastError: unknown = null;
    const maxAttempts = Math.max(1, env.gammaRetryCount);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.http.get<T>(path, { params });
        return response.data;
      } catch (error) {
        lastError = error;

        if (attempt >= maxAttempts) {
          break;
        }

        const delayMs = env.gammaRetryBaseDelayMs * attempt;

        console.warn(
          `[gamma] Request failed for ${path} attempt=${attempt}/${maxAttempts}. Retrying in ${delayMs}ms`
        );

        await this.delay(delayMs);
      }
    }

    throw lastError;
  }

  private readFirstSeries(
    series: GammaSeriesResponse[] | null | undefined
  ): GammaSeriesResponse | null {
    if (!Array.isArray(series) || series.length === 0) {
      return null;
    }

    const first = series[0];
    return first ?? null;
  }

  private extractTags(
    tags: Array<string | GammaTagResponse> | null | undefined
  ): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }

    const values = tags
      .map((tag) => {
        if (typeof tag === "string") {
          return tag;
        }

        return tag.slug ?? tag.label ?? tag.name ?? null;
      })
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase());

    return [...new Set(values)];
  }

  private parseJsonStringArray(value: unknown): string[] {
    if (typeof value !== "string") {
      return [];
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }

          if (typeof item === "number") {
            return String(item);
          }

          return null;
        })
        .filter((item): item is string => item !== null && item.length > 0);
    } catch {
      return [];
    }
  }

  private normalizeSeriesId(value: unknown): string | null {
    const raw = this.readString(value);
    if (!raw) {
      return null;
    }

    if (raw.toUpperCase() === "TBD") {
      return null;
    }

    return raw;
  }

  private readString(value: unknown): string | null {
    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readBoolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}