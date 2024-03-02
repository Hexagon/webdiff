import { dirname, join } from "std/path";

export class Summary {
  constructor() {
    this.assetData = []; // Array to store asset summaries
  }

  addAssetData(asset) {
    this.assetData.push({
      url: asset.url,
      lastModified: asset.lastModified,
      mime: asset.data_mime,
      hash: asset.hash,
      references: Array.from(asset.references), // Copy references
    });
  }

  async generateReport(outputDirectory, fileName) {
    const report = JSON.stringify({ report: this.assetData }, null, 2);
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
  }
}
