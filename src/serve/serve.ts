import { unzlibSync } from "fflate";
import { Debug } from "../cli/debug.ts";
import { join } from "@std/path";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { exit } from "@cross/utils";

import type { AssetData } from "../crawl/asset.ts"; // Keep the type

export async function serve(port: number, outputDir: string, reportFileName: string): Promise<void> {
  try {
    const assetDir = join(outputDir, "assets");
    const reportPath = join(outputDir, reportFileName);

    const assetReportData = await readFile(reportPath);
    const assetReport = JSON.parse(new TextDecoder().decode(assetReportData));

    const urlHashMapping = new Map(assetReport.assets.map((obj: AssetData) => [new URL(obj.url as string).pathname, obj.hash]));
    const mimeMapping = new Map(assetReport.assets.map((obj: AssetData) => [new URL(obj.url as string).pathname, obj.data_mime]));

    // Create the Node.js HTTP server
    const server = http.createServer(async (req, res) => {
      if (!req.url) return;
      const requestedPath = new URL(req.url, `http://localhost:${port}`).pathname;

      const fileHash = urlHashMapping.get(requestedPath);
      if (!fileHash) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }

      try {
        const filePath = `${assetDir}/${fileHash}`;
        const file = unzlibSync(await readFile(filePath));
        const mimeType = mimeMapping.get(requestedPath) as string || "application/octet-stream";

        res.writeHead(200, { "Content-Type": mimeType });
        res.end(file);
      } catch (error) {
        console.error("Error reading asset:", error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });

    server.listen(port, () => {
      console.log(Debug.log(`HTTP server running. Access it at: http://localhost:${port}/`));
    });
  } catch (error) {
    Debug.log("Error starting server:");
    Debug.error(error);
    exit(1);
  }
}
