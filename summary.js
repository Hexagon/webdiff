import { Debug } from "./debug.js";
import { dirname, join } from "https://deno.land/std/path/mod.ts";

export class Summary {
  constructor() {
    this.assetData = []; // Array to store asset summaries
  }

  addAssetData(asset) {
    this.assetData.push({
      url: asset.url,
      localPath: asset.localPath,
      lastModified: asset.lastModified,
      hash: asset.hash,
      references: Array.from(asset.references), // Copy references
    });
  }

  async generateReport(outputDirectory, fileName) {
    const report = JSON.stringify(this.assetData, null, 2);
    if (outputDirectory) {
      const filePath = join(outputDirectory, fileName);

      // Create directory if missing
      const dirPath = dirname(filePath);
      await Deno.mkdir(dirPath, { recursive: true });

      // Try to write asset to disk
      try {
        await Deno.writeFile(filePath, new TextEncoder().encode(report));
        console.log(`Report saved to: ${filePath}`);
      } catch (error) {
        console.error(`Error saving report: ${error}`);
      }
    }
    Debug.log(report);
  }
}
