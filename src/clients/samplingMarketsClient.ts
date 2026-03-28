import axios, { AxiosInstance } from "axios";
import { env } from "../config/env.js";
import { PolymarketSamplingMarketResponse } from "../types/discoveredMarket.js";

interface SamplingMarketsEnvelope {
  data?: PolymarketSamplingMarketResponse[];
  next_cursor?: string | null;
  limit?: number;
  count?: number;
}

export class SamplingMarketsClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.polymarketClobBaseUrl,
      timeout: env.gammaRequestTimeoutMs,
    });
  }

  public async fetchAllSamplingMarkets(): Promise<PolymarketSamplingMarketResponse[]> {
    const allMarkets: PolymarketSamplingMarketResponse[] = [];
    let nextCursor: string | null = null;
    let page = 1;

    while (true) {
      const response: { data: SamplingMarketsEnvelope } = await this.http.get<SamplingMarketsEnvelope>("/sampling-markets", {
        params: nextCursor ? { next_cursor: nextCursor } : undefined,
      });

      if (page === 1) {
        console.log("[sampling] baseURL:", env.polymarketClobBaseUrl);
        console.log("[sampling] raw response type:", typeof response.data);
        console.log(
          "[sampling] raw response keys:",
          response.data && typeof response.data === "object"
            ? Object.keys(response.data as Record<string, unknown>)
            : []
        );
        console.log(
          "[sampling] raw response preview:",
          JSON.stringify(response.data).slice(0, 1000)
        );
      }

      const markets = Array.isArray(response.data?.data) ? response.data.data : [];
      const rawNextCursor: string | null =
        typeof response.data?.next_cursor === "string"
          ? response.data.next_cursor.trim()
          : null;

      console.log(
        `[sampling] page=${page} fetched=${markets.length} next_cursor=${rawNextCursor ?? "null"}`
      );

      if (markets.length === 0) {
        break;
      }

      allMarkets.push(...markets);

      if (this.isTerminalCursor(rawNextCursor)) {
        break;
      }

      nextCursor = rawNextCursor;
      page += 1;
    }

    return allMarkets;
  }

  private isTerminalCursor(cursor: string | null): boolean {
    if (!cursor || cursor.length === 0) {
      return true;
    }

    if (cursor === "LTE=") {
      return true;
    }

    const decoded = this.tryDecodeBase64(cursor);
    if (decoded === "-1") {
      return true;
    }

    return false;
  }

  private tryDecodeBase64(value: string): string | null {
    try {
      return Buffer.from(value, "base64").toString("utf-8").trim();
    } catch {
      return null;
    }
  }
}