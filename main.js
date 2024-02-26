import { Asset } from "./asset.js";
import { delay } from "./utils.js";
import { Debug } from "./debug.js";
import { Summary } from "./summary.js";
import { Robots } from "./robots.js";
import assetQueue from "./queue.js";
import metadata from "./metadata.js";
import userAgents from "./user_agents.js";

import { exists } from "https://deno.land/std@0.217.0/fs/mod.ts";
import { parseArgs } from "https://deno.land/std@0.217.0/cli/parse_args.ts";
import { lookup } from "https://deno.land/x/mrmime@v2.0.0/mod.ts";

const defaultDelayMs = 100;
const defaultOutputDirectory = "output";
const defaultReportFilename = "report.json";
const defaultUserAgentAlias = "webdiff";

// Parse command line arguments
const args = parseArgs(Deno.args, {
  boolean: ["verbose", "report-only", "help", "version", "ignore-robots"],
  string: ["output", "report", "mime-filter", "user-agent"],
  alias: {
    d: "delay",
    o: "output",
    v: "verbose",
    r: "report",
    h: "help",
    v: "version",
    u: "user-agent",
    i: "ignore-robots",
  },
});

const delayMs = args.delay ?? defaultDelayMs;
const debug = args.verbose ?? false;
const outputDirectory = args.output ?? defaultOutputDirectory;
const reportFilename = args.report ?? defaultReportFilename;
const userAgentAlias = args["user-agent"] ?? defaultUserAgentAlias;

// Output help
if (args.help) { // Check if the 'help' flag is provided
  console.log(`${metadata.name} ${metadata.version}

A cli tool for recursive web asset crawling and analysis.

Usage:
  main.js <target_url> [options]

Options:
  --delay <milliseconds>  Delay between fetches (default: ${defaultDelayMs}ms)
  −−output <directory>    Output directory (default:"${defaultOutputDirectory}")
  --report <filename>     Report filename (default: "${defaultReportFilename}")
  --mime-filter "<mimes>" Comma-separated list of allowed MIME types
  --user-agent <name>     User agent string to use; (none, chrome, ..., default: ${defaultUserAgentAlias})
  --ignore-robots         Ignore all directives of robots.txt

  --verbose               Enable verbose logging
  --report-only           Generates the report without storing assets
  
  --help                  Displays this help message
`);

  Deno.exit(0); // Exit cleanly after displaying help
}

// Get targets from the remainder (non-option arguments)
const targetUrl = args._;

if (targetUrl.length !== 1) {
  console.error("Error: Exactly one target URL is required.");
  Deno.exit(1);
}

// Validate target urls
targetUrl.forEach((targetUrl) => {
  try {
    new URL(targetUrl); // Validate each URL individually
  } catch (error) {
    console.error(`Error: Invalid target URL: ${targetUrl}`);
    Deno.exit(1);
  }
  assetQueue.enqueue(targetUrl);
});

// Validate delayMs
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
  if (error.code !== "ENOENT") {
    // Unexpected error
    console.error("Error checking output directory:", error);
    Deno.exit(1);
  }
}

// User-Agent Validation
if (!userAgentAlias || !Object.keys(userAgents).includes(userAgentAlias)) {
  console.error(
    `Error: Invalid user-agent. Valid options are: ${
      Object.keys(userAgents).join(", ")
    }`,
  );
  Deno.exit(1);
}

// Resolve to the actual user agent string
const resolvedUserAgent = userAgents[userAgentAlias];
Debug.log(`User user agent string: ${resolvedUserAgent}`);

const summary = new Summary(); // Create a summary object

async function processQueue() {
  while (assetQueue.queue.length > 0) {
    const url = assetQueue.dequeue();
    const asset = new Asset(url, outputDirectory);

    try {
      await asset.fetch(resolvedUserAgent);
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
  if (args["mime-filter"]) {
    const mimeFilter = args["mime-filter"].split(",").map((item) =>
      item.trim()
    );
    const mimeType = lookup(url.pathname);
    if (mimeType && !mimeFilter.includes(mimeType)) {
      Debug.log("Skipping URL due to MIME type:", url.href);
      return undefined; // Exclude
    }
  }

  // Check if the URL's hostname matches any of the target hostnames
  const isFromTargetSite = targetUrl.some((targetUrl) => {
    return url.hostname === new URL(targetUrl).hostname;
  });

  if (isFromTargetSite) {
    return url.toString();
  } else {
    return undefined;
  }
}

async function fetchRobots(targetUrl) {
  const robots = new Robots(targetUrl);
  try {
    await robots.fetch(resolvedUserAgent);

    Debug.log("Found /robots.txt");

    // Modify delay based on crawl-delay
    if (robots.minimumCrawlDelay !== null) {
      delayMs = robots.minimumCrawlDelay * 1000;
      Debug.log(`Adjusted delayMs to ${delayMs} based on robots.txt`);
    }

    // Add sitemaps
    robots.sitemaps.forEach((sitemapUrl) => {
      Debug.log(`Found sitemap in robots.txt: ${sitemapUrl}`);
      assetQueue.enqueue(sitemapUrl);
    });
  } catch (error) {
    console.error(`Error fetching robots.txt for ${targetUrl}:`, error);
  }
}

if (!args["ignore-robots"]) {
  await fetchRobots(targetUrl[0]);
} else {
  Debug.log("Ignoring robots.txt");
}

await processQueue();

await summary.generateReport(
  outputDirectory,
  reportFilename,
);
