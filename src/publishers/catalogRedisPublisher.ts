import { env } from "../config/env.js";
import { RedisClientFactory } from "../integration/redisClient.js";
import { CatalogEntry } from "../types/catalogEntry.js";
import {
  CatalogPublishSummary,
  FootballQuoteEligibleSnapshot,
  RedisQuoteEligibleMarket,
} from "../types/redisCatalog.js";

export class CatalogRedisPublisher {
  constructor(private readonly redisClientFactory: RedisClientFactory) {}

  public async publishQuoteEligibleSnapshot(
    entries: readonly CatalogEntry[],
    summary: CatalogPublishSummary
  ): Promise<void> {
    if (!env.redisEnabled) {
      console.log("[redis] Publishing skipped because REDIS_ENABLED=false");
      return;
    }

    const client = await this.redisClientFactory.getClient();

    const payload: FootballQuoteEligibleSnapshot = {
      snapshotType: "FOOTBALL_QUOTE_ELIGIBLE",
      version: summary.generatedAt,
      generatedAt: summary.generatedAt,
      summary,
      markets: entries.map((entry) => this.mapEntry(entry)),
    };

    await client.set(
      env.redisFootballQuoteEligibleKey,
      JSON.stringify(payload)
    );

    await client.xAdd(env.redisFootballCatalogStreamKey, "*", {
      eventType: "football.catalog.updated",
      version: payload.version,
      generatedAt: payload.generatedAt,
      totalCatalog: String(summary.totalCatalog),
      sportsPlausible: String(summary.sportsPlausible),
      quoteEligible: String(summary.quoteEligible),
      tradeEligible: String(summary.tradeEligible),
      snapshotKey: env.redisFootballQuoteEligibleKey,
      snapshotCount: String(payload.markets.length),
    });

    console.log(
      `[redis] Snapshot saved key=${env.redisFootballQuoteEligibleKey} count=${payload.markets.length}`
    );
    console.log(
      `[redis] Stream event appended stream=${env.redisFootballCatalogStreamKey}`
    );
  }

  public async disconnect(): Promise<void> {
    await this.redisClientFactory.disconnect();
  }

  private mapEntry(entry: CatalogEntry): RedisQuoteEligibleMarket {
    return {
      catalogId: entry.catalogId,
      conditionId: entry.conditionId,
      question: entry.question,
      marketSlug: entry.marketSlug,
      gameStartTime: entry.gameStartTime,
      gameStartTimeSource: entry.gameStartTimeSource,

      semanticType: entry.semanticType,
      referencedTeam: entry.referencedTeam,
      yesSemanticMode: entry.yesSemanticMode,
      noSemanticMode: entry.noSemanticMode,

      matchedGammaId: entry.matchedGammaId,
      matchedGammaStartTime: entry.matchedGammaStartTime,

      quoteReasonCode: entry.quoteReasonCode,
      tradeReasonCode: entry.tradeReasonCode,

      outcomes: entry.outcomes.map((outcome) => ({
        tokenId: outcome.tokenId,
        outcomeLabel: outcome.outcomeLabel,
        normalizedOutcomeKey: outcome.normalizedOutcomeKey,
        binaryOutcomeRole: outcome.binaryOutcomeRole,
        price: outcome.price,
        winner: outcome.winner,
      })),

      discoveredAt: entry.discoveredAt,
      lastSeenAt: entry.lastSeenAt,
    };
  }
}
