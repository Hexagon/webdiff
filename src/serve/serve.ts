import { unzlibSync } from "fflate";
import { colors } from "cliffy/ansi/mod.ts";
import { join } from "std/path";
import { readFile } from "node:fs/promises";

import type { AssetData } from "../crawl/asset.ts";

export async function serve(port: number, outputDir: string, reportFileName: string): Promise<void> {
  try {
    const assetDir = join(outputDir, "assets"); // Path to your assets folder
    const reportPath = join(outputDir, reportFileName);

    // Sample input data (replace with your actual data)
    const assetReportData = await readFile(reportPath);
    const assetReport = JSON.parse(new TextDecoder().decode(assetReportData));

    // Construct a map for faster lookups
    const urlHashMapping = new Map(assetReport.assets.map((obj: AssetData) => [new URL(obj.url as string).pathname, obj.hash]));
    const mimeMapping = new Map(assetReport.assets.map((obj: AssetData) => [new URL(obj.url as string).pathname, obj.data_mime]));

    const handler = async (req: Request): Promise<Response> => {
      const requestedPath = new URL(req.url).pathname; // Remove leading '/'

      // Find the hash
      const fileHash = urlHashMapping.get(requestedPath);
      if (!fileHash) {
        return new Response("Not Found", { status: 404 });
      }
      try {
        // Try to read the asset
        const filePath = `${assetDir}/${fileHash}`;
        const file = unzlibSync(await readFile(filePath));
        const mimeType = mimeMapping.get(requestedPath) as string || "application/octet-stream";
        const status = 200;
        const headers = new Headers();
        headers.append("Content-Type", mimeType);
        return new Response(file, { status, headers });
      } catch (_error) {
        return new Response("Internal Server Error", { status: 500 });
      }
    };

    console.log(colors.bold.blue(`HTTP server running. Access it at: http://localhost:${port}/`));

    Deno.serve({ port }, handler);
  } catch (error) {
    console.error("Error starting server:", error);
    return;
  }
}
