import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env.js";

export class RedisClientFactory {
  private client: RedisClientType | null = null;

  public async getClient(): Promise<RedisClientType> {
    if (this.client?.isOpen) {
      return this.client;
    }

    if (!this.client) {
      this.client = createClient({
        url: env.redisUrl,
      });

      this.client.on("error", (error) => {
        console.error("[redis] Client error:", error);
      });
    }

    if (!this.client.isOpen) {
      await this.client.connect();
      console.log(`[redis] Connected: ${env.redisUrl}`);
    }

    return this.client;
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    if (this.client.isOpen) {
      await this.client.quit();
      console.log("[redis] Disconnected");
    }

    this.client = null;
  }
}
