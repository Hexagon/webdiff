import { dirname, join } from "std/path";
import { Asset } from "./asset.ts";
import type { AssetData } from "./asset.ts";

export class Summary {
  assetData: AssetData[]; // Array to store asset summaries

  constructor() {
    this.assetData = [];
  }

  addAssetData(asset: Asset) {
    this.assetData.push({
      url: asset.url as string,
      lastModified: asset.lastModified,
      data_mime: asset.data_mime,
      hash: asset.hash,
      references: asset.references, // Copy references
    });
  }

  async generateReport(outputDirectory: string, fileName: string): Promise<void> {
    const report = JSON.stringify({ report: this.assetData }, null, 2);
    if (outputDirectory) {
      const filePath = join(outputDirectory, fileName);
      const dirPath = dirname(filePath);

      try {
        await Deno.mkdir(dirPath, { recursive: true });
        await Deno.writeFile(filePath, new TextEncoder().encode(report));
        console.log(`Report saved to: ${filePath}`);
      } catch (error) {
        console.error(`Error saving report: ${error}`);
      }
    }
  }
}
