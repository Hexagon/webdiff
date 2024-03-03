import { dirname, join } from "std/path";
import { Asset } from "./asset.ts";
import type { AssetData } from "./asset.ts";

interface ReportMeta {
  started: string; // ISO Date
  finished?: string; // ISO Date
}

export interface ReportData {
  meta: ReportMeta;
  assets: AssetData[];
}

export class Report {
  data: ReportData;

  constructor() {
    this.data = {
      assets: [],
      meta: {
        started: new Date().toISOString(),
      },
    };
  }

  addAsset(asset: Asset) {
    this.data.assets.push({
      url: asset.url as string,
      lastModified: asset.lastModified,
      data_mime: asset.data_mime,
      hash: asset.hash,
      references: asset.references,
    });
  }

  async generate(outputDirectory: string, fileName: string): Promise<void> {
    this.data.meta.finished = new Date().toISOString();
    const reportString = JSON.stringify(this.data, null, 2);
    if (outputDirectory) {
      const filePath = join(outputDirectory, fileName);
      const dirPath = dirname(filePath);
      try {
        await Deno.mkdir(dirPath, { recursive: true });
        await Deno.writeFile(filePath, new TextEncoder().encode(reportString));
        console.log(`Report saved to: ${filePath}`);
      } catch (error) {
        console.error(`Error saving report: ${error}`);
      }
    }
  }
}
