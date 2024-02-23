import { assetQueue } from "./queue.js";
import { Asset } from "./asset.js";
import { delay } from "./utils.js";
import { Debug } from "./debug.js";
import { parseArgs } from "https://deno.land/std@0.217.0/cli/parse_args.ts";

const defaultDelayMs = 100;
const defaultOutputDirectory = "./output";

// Parse command line arguments
const args = parseArgs(Deno.args, {
  boolean: ["debug"],
  default: { 
    delay: defaultDelayMs,
  },
  alias: {
    d: "delay", 
  }
});

const delayMs = args.delay ?? defaultDelayMs;
const debug = args.debug ?? false;
const outputDirectory = args.output ?? defaultOutputDirectory;

// Get targets from the remainder (non-option arguments)
const targetUrls = args._; 

if (targetUrls.length === 0) {
  console.error("Error: At least one target URL is required.");
  Deno.exit(1); 
}

// Input Validation
targetUrls.forEach((targetUrl) => { 
  try {
    new URL(targetUrl); // Validate each URL individually
  } catch (error) {
    console.error(`Error: Invalid target URL: ${targetUrl}`);
    Deno.exit(1);
  }
  assetQueue.enqueue(targetUrl);
});

// Input Validation
if (!targetUrls.length) {
  console.error("Error: Target URL is required. Please use --target <url>");
  Deno.exit(1); 
}

if (delayMs <= 0) {
  console.error("Error: Delay must be a positive number.");
  Deno.exit(1);
}

// Enable debugging if requested
if (debug) {
  Debug.enable();
}

Debug.log("Debugging is on!");

async function processQueue() {
  while (assetQueue.queue.length > 0) {
    const url = assetQueue.dequeue();
    const asset = new Asset(url, outputDirectory);

    try {
      await asset.fetch();
      await asset.parse();
      // Find, filter, and enqueue new links
      asset.references.forEach((link) => {
        if (link) { // Ensure the link has an href attribute
          try {
            const resolvedUrl = new URL(link, url); // Resolve against the current asset
            if (shouldEnqueue(resolvedUrl)) { // Apply your filtering logic
              assetQueue.enqueue(resolvedUrl.toString());
            }
          } catch (error) {
            Debug.log("Error processing link:", link, error);
          }
        }
      });
      await asset.save(outputDirectory); // Save the asset
    } catch (error) {
      console.error(error);
    } finally {
      await delay(delayMs);
    }

    Debug.log(
      "Queue Status: Length:",
      assetQueue.queue.length,
      " Next:",
      assetQueue.queue[0],
    );
  }
}

function shouldEnqueue(url) {
  // 2. Remove anchor information
  url.hash = ""; // Reset the hash (anchor) part

  // Check if the URL's hostname matches any of the target hostnames
  const isFromTargetSite = targetUrls.some((targetUrl) => {
    return url.hostname === new URL(targetUrl).hostname;
  });

  if (isFromTargetSite) {
    return url.toString();
  } else {
    return undefined;
  }
}

processQueue();
