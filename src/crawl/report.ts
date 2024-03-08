import { dirname, join } from "std/path";
import { Asset } from "./asset.ts";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assetQueue from "./queue.ts";
import { Debug } from "../cli/debug.ts";

interface ReportMeta {
  started: string; // ISO Date
  finished?: string; // ISO Date
  queue?: string[]; // Queue left
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
    if (assetQueue.queue.length === 0) {
      this.data.meta.finished = new Date().toISOString();
    } else {
      if (assetQueue.queue.length > 0) { this.data.meta.queue = assetQueue.queue};
    }
    const reportString = JSON.stringify(this.data, null, 2);
    if (outputDirectory) {
      const filePath = join(outputDirectory, fileName);
      const dirPath = dirname(filePath);
      try {
        await mkdir(dirPath, { recursive: true });
        await writeFile(filePath, new TextEncoder().encode(reportString));
        console.log(`Report saved to: ${filePath}`);
      } catch (error) {
        console.error(`Error saving report: ${error}`);
      }
    }
  }

  async resume(outputDirectory: string, fileName: string) {
    try {
      const reportFilePath = join(outputDirectory, fileName);
      const fileData = await readFile(reportFilePath, { encoding: 'utf8' });
      const reportData: ReportData = JSON.parse(fileData);
      
      // Overwrite start date
      this.data.meta.started = reportData.meta.started;

      // Reconstruct all assets
      reportData.assets.forEach((assetData) => {
        const asset = new Asset(assetData.url);
        asset.data_mime = assetData.data_mime;
        asset.charset = assetData.charset;
        asset.last_modified = assetData.last_modified;
        asset.hash = assetData.hash;
   
        // Add references to the Set
        assetData.references.forEach(ref => asset.references.add(ref)); 

        this.addAsset(asset);
      });

      // Feed queue
      reportData.meta.queue?.forEach(entry => assetQueue.enqueue(entry)); 

      console.log("Assets from report loaded into the queue.");
    } catch (error) {
      console.error(`Error loading report for resume: ${error}`);
    }
  }
}
