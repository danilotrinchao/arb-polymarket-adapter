import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

type CatalogOutcomeEntry = {
  tokenId: string;
  outcomeLabel: string;
  normalizedOutcomeKey: string | null;
  binaryOutcomeRole: string | null;
  price: number | null;
  winner: boolean | null;
};

type CatalogEntry = {
  catalogId: string;
  conditionId: string;
  question: string;
  marketSlug: string | null;
  shape: string;
  semanticType: string;
  quoteEligible: boolean;
  quoteReasonCode: string;
  quoteReasonDetail: string;
  tradeEligible?: boolean;
  tradeReasonCode?: string;
  tradeReasonDetail?: string;
  sportsPlausible: boolean;
  sportsReasonCode: string;
  sportsReasonDetail: string;
  matchedGammaId: string | null;
  matchedGammaStartTime: string | null;
  gameStartTime: string | null;
  outcomes: CatalogOutcomeEntry[];
};

const readJson = async <T>(fileName: string): Promise<T> => {
  const filePath = path.join(env.dataDir, fileName);
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
};

const increment = (map: Map<string, number>, key: string | null | undefined): void => {
  const normalized = key && key.trim().length > 0 ? key : "(null)";
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
};

const printMap = (title: string, map: Map<string, number>): void => {
  console.log(`\n${title}`);
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (sorted.length === 0) {
    console.log("  (vazio)");
    return;
  }

  for (const [key, count] of sorted) {
    console.log(`  - ${key}: ${count}`);
  }
};

const printMarket = (entry: CatalogEntry): void => {
  console.log("------------------------------------------------------------");
  console.log(`conditionId: ${entry.conditionId}`);
  console.log(`question: ${entry.question}`);
  console.log(`marketSlug: ${entry.marketSlug ?? "(null)"}`);
  console.log(`shape: ${entry.shape}`);
  console.log(`semanticType: ${entry.semanticType}`);
  console.log(`quoteEligible: ${entry.quoteEligible}`);
  console.log(`quoteReasonCode: ${entry.quoteReasonCode}`);
  console.log(`quoteReasonDetail: ${entry.quoteReasonDetail}`);
  console.log(`sportsPlausible: ${entry.sportsPlausible}`);
  console.log(`sportsReasonCode: ${entry.sportsReasonCode}`);
  console.log(`matchedGammaId: ${entry.matchedGammaId ?? "(null)"}`);
  console.log(`matchedGammaStartTime: ${entry.matchedGammaStartTime ?? "(null)"}`);
  console.log(`gameStartTime: ${entry.gameStartTime ?? "(null)"}`);
  console.log("outcomes:");

  for (const outcome of entry.outcomes ?? []) {
    console.log(
      `  - label="${outcome.outcomeLabel}" tokenId=${outcome.tokenId} normalized=${outcome.normalizedOutcomeKey ?? "(null)"} role=${outcome.binaryOutcomeRole ?? "(null)"}`
    );
  }
};

async function main(): Promise<void> {
  const fullCatalog = await readJson<CatalogEntry[]>("polymarket-catalog.json");
  const footballMatchCatalog = await readJson<CatalogEntry[]>("football-match-catalog.json");
  const footballQuoteCandidates = await readJson<CatalogEntry[]>("football-quote-candidates.json");

  console.log("[debug] Arquivos carregados:");
  console.log(`  - polymarket-catalog.json: ${fullCatalog.length}`);
  console.log(`  - football-match-catalog.json: ${footballMatchCatalog.length}`);
  console.log(`  - football-quote-candidates.json: ${footballQuoteCandidates.length}`);

  const shapeMap = new Map<string, number>();
  const quoteReasonMap = new Map<string, number>();
  const semanticMap = new Map<string, number>();
  const sportsReasonMap = new Map<string, number>();

  for (const entry of footballQuoteCandidates) {
    increment(shapeMap, entry.shape);
    increment(quoteReasonMap, entry.quoteReasonCode);
    increment(semanticMap, entry.semanticType);
    increment(sportsReasonMap, entry.sportsReasonCode);
  }

  printMap("[debug] Shapes no football-quote-candidates", shapeMap);
  printMap("[debug] Quote reasons no football-quote-candidates", quoteReasonMap);
  printMap("[debug] Semantic types no football-quote-candidates", semanticMap);
  printMap("[debug] Sports reasons no football-quote-candidates", sportsReasonMap);

  const binaryYesNo = footballQuoteCandidates.filter((x) => x.shape === "BINARY_YES_NO");
  const binaryUnknown = footballQuoteCandidates.filter((x) => x.shape !== "BINARY_YES_NO");

  console.log(`\n[debug] BINARY_YES_NO: ${binaryYesNo.length}`);
  console.log(`[debug] Outros shapes: ${binaryUnknown.length}`);

  const binaryWithBrokenOutcomes = binaryYesNo.filter((entry) =>
    (entry.outcomes ?? []).some(
      (o) => o.normalizedOutcomeKey === null || o.binaryOutcomeRole === null
    )
  );

  console.log(
    `[debug] BINARY_YES_NO com normalização quebrada: ${binaryWithBrokenOutcomes.length}`
  );

  const binaryRejected = binaryYesNo.filter((x) => !x.quoteEligible);
  console.log(`[debug] BINARY_YES_NO rejeitados para quote: ${binaryRejected.length}`);

  const binaryRejectedByReason = new Map<string, number>();
  for (const entry of binaryRejected) {
    increment(binaryRejectedByReason, entry.quoteReasonCode);
  }
  printMap("[debug] Motivos de rejeição dos BINARY_YES_NO", binaryRejectedByReason);

  const samplesBroken = binaryWithBrokenOutcomes.slice(0, 10);
  console.log(`\n[debug] Exemplos de BINARY_YES_NO com outcome quebrado: ${samplesBroken.length}`);
  for (const entry of samplesBroken) {
    printMarket(entry);
  }

  const samplesRejected = binaryRejected.slice(0, 10);
  console.log(`\n[debug] Exemplos de BINARY_YES_NO rejeitados: ${samplesRejected.length}`);
  for (const entry of samplesRejected) {
    printMarket(entry);
  }

  const fullCatalogByConditionId = new Map<string, CatalogEntry>();
  for (const entry of fullCatalog) {
    fullCatalogByConditionId.set(entry.conditionId, entry);
  }

  const onlyInFootballCatalog = footballMatchCatalog.filter(
    (entry) => !fullCatalogByConditionId.has(entry.conditionId)
  );

  console.log(
    `\n[debug] Mercados do football-match-catalog ausentes no polymarket-catalog: ${onlyInFootballCatalog.length}`
  );

  if (onlyInFootballCatalog.length > 0) {
    console.log("[debug] Exemplos ausentes no catálogo principal:");
    for (const entry of onlyInFootballCatalog.slice(0, 5)) {
      printMarket(entry);
    }
  }

  console.log("\n[debug] Auditoria concluída.");
}

main().catch((error) => {
  console.error("[debug] Falha na auditoria:", error);
  process.exit(1);
});