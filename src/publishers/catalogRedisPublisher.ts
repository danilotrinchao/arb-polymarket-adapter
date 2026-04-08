import { env } from "../config/env.js";
import { RedisClientFactory } from "../integration/redisClient.js";
import { CatalogEntry } from "../types/catalogEntry.js";
import {
  CatalogPublishSummary,
  FootballQuoteEligibleSnapshot,
  RedisQuoteEligibleMarket,
} from "../types/redisCatalog.js";

export interface SportPublishContext {
  sport: string;
  league: string;
  snapshotType: string;
  snapshotKey: string;
  streamKey: string;
  streamEventType: string;
}

export class CatalogRedisPublisher {
  constructor(private readonly redisClientFactory: RedisClientFactory) {}

  // Mantido para compatibilidade com o fluxo atual de futebol
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
      `[redis] sport=football Snapshot saved key=${env.redisFootballQuoteEligibleKey} count=${payload.markets.length}`
    );
    console.log(
      `[redis] sport=football Stream event appended stream=${env.redisFootballCatalogStreamKey}`
    );
  }

  public async publishSnapshot(
    entries: readonly CatalogEntry[],
    summary: CatalogPublishSummary,
    ctx: SportPublishContext
  ): Promise<void> {
    if (!env.redisEnabled) {
      console.log(
        `[redis] Publishing skipped because REDIS_ENABLED=false sport=${ctx.sport} league=${ctx.league}`
      );
      return;
    }

    const client = await this.redisClientFactory.getClient();

    const payload = {
      snapshotType: ctx.snapshotType,
      version: summary.generatedAt,
      generatedAt: summary.generatedAt,
      summary,
      markets: entries.map((entry) => this.mapEntry(entry)),
    };

    await client.set(ctx.snapshotKey, JSON.stringify(payload));

    await client.xAdd(ctx.streamKey, "*", {
      eventType: ctx.streamEventType,
      sport: ctx.sport,
      league: ctx.league,
      version: payload.version,
      generatedAt: payload.generatedAt,
      totalCatalog: String(summary.totalCatalog),
      sportsPlausible: String(summary.sportsPlausible),
      quoteEligible: String(summary.quoteEligible),
      tradeEligible: String(summary.tradeEligible),
      snapshotKey: ctx.snapshotKey,
      snapshotCount: String(payload.markets.length),
    });

    console.log(
      `[redis] sport=${ctx.sport} league=${ctx.league} Snapshot saved key=${ctx.snapshotKey} count=${payload.markets.length}`
    );
    console.log(
      `[redis] sport=${ctx.sport} Stream event appended stream=${ctx.streamKey} eventType=${ctx.streamEventType}`
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
