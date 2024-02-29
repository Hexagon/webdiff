import { serve } from "std/http/server.ts";
import { lookup } from "https://deno.land/x/media_types@v3.0.3/mod.ts";
import { gunzip } from "compress/mod.ts";

const assetDir = "./output/assets"; // Path to your assets folder

// Sample input data (replace with your actual data)
const assetData = JSON.parse(await Deno.readTextFile("./output/1709168158226.json"));

// Construct a map for faster lookups
const urlHashMapping = new Map(assetData.report.map((obj) => [new URL(obj.url).pathname, obj.hash]));
const mimeMapping = new Map(assetData.report.map((obj) => [new URL(obj.url).pathname, obj.mime]));

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
    const file = gunzip(await Deno.readFile(filePath));
    const mimeType = mimeMapping.get(requestedPath) || "application/octet-stream";
    return new Response(file, {
      status: 200,
      headers: { "content-type": mimeType },
    });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
};

const port = 8080;

console.log(`HTTP server running. Access it at: http://localhost:8080/`);
Deno.serve({ port: 8080 }, handler);
