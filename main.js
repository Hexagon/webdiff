import { assetQueue } from "./queue.js";
import { Asset } from "./asset.js";
import { delay } from "./utils.js";
import { Debug } from "./debug.js";
import { parseArgs } from "https://deno.land/std@0.217.0/cli/parse_args.ts";
import { Summary } from "./summary.js";
import { exists } from 'https://deno.land/std@0.217.0/fs/mod.ts';
import { lookup } from "https://deno.land/x/mrmime@v2.0.0/mod.ts";

const defaultDelayMs = 100;
const defaultOutputDirectory = "output";
const defaultReportFilename = "report.json";

// Parse command line arguments
const args = parseArgs(Deno.args, {
  boolean: ["verbose","report-only"],
  string: ["output", "report","mime-filter"],
  alias: {
    d: "delay",
    o: "output",
    v: "verbose",
    r: "report",
  },
});

const delayMs = args.delay ?? defaultDelayMs;
const debug = args.verbose ?? false;
const outputDirectory = args.output ?? defaultOutputDirectory;
const reportFilename = args.report ?? defaultReportFilename;

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

// Check if the output directory exists
try {
  const result = await exists(outputDirectory);
  if (result) {
    console.error(`Output directory '${outputDirectory}' already exists.`);
    Deno.exit(1);
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    // Unexpected error
    console.error('Error checking output directory:', error);
    Deno.exit(1);
  }
}

Debug.log("Debugging is on!");

const summary = new Summary(); // Create a summary object

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
      if (!args["report-only"]) await asset.save(outputDirectory); // Save the asset
      summary.addAssetData(asset); // Add asset data to the summary
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

  // Remove anchor information
  url.hash = ""; // Reset the hash (anchor) part

  // MIME Type Filtering (if the flag is provided)
  if (args['mime-filter']) { 
    const mimeFilter = args['mime-filter'].split(',').map(item => item.trim());
    const mimeType = lookup(url.pathname); 
    if (mimeType && !mimeFilter.includes(mimeType)) {
        Debug.log("Skipping URL due to MIME type:", url.href);
        return undefined; // Exclude
    }
  }

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

await processQueue();

await summary.generateReport(
  outputDirectory,
  reportFilename,
);
