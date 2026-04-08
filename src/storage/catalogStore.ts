import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { ManagedSeriesRecord } from "../types/gammaDiscovery.js";
import { QuoteEligibleArtifact } from "../types/quoteEligibleArtifact.js";

export class CatalogStore {
  private readonly dataDir: string;

  constructor() {
    this.dataDir = env.dataDir;
  }

  public async saveCatalog(catalog: readonly unknown[]): Promise<void> {
    await this.writeJson("polymarket-catalog.json", catalog);
  }

  public async saveSportsDiscovery(
    records: readonly ManagedSeriesRecord[]
  ): Promise<void> {
    await this.writeJson("polymarket-sports-discovery.json", records);
  }

  public async saveEnabledSeries(
    records: readonly ManagedSeriesRecord[]
  ): Promise<void> {
    await this.writeJson("polymarket-enabled-series.json", records);
  }

  public async saveQuoteEligible(
    records: readonly QuoteEligibleArtifact[]
  ): Promise<void> {
    await this.writeJson("polymarket-quote-eligible.json", records);
  }

  public async saveFootballMatchCatalog(records: readonly unknown[]): Promise<void> {
    await this.writeJson("football-match-catalog.json", records);
  }

  public async saveFootballQuoteCandidates(
    records: readonly unknown[]
  ): Promise<void> {
    await this.writeJson("football-quote-candidates.json", records);
  }

  public async saveFootballQuoteCandidatesBrazil(
    records: readonly unknown[]
  ): Promise<void> {
    await this.writeJson("football-quote-candidates-brazil.json", records);
  }

  public async saveFootballQuoteCandidatesBrazilDiagnostics(
    payload: unknown
  ): Promise<void> {
    await this.writeJson(
      "football-quote-candidates-brazil-diagnostics.json",
      payload
    );
  }

  public async saveNbaMatchCatalog(records: readonly unknown[]): Promise<void> {
    await this.writeJson("nba-match-catalog.json", records);
  }

  public async saveNbaQuoteCandidates(records: readonly unknown[]): Promise<void> {
    await this.writeJson("nba-quote-candidates.json", records);
  }

  public async save(catalog: readonly unknown[]): Promise<void> {
    await this.saveCatalog(catalog);
  }

  private async writeJson(fileName: string, payload: unknown): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });

    const filePath = path.join(this.dataDir, fileName);
    const content = JSON.stringify(payload, null, 2);

    await writeFile(filePath, content, "utf-8");
  }
}
