import { SamplingMarketsClient } from "./clients/samplingMarketsClient.js";
import { GammaSportsDiscoveryClient } from "./clients/gammaSportsDiscoveryClient.js";
import { OutcomeNormalizer } from "./classification/outcomeNormalizer.js";
import { MarketShapeClassifier } from "./classification/marketShapeClassifier.js";
import { EligibilityService } from "./classification/eligibilityService.js";
import { FootballMarketScope } from "./classification/footballMarketScope.js";
import { NbaMarketScope } from "./classification/nbaMarketScope.js";
import { GammaMarketMatcher } from "./classification/gammaMarketMatcher.js";
import { SemanticClassifier } from "./classification/semanticClassifier.js";
import { CatalogBuilderService } from "./catalog/catalogBuilderService.js";
import { CompetitionQuoteCandidateBuilder } from "./catalog/competitionQuoteCandidateBuilder.js";
import { CatalogStore } from "./storage/catalogStore.js";
import { RedisClientFactory } from "./integration/redisClient.js";
import { CatalogRedisPublisher } from "./publishers/catalogRedisPublisher.js";
import { env } from "./config/env.js";

async function main(): Promise<void> {
  const clobClient = new SamplingMarketsClient();
  const gammaClient = new GammaSportsDiscoveryClient();

  const outcomeNormalizer = new OutcomeNormalizer();
  const shapeClassifier = new MarketShapeClassifier(outcomeNormalizer);
  const eligibilityService = new EligibilityService(outcomeNormalizer);
  const footballMarketScope = new FootballMarketScope();
  const nbaMarketScope = new NbaMarketScope();
  const gammaMarketMatcher = new GammaMarketMatcher();
  const semanticClassifier = new SemanticClassifier(outcomeNormalizer);
  const competitionQuoteCandidateBuilder = new CompetitionQuoteCandidateBuilder(
    outcomeNormalizer,
    semanticClassifier
  );

  const catalogBuilder = new CatalogBuilderService(
    shapeClassifier,
    eligibilityService,
    gammaMarketMatcher,
    footballMarketScope,
    semanticClassifier,
    nbaMarketScope
  );

  const store = new CatalogStore();
  const redisClientFactory = new RedisClientFactory();
  const redisPublisher = new CatalogRedisPublisher(redisClientFactory);

  try {
    // ── Football ─────────────────────────────────────────────────────────────
    console.log("[bootstrap] sport=football source=gamma Fetching sports candidates...");
    const gammaCandidates = await gammaClient.fetchSportsCandidates();
    console.log(
      `[bootstrap] sport=football source=gamma candidates=${gammaCandidates.length}`
    );

    console.log("[bootstrap] sport=football source=clob Fetching sampling markets...");
    const clobMarkets = await clobClient.fetchAllSamplingMarkets();
    console.log(`[bootstrap] sport=football source=clob markets=${clobMarkets.length}`);

    console.log("[debug] nbaEnabled=", env.nbaEnabled);
    console.log("[debug] nbaSeriesIds=", env.nbaSeriesIds);

    const catalog = catalogBuilder.build(clobMarkets, gammaCandidates);

    const sportsPlausible = catalog.filter((x) => x.sportsPlausible).length;
    const quoteEligibleCatalog = catalog.filter((x) => x.quoteEligible);
    const footballMatchCatalog = catalog.filter((x) => x.sportsPlausible);
    const quoteEligible = quoteEligibleCatalog.length;
    const tradeEligible = catalog.filter((x) => x.tradeEligible).length;
    const rejectedForQuote = catalog.length - quoteEligible;

    const recoveredGameStartTime = catalog.filter(
      (x) => x.gameStartTime !== null
    ).length;

    console.log(`[bootstrap] sport=football catalog=${catalog.length} sportsPlausible=${sportsPlausible} quoteEligible=${quoteEligible} tradeEligible=${tradeEligible} rejected=${rejectedForQuote} startTimeRecovered=${recoveredGameStartTime}`);

    const quoteSummary = new Map<string, number>();
    for (const entry of catalog) {
      quoteSummary.set(
        entry.reasonCode,
        (quoteSummary.get(entry.reasonCode) ?? 0) + 1
      );
    }

    console.log("[bootstrap] sport=football Quote eligibility summary:");
    for (const [reason, count] of quoteSummary.entries()) {
      console.log(`  - ${reason}: ${count}`);
    }

    const tradeSummary = new Map<string, number>();
    for (const entry of catalog) {
      tradeSummary.set(
        entry.tradeReasonCode,
        (tradeSummary.get(entry.tradeReasonCode) ?? 0) + 1
      );
    }

    console.log("[bootstrap] sport=football Trade eligibility summary:");
    for (const [reason, count] of tradeSummary.entries()) {
      console.log(`  - ${reason}: ${count}`);
    }

    const sportsSummary = new Map<string, number>();
    for (const entry of catalog) {
      sportsSummary.set(
        entry.sportsReasonCode,
        (sportsSummary.get(entry.sportsReasonCode) ?? 0) + 1
      );
    }

    console.log("[bootstrap] sport=football Sports plausibility summary:");
    for (const [reason, count] of sportsSummary.entries()) {
      console.log(`  - ${reason}: ${count}`);
    }

    const semanticSummary = new Map<string, number>();
    for (const entry of catalog) {
      semanticSummary.set(
        entry.semanticType,
        (semanticSummary.get(entry.semanticType) ?? 0) + 1
      );
    }

    console.log("[bootstrap] sport=football Semantic summary:");
    for (const [reason, count] of semanticSummary.entries()) {
      console.log(`  - ${reason}: ${count}`);
    }

    await store.saveCatalog(catalog);
    await store.saveFootballMatchCatalog(footballMatchCatalog);
    await store.saveFootballQuoteCandidates(quoteEligibleCatalog);

    console.log(
      `[bootstrap] sport=football Saved matchCatalog=${footballMatchCatalog.length} quoteCandidates=${quoteEligibleCatalog.length}`
    );

    const competitionSeriesIds = env.competitionSeriesIds;
    console.log(
      `[bootstrap] sport=football source=gamma Fetching competition candidates seriesIds=${competitionSeriesIds.join(",")}`
    );

    const competitionCandidates =
      await gammaClient.fetchCompetitionCandidatesBySeriesIds(
        competitionSeriesIds
      );

    console.log(
      `[bootstrap] sport=football source=gamma competitionCandidates=${competitionCandidates.length}`
    );

    const brazilBuild = competitionQuoteCandidateBuilder.build(
      competitionCandidates
    );

    await store.saveFootballQuoteCandidatesBrazil(brazilBuild.entries);
    await store.saveFootballQuoteCandidatesBrazilDiagnostics(
      brazilBuild.diagnostics
    );

    console.log(
      `[bootstrap] sport=football league=brazil-serie-a quoteCandidates=${brazilBuild.entries.length}`
    );
    console.log(
      `[bootstrap] sport=football league=brazil-serie-a diagnostics -> total=${brazilBuild.diagnostics.totalCandidates} built=${brazilBuild.diagnostics.builtEntries} missingConditionId=${brazilBuild.diagnostics.missingConditionId} missingQuestion=${brazilBuild.diagnostics.missingQuestion} missingMarketSlug=${brazilBuild.diagnostics.missingMarketSlug} missingStartTime=${brazilBuild.diagnostics.missingStartTime} missingTokenIds=${brazilBuild.diagnostics.missingTokenIds} unsupportedOutcomeShape=${brazilBuild.diagnostics.unsupportedOutcomeShape} unsupportedSemantic=${brazilBuild.diagnostics.unsupportedSemantic} preservedStartTime=${brazilBuild.diagnostics.preservedStartTime} correctedStartTime=${brazilBuild.diagnostics.correctedStartTime} inferredFromSlug=${brazilBuild.diagnostics.inferredFromSlug} inferredFromQuestion=${brazilBuild.diagnostics.inferredFromQuestion} defaultedTime=${brazilBuild.diagnostics.defaultedTime}`
    );

    for (const example of brazilBuild.diagnostics.examples.slice(0, 10)) {
      console.log(
        `[bootstrap] sport=football league=brazil-serie-a unsupported -> reason=${example.reason} conditionId=${example.conditionId ?? "null"} slug=${example.marketSlug ?? "null"} question=${example.question ?? "null"} originalStartTime=${example.originalStartTime ?? "null"} resolvedGameStartTime=${example.resolvedGameStartTime ?? "null"} outcomes=${JSON.stringify(example.outcomes)}`
      );
    }

    const generatedAt = new Date().toISOString();

    const redisPayload =
      brazilBuild.entries.length > 0 ? brazilBuild.entries : quoteEligibleCatalog;

    const redisScope =
      brazilBuild.entries.length > 0 ? "BRAZIL_SERIE_A_SCOPED_GAMMA" : "GLOBAL_FALLBACK";

    await redisPublisher.publishQuoteEligibleSnapshot(redisPayload, {
      generatedAt,
      totalCatalog: catalog.length,
      sportsPlausible,
      quoteEligible: redisPayload.length,
      tradeEligible,
    });

    console.log(
      `[bootstrap] sport=football Published Redis snapshot count=${redisPayload.length} scope=${redisScope} stream=${env.redisFootballCatalogStreamKey}`
    );

    // ── NBA ───────────────────────────────────────────────────────────────────
    if (env.nbaEnabled) {
      if (env.nbaSeriesIds.length === 0) {
        console.log(
          "[bootstrap] sport=nba NBA_ENABLED=true but NBA_SERIES_IDS is empty — skipping"
        );
      } else {
        const nbaCandidates = await gammaClient.fetchNbaCandidates(env.nbaSeriesIds);

        const nbaCatalog = catalogBuilder.buildNba(clobMarkets, nbaCandidates);

        const nbaSportsPlausible = nbaCatalog.filter((x) => x.sportsPlausible).length;
        const nbaQuoteEligibleCatalog = nbaCatalog.filter((x) => x.quoteEligible);
        const nbaMatchCatalog = nbaCatalog.filter((x) => x.sportsPlausible);
        const nbaQuoteEligible = nbaQuoteEligibleCatalog.length;
        const nbaTradeEligible = nbaCatalog.filter((x) => x.tradeEligible).length;

        console.log(
          `[bootstrap] sport=nba catalog=${nbaCatalog.length} sportsPlausible=${nbaSportsPlausible} quoteEligible=${nbaQuoteEligible} tradeEligible=${nbaTradeEligible}`
        );

        const nbaQuoteSummary = new Map<string, number>();
        for (const entry of nbaCatalog) {
          nbaQuoteSummary.set(
            entry.reasonCode,
            (nbaQuoteSummary.get(entry.reasonCode) ?? 0) + 1
          );
        }

        console.log("[bootstrap] sport=nba Quote eligibility summary:");
        for (const [reason, count] of nbaQuoteSummary.entries()) {
          console.log(`  - ${reason}: ${count}`);
        }

        await store.saveNbaMatchCatalog(nbaMatchCatalog);
        await store.saveNbaQuoteCandidates(nbaQuoteEligibleCatalog);

        console.log(
          `[bootstrap] sport=nba Saved matchCatalog=${nbaMatchCatalog.length} quoteCandidates=${nbaQuoteEligibleCatalog.length}`
        );

        const nbaGeneratedAt = new Date().toISOString();

        await redisPublisher.publishSnapshot(nbaQuoteEligibleCatalog, {
          generatedAt: nbaGeneratedAt,
          totalCatalog: nbaCatalog.length,
          sportsPlausible: nbaSportsPlausible,
          quoteEligible: nbaQuoteEligible,
          tradeEligible: nbaTradeEligible,
        }, {
          sport: "nba",
          league: "nba",
          snapshotType: "NBA_QUOTE_ELIGIBLE",
          snapshotKey: env.redisNbaQuoteEligibleKey,
          streamKey: env.redisNbaCatalogStreamKey,
          streamEventType: "nba.catalog.updated",
        });

        console.log(
          `[bootstrap] sport=nba Published Redis snapshot count=${nbaQuoteEligibleCatalog.length} stream=${env.redisNbaCatalogStreamKey}`
        );
      }
    }

    console.log("[bootstrap] Catalog saved successfully");
  } finally {
    await redisPublisher.disconnect();
  }
}

main().catch((err) => {
  console.error("[bootstrap] Fatal error:", err);
  process.exit(1);
});
