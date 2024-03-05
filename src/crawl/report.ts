import { dirname, join } from "std/path";
import { Asset } from "./asset.ts";

interface ReportMeta {
  started: string; // ISO Date
  finished?: string; // ISO Date
  version: string; // Application version
}

export interface AssetReportData {
  url: string | undefined;
  data_mime: string | null;
  charset: string | null;
  last_modified: string | null;
  hash: string | null;
  references: string[]; // References is string[] instead of Set
}

export interface ReportData {
  meta: ReportMeta;
  assets: AssetReportData[];
}

export class Report {
  data: ReportData;

  constructor(version: string) {
    this.data = {
      assets: [],
      meta: {
        started: new Date().toISOString(),
        version: version,
      },
    };
  }

  addAsset(asset: Asset) {
    this.data.assets.push({
      url: asset.url as string,
      last_modified: asset.last_modified,
      data_mime: asset.data_mime,
      charset: asset.charset,
      hash: asset.hash,
      references: Array.from(asset.references),
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
