import axios, { AxiosInstance, AxiosResponse } from "axios";
import { env } from "../config/env.js";
import {
  GammaDiscoveredCandidate,
  GammaEventMarketResponse,
  GammaEventResponse,
  GammaSeriesResponse,
  GammaSportResponse,
  GammaTagResponse,
} from "../types/gammaDiscovery.js";

type GammaArrayResponse<T> = T[] | { data?: T[] };

export class GammaSportsDiscoveryClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.polymarketGammaBaseUrl,
      timeout: env.gammaRequestTimeoutMs,
    });
  }

  public async fetchSportsCandidates(): Promise<GammaDiscoveredCandidate[]> {
    const sports = await this.fetchSports();
    const selectedSports = this.filterEnabledSports(sports);

    const selectedSeriesIds = [
      ...new Set(
        selectedSports
          .map((sport) => this.readString(this.asRecord(sport)["series"]))
          .filter((value): value is string => this.isValidSeriesId(value))
      ),
    ];

    const sportBySeriesId = new Map<string, GammaSportResponse>();

    for (const sport of selectedSports) {
      const sportRecord = this.asRecord(sport);
      const seriesId = this.readString(sportRecord["series"]);

      if (this.isValidSeriesId(seriesId)) {
        sportBySeriesId.set(seriesId, sport);
      }
    }

    const eventPages = await Promise.all(
      selectedSeriesIds.map(async (seriesId) => {
        const events = await this.fetchEventsBySeries(seriesId);
        const sport = sportBySeriesId.get(seriesId) ?? null;
        return { seriesId, sport, events };
      })
    );

    const candidates = eventPages.flatMap(({ seriesId, sport, events }) =>
      events.flatMap((event) =>
        this.toEventMarketCandidates(event, seriesId, sport)
      )
    );

    return this.dedupeCandidates(candidates);
  }

  public async fetchCompetitionCandidatesBySeriesIds(
    seriesIds: readonly string[]
  ): Promise<GammaDiscoveredCandidate[]> {
    const normalizedSeriesIds = [...new Set(
      seriesIds
        .map((seriesId) => seriesId.trim())
        .filter((seriesId) => this.isValidSeriesId(seriesId))
    )];

    if (normalizedSeriesIds.length === 0) {
      return [];
    }

    const eventPages = await Promise.all(
      normalizedSeriesIds.map(async (seriesId) => {
        const events = await this.fetchEventsBySeries(seriesId);
        return { seriesId, events };
      })
    );

    const candidates = eventPages.flatMap(({ seriesId, events }) =>
      events.flatMap((event) =>
        this.toEventMarketCandidates(event, seriesId, null)
      )
    );

    return this.dedupeCandidates(candidates);
  }

  public async fetchNbaCandidates(
    seriesIds: readonly string[]
  ): Promise<GammaDiscoveredCandidate[]> {
    const normalizedSeriesIds = [...new Set(
      seriesIds
        .map((id) => id.trim())
        .filter((id) => this.isValidSeriesId(id))
    )];

    if (normalizedSeriesIds.length === 0) {
      console.log("[gamma] sport=nba Discovery skipped — no valid seriesIds configured");
      return [];
    }

    console.log(
      `[gamma] sport=nba Fetching candidates seriesIds=${normalizedSeriesIds.join(",")}`
    );

    const eventPages = await Promise.all(
      normalizedSeriesIds.map(async (seriesId) => {
        const events = await this.fetchEventsBySeries(seriesId);
        return { seriesId, events };
      })
    );

    const candidates = eventPages.flatMap(({ seriesId, events }) =>
      events.flatMap((event) =>
        this.toEventMarketCandidates(event, seriesId, null)
      )
    );

    const result = this.dedupeCandidates(candidates);

    console.log(
      `[gamma] sport=nba Discovery complete candidates=${result.length}`
    );

    return result;
  }

  private async fetchSports(): Promise<GammaSportResponse[]> {
    return this.fetchArrayOnce<GammaSportResponse>("/sports");
  }

  private async fetchEventsBySeries(seriesId: string): Promise<GammaEventResponse[]> {
    return this.fetchPagedArray<GammaEventResponse>("/events", {
      series_id: seriesId,
      active: true,
      closed: false,
    });
  }

  private async fetchArrayOnce<T>(path: string): Promise<T[]> {
    const response = await this.requestWithRetry<GammaArrayResponse<T>>(() =>
      this.http.get<GammaArrayResponse<T>>(path)
    );

    return this.extractPage(response.data);
  }

  private async fetchPagedArray<T>(
    path: string,
    baseParams: Record<string, unknown>
  ): Promise<T[]> {
    const all: T[] = [];
    let offset = 0;
    const limit = env.gammaPageLimit;

    while (true) {
      const response = await this.requestWithRetry<GammaArrayResponse<T>>(() =>
        this.http.get<GammaArrayResponse<T>>(path, {
          params: {
            ...baseParams,
            limit,
            offset,
          },
        })
      );

      const page = this.extractPage(response.data);

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

  private extractPage<T>(data: GammaArrayResponse<T>): T[] {
    if (Array.isArray(data)) {
      return data;
    }

    return Array.isArray(data.data) ? data.data : [];
  }

  private async requestWithRetry<T>(
    operation: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    const maxAttempts = Math.max(1, env.gammaRetryCount);
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;

      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt >= maxAttempts) {
          break;
        }

        const delayMs = env.gammaRetryBaseDelayMs * attempt;
        console.warn(
          `[gamma] Request failed attempt=${attempt}/${maxAttempts}. Retrying in ${delayMs}ms`
        );

        await this.delay(delayMs);
      }
    }

    throw lastError;
  }

  private filterEnabledSports(sports: GammaSportResponse[]): GammaSportResponse[] {
    const enabledSeriesIds = new Set(env.enabledSeriesIds.map((value) => value.trim()));
    const enabledSportKeys = new Set(
      env.enabledSportKeys.map((value) => value.trim().toLowerCase())
    );

    if (enabledSeriesIds.size > 0 || enabledSportKeys.size > 0) {
      return sports.filter((sport) => {
        const sportRecord = this.asRecord(sport);
        const seriesId = this.readString(sportRecord["series"]);
        const sportKey = this.readString(sportRecord["sport"])?.toLowerCase() ?? null;

        if (seriesId && enabledSeriesIds.has(seriesId)) {
          return true;
        }

        if (sportKey && enabledSportKeys.has(sportKey)) {
          return true;
        }

        return false;
      });
    }

    return sports.filter((sport) => this.looksLikeFootballSport(sport));
  }

  private looksLikeFootballSport(sport: GammaSportResponse): boolean {
    const record = this.asRecord(sport);
    const sportKey = this.readString(record["sport"])?.toLowerCase() ?? null;

    const tagsRaw = this.readString(record["tags"]);
    const tagList = tagsRaw
      ? tagsRaw
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : [];

    if (tagList.includes("100350")) {
      return true;
    }

    const knownFootballKeys = new Set([
      "bra",
      "bra2",
      "epl",
      "ucl",
      "uwcl",
      "lal",
      "bun",
      "fl1",
      "sea",
      "fif",
      "mls",
      "ere",
      "arg",
      "itc",
      "mex",
      "lcs",
      "lib",
      "sud",
      "tur",
      "por",
      "ind",
      "nor",
      "den",
      "jap",
      "ja2",
      "kor",
      "spl",
      "chi",
      "aus",
      "cdr",
      "col",
      "cde",
      "dfb",
      "efa",
      "efl",
      "uef",
      "caf",
      "cof",
      "con",
      "ofc",
      "afc",
      "acn",
      "rus",
      "ukr1",
      "mar1",
      "egy1",
      "cze1",
      "bol1",
      "rou1",
      "col1",
      "per1",
      "j1-100",
      "j2-100",
      "ssc",
    ]);

    return sportKey !== null && knownFootballKeys.has(sportKey);
  }

  private isValidSeriesId(seriesId: string | null): seriesId is string {
    if (!seriesId) {
      return false;
    }

    const normalized = seriesId.trim();
    if (normalized.length === 0) {
      return false;
    }

    if (normalized.toUpperCase() === "TBD") {
      return false;
    }

    return /^\d+$/.test(normalized);
  }

  private toEventMarketCandidates(
    event: GammaEventResponse,
    seriesId: string | null,
    sport: GammaSportResponse | null
  ): GammaDiscoveredCandidate[] {
    const eventRecord = this.asRecord(event);
    const sportRecord = sport ? this.asRecord(sport) : null;

    const eventId = this.readString(eventRecord["id"]);
    const eventSlug = this.readString(eventRecord["slug"]);
    const eventTitle = this.readString(eventRecord["title"]);
    const eventStartDate = this.readString(eventRecord["startDate"]);
    const eventActive = this.readBoolean(eventRecord["active"]);
    const eventClosed = this.readBoolean(eventRecord["closed"]);
    const homeTeam = this.readString(eventRecord["homeTeam"]);
    const awayTeam = this.readString(eventRecord["awayTeam"]);

    const eventTags = this.extractTags(
      eventRecord["tags"] as Array<string | GammaTagResponse> | null | undefined
    );

    const sportKey =
      (sportRecord ? this.readString(sportRecord["sport"]) : null) ??
      this.extractSportKeyFromSlug(eventSlug);

    const seriesArray = Array.isArray(eventRecord["series"])
      ? (eventRecord["series"] as GammaSeriesResponse[])
      : [];

    const firstSeries = seriesArray.length > 0 ? this.asRecord(seriesArray[0]) : null;

    const seriesSlug =
      (firstSeries ? this.readString(firstSeries["slug"]) : null) ??
      (sportRecord ? this.readString(sportRecord["sport"]) : null);

    const seriesTitle =
      (firstSeries ? this.readString(firstSeries["title"]) : null) ??
      (sportRecord ? this.readString(sportRecord["sport"]) : null);

    const rawMarkets = Array.isArray(eventRecord["markets"])
      ? (eventRecord["markets"] as GammaEventMarketResponse[])
      : [];

    return rawMarkets
      .map((market) =>
        this.toEventMarketCandidate(market, {
          eventId,
          eventSlug,
          eventTitle,
          eventStartDate,
          eventActive,
          eventClosed,
          homeTeam,
          awayTeam,
          tags: eventTags,
          sportKey,
          seriesId,
          seriesSlug,
          seriesTitle,
        })
      )
      .filter((candidate): candidate is GammaDiscoveredCandidate => candidate !== null);
  }

  private toEventMarketCandidate(
    market: GammaEventMarketResponse,
    context: {
      eventId: string | null;
      eventSlug: string | null;
      eventTitle: string | null;
      eventStartDate: string | null;
      eventActive: boolean | null;
      eventClosed: boolean | null;
      homeTeam: string | null;
      awayTeam: string | null;
      tags: string[];
      sportKey: string | null;
      seriesId: string | null;
      seriesSlug: string | null;
      seriesTitle: string | null;
    }
  ): GammaDiscoveredCandidate | null {
    const marketRecord = this.asRecord(market);

    const marketId = this.readString(marketRecord["id"]);
    const conditionId =
      this.readString(marketRecord["conditionId"]) ??
      this.readString(marketRecord["condition_id"]);

    const slug = this.readString(marketRecord["slug"]) ?? context.eventSlug;
    const question = this.readString(marketRecord["question"]);
    const title = context.eventTitle ?? question;

    const startTime =
      this.readString(marketRecord["startDate"]) ??
      this.readString(marketRecord["start_date"]) ??
      context.eventStartDate;

    const active = this.readBoolean(marketRecord["active"]) ?? context.eventActive;
    const closed = this.readBoolean(marketRecord["closed"]) ?? context.eventClosed;

    const outcomes = this.readStringArray(
      marketRecord["outcomes"],
      marketRecord["outcomeNames"]
    );

    const clobTokenIds = this.readStringArray(
      marketRecord["clobTokenIds"],
      marketRecord["clob_token_ids"]
    );

    if (!marketId && !conditionId && !slug && !question && !title) {
      return null;
    }

    return {
      source: "gamma-event-market",
      id:
        marketId ??
        conditionId ??
        slug ??
        `${context.eventId ?? "event"}:${question ?? title ?? "market"}`,

      eventId: context.eventId,
      marketId: marketId,
      conditionId: conditionId ?? null,

      slug: slug ?? null,
      question: question ?? null,
      title: title ?? null,

      tags: context.tags,
      startTime: startTime ?? null,
      active,
      closed,

      sportKey: context.sportKey,
      seriesId: context.seriesId,
      seriesSlug: context.seriesSlug,
      seriesTitle: context.seriesTitle,

      homeTeam: context.homeTeam,
      awayTeam: context.awayTeam,

      outcomes,
      clobTokenIds,
    };
  }

  private dedupeCandidates(
    candidates: GammaDiscoveredCandidate[]
  ): GammaDiscoveredCandidate[] {
    const map = new Map<string, GammaDiscoveredCandidate>();

    for (const candidate of candidates) {
      const key = candidate.conditionId ?? candidate.slug ?? candidate.id;

      if (!map.has(key)) {
        map.set(key, candidate);
      }
    }

    return [...map.values()];
  }

  private extractTags(tags: Array<string | GammaTagResponse> | null | undefined): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }

    const values = tags
      .map((tag) => {
        if (typeof tag === "string") {
          return tag;
        }

        const tagRecord = this.asRecord(tag);
        return (
          this.readString(tagRecord["slug"]) ??
          this.readString(tagRecord["label"]) ??
          this.readString(tagRecord["name"])
        );
      })
      .filter((value): value is string => value !== null)
      .map((value) => value.trim().toLowerCase());

    return [...new Set(values)];
  }

  private readStringArray(...values: unknown[]): string[] {
    for (const value of values) {
      const parsed = this.tryReadStringArray(value);
      if (parsed.length > 0) {
        return parsed;
      }
    }

    return [];
  }

  private tryReadStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.readString(item))
        .filter((item): item is string => item !== null);
    }

    if (typeof value !== "string") {
      return [];
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => this.readString(item))
          .filter((item): item is string => item !== null);
      }
    } catch {
      return [];
    }

    return [];
  }

  private extractSportKeyFromSlug(slug: string | null): string | null {
    if (!slug) {
      return null;
    }

    const normalized = slug.trim().toLowerCase();
    if (normalized.length === 0) {
      return null;
    }

    const firstDash = normalized.indexOf("-");
    if (firstDash <= 0) {
      return normalized;
    }

    return normalized.slice(0, firstDash);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value as Record<string, unknown>;
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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
