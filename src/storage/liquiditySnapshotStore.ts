import { mkdir, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { LiquidityProbeSport, LiquiditySnapshotRecord } from "../types/liquiditySnapshot.js";

export class LiquiditySnapshotStore {
  private readonly dataDir: string;

  constructor() {
    this.dataDir = env.dataDir;
  }

  public async appendSportSnapshots(
    sport: LiquidityProbeSport,
    records: readonly LiquiditySnapshotRecord[]
  ): Promise<string> {
    const fileName = `${sport}-liquidity-snapshots.json`;
    return this.appendJsonLines(fileName, records);
  }

  public async appendCrossSportSnapshots(
    records: readonly LiquiditySnapshotRecord[]
  ): Promise<string> {
    return this.appendJsonLines("cross-sport-liquidity-snapshots.json", records);
  }

  public async writeLatestSnapshot(
    fileName: string,
    records: readonly LiquiditySnapshotRecord[]
  ): Promise<string> {
    await mkdir(this.dataDir, { recursive: true });

    const filePath = path.join(this.dataDir, fileName);
    const content = JSON.stringify(records, null, 2);

    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  private async appendJsonLines(
    fileName: string,
    records: readonly LiquiditySnapshotRecord[]
  ): Promise<string> {
    await mkdir(this.dataDir, { recursive: true });

    const filePath = path.join(this.dataDir, fileName);

    if (records.length === 0) {
      return filePath;
    }

    const lines = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
    await appendFile(filePath, lines, "utf-8");

    return filePath;
  }
}