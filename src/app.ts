import { SamplingMarketsClient } from "./clients/samplingMarketsClient.js";
import { GammaSportsDiscoveryClient } from "./clients/gammaSportsDiscoveryClient.js";
import { OutcomeNormalizer } from "./classification/outcomeNormalizer.js";
import { MarketShapeClassifier } from "./classification/marketShapeClassifier.js";
import { EligibilityService } from "./classification/eligibilityService.js";
import { FootballMarketScope } from "./classification/footballMarketScope.js";
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
    semanticClassifier
  );

  const store = new CatalogStore();
  const redisClientFactory = new RedisClientFactory();
  const redisPublisher = new CatalogRedisPublisher(redisClientFactory);

  try {
    console.log("[bootstrap] Fetching sports candidates from Gamma...");
    const gammaCandidates = await gammaClient.fetchSportsCandidates();
    console.log(
      `[bootstrap] Retrieved ${gammaCandidates.length} Gamma sports candidates`
    );

    console.log("[bootstrap] Fetching sampling markets from Polymarket CLOB...");
    const clobMarkets = await clobClient.fetchAllSamplingMarkets();
    console.log(`[bootstrap] Retrieved ${clobMarkets.length} raw CLOB markets`);

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

    console.log(`[bootstrap] Built catalog entries: ${catalog.length}`);
    console.log(`[bootstrap] Sports plausible: ${sportsPlausible}`);
    console.log(`[bootstrap] Quote eligible: ${quoteEligible}`);
    console.log(`[bootstrap] Trade eligible: ${tradeEligible}`);
    console.log(`[bootstrap] Rejected for quote: ${rejectedForQuote}`);
    console.log(
      `[bootstrap] Game start time recovered from Gamma: ${recoveredGameStartTime}`
    );

    const quoteSummary = new Map<string, number>();
    for (const entry of catalog) {
      quoteSummary.set(
        entry.reasonCode,
        (quoteSummary.get(entry.reasonCode) ?? 0) + 1
      );
    }

    console.log("[bootstrap] Quote eligibility summary:");
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

    console.log("[bootstrap] Trade eligibility summary:");
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

    console.log("[bootstrap] Sports plausibility summary:");
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

    console.log("[bootstrap] Semantic summary:");
    for (const [reason, count] of semanticSummary.entries()) {
      console.log(`  - ${reason}: ${count}`);
    }

    await store.saveCatalog(catalog);
    await store.saveFootballMatchCatalog(footballMatchCatalog);
    await store.saveFootballQuoteCandidates(quoteEligibleCatalog);

    console.log(
      `[bootstrap] Saved football match catalog: ${footballMatchCatalog.length}`
    );
    console.log(
      `[bootstrap] Saved football quote candidates: ${quoteEligibleCatalog.length}`
    );

    const competitionSeriesIds = env.competitionSeriesIds;
    console.log(
      `[bootstrap] Fetching competition-scoped Gamma candidates for series_ids: ${competitionSeriesIds.join(",")}`
    );

    const competitionCandidates =
      await gammaClient.fetchCompetitionCandidatesBySeriesIds(
        competitionSeriesIds
      );

    console.log(
      `[bootstrap] Retrieved ${competitionCandidates.length} competition-scoped Gamma candidates`
    );

    const brazilBuild = competitionQuoteCandidateBuilder.build(
      competitionCandidates
    );

    await store.saveFootballQuoteCandidatesBrazil(brazilBuild.entries);
    await store.saveFootballQuoteCandidatesBrazilDiagnostics(
      brazilBuild.diagnostics
    );

    console.log(
      `[bootstrap] Saved football Brazil quote candidates: ${brazilBuild.entries.length}`
    );
    console.log(
      `[bootstrap] Brazil diagnostics -> total=${brazilBuild.diagnostics.totalCandidates} built=${brazilBuild.diagnostics.builtEntries} missingConditionId=${brazilBuild.diagnostics.missingConditionId} missingQuestion=${brazilBuild.diagnostics.missingQuestion} missingMarketSlug=${brazilBuild.diagnostics.missingMarketSlug} missingStartTime=${brazilBuild.diagnostics.missingStartTime} missingTokenIds=${brazilBuild.diagnostics.missingTokenIds} unsupportedOutcomeShape=${brazilBuild.diagnostics.unsupportedOutcomeShape} unsupportedSemantic=${brazilBuild.diagnostics.unsupportedSemantic} preservedStartTime=${brazilBuild.diagnostics.preservedStartTime} correctedStartTime=${brazilBuild.diagnostics.correctedStartTime} inferredFromSlug=${brazilBuild.diagnostics.inferredFromSlug} inferredFromQuestion=${brazilBuild.diagnostics.inferredFromQuestion} defaultedTime=${brazilBuild.diagnostics.defaultedTime}`
    );

    for (const example of brazilBuild.diagnostics.examples.slice(0, 10)) {
      console.log(
        `[bootstrap] Brazil unsupported example -> reason=${example.reason} conditionId=${example.conditionId ?? "null"} slug=${example.marketSlug ?? "null"} question=${example.question ?? "null"} originalStartTime=${example.originalStartTime ?? "null"} resolvedGameStartTime=${example.resolvedGameStartTime ?? "null"} outcomes=${JSON.stringify(example.outcomes)}`
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
      `[bootstrap] Published Redis quote snapshot: ${redisPayload.length} scope=${redisScope} competitionSeriesIds=${competitionSeriesIds.join(",")}`
    );
    console.log("[bootstrap] Catalog saved successfully");
  } finally {
    await redisPublisher.disconnect();
  }
}

main().catch((err) => {
  console.error("[bootstrap] Fatal error:", err);
  process.exit(1);
});
