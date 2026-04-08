import axios, { AxiosInstance } from "axios";
import { env } from "../config/env.js";

export interface ClobBookLevel {
  price: string;
  size: string;
}

export interface ClobOrderBookResponse {
  market?: string | undefined;
  asset_id?: string | undefined;
  timestamp?: string | undefined;
  hash?: string | undefined;
  bids: ClobBookLevel[];
  asks: ClobBookLevel[];
  last_trade_price?: string | undefined;
}

export class ClobOrderBookClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.polymarketClobBaseUrl,
      timeout: env.gammaRequestTimeoutMs,
    });
  }

  public async getOrderBook(tokenId: string): Promise<ClobOrderBookResponse> {
    const response = await this.http.get<ClobOrderBookResponse>("/book", {
      params: { token_id: tokenId },
    });

    return {
      bids: Array.isArray(response.data?.bids) ? response.data.bids : [],
      asks: Array.isArray(response.data?.asks) ? response.data.asks : [],
      last_trade_price: response.data?.last_trade_price,
      market: response.data?.market,
      asset_id: response.data?.asset_id,
      timestamp: response.data?.timestamp,
      hash: response.data?.hash,
    };
  }
}