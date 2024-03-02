import { unzlibSync } from "fflate";
import { colors } from "cliffy/ansi/mod.ts";
import { join } from "std/path";

export async function serve(port, outputDir, reportFileName) {
  try {
    const assetDir = join(outputDir, "assets"); // Path to your assets folder
    const reportPath = join(outputDir, reportFileName);

    // Sample input data (replace with your actual data)
    const assetData = JSON.parse(await Deno.readTextFile(reportPath));

    // Construct a map for faster lookups
    const urlHashMapping = new Map(assetData.report.map((obj) => [new URL(obj.url).pathname, obj.hash]));
    const mimeMapping = new Map(assetData.report.map((obj) => [new URL(obj.url).pathname, obj.mime]));

    const handler = async (req) => {
      const requestedPath = new URL(req.url).pathname; // Remove leading '/'

      // Find the hash
      const fileHash = urlHashMapping.get(requestedPath);
      if (!fileHash) {
        return new Response("Not Found", { status: 404 });
      }
      try {
        // Try to read the asset
        const filePath = `${assetDir}/${fileHash}`;
        const file = unzlibSync(await Deno.readFile(filePath));
        const mimeType = mimeMapping.get(requestedPath) || "application/octet-stream";
        return new Response(file, {
          status: 200,
          headers: { "content-type": mimeType },
        });
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
