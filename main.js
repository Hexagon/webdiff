import { exists } from "std/fs/mod.ts";
import { parseArgs } from "std/cli/parse_args.ts";
import { lookup } from "mrmime/mod.ts";

import { Asset } from "./asset.js";
import { delay } from "./utils.js";
import { Debug } from "./debug.js";
import { Summary } from "./summary.js";
import { Robots } from "./robots.js";
import assetQueue from "./queue.js";
import metadata from "./metadata.js";
import userAgents from "./user_agents.js";

const defaultDelayMs = 100;
const defaultOutputDirectory = "output";
const defaultReportFilename = "report.json";
const defaultUserAgentAlias = "webdiff";

// Parse command line arguments
const args = parseArgs(Deno.args, {
  boolean: [
    "verbose",
    "report-only",
    "help",
    "version",
    "ignore-robots",
    "diff",
  ],
  string: [
    "output",
    "report",
    "mime-filter",
    "user-agent",
    "include-urls",
    "exclude-urls",
  ],
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
let includeRegex = null;
let excludeRegex = null;

// Enable debugging if requested
if (debug) {
  Debug.enable();
}

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
  --exclude-urls          Ignore asset urls matching a specific regex
  --include-urls          Only process asset urls matching a specific regex
  --diff <file1> <file2>  Compare to reports to find changes

  --verbose               Enable verbose logging
  --report-only           Generates the report without storing assets
  
  --help                  Displays this help message
`);

  Deno.exit(0); // Exit cleanly after displaying help
}

// Run diff
async function compareJSONFiles(file1Path, file2Path) {
  // Error handling for file existence
  if (!await exists(file1Path) || !await exists(file2Path)) {
    console.error(
      "One or both JSON files not found. Paths:",
      file1Path,
      file2Path,
    );
    return;
  }

  // Load JSON data
  const file1Data = JSON.parse(await Deno.readTextFile(file1Path));
  const file2Data = JSON.parse(await Deno.readTextFile(file2Path));

  // Create dictionaries for faster lookups
  const file1Lookup = {};
  file1Data.forEach((entry) => file1Lookup[entry.url] = entry);

  const file2Lookup = {};
  file2Data.forEach((entry) => file2Lookup[entry.url] = entry);

  // Identify changes
  const changedEntries = [];
  file2Data.forEach((newEntry) => {
    const oldEntry = file1Lookup[newEntry.url];

    if (oldEntry) {
      // Entry exists in both, compare fields
      if (oldEntry.hash !== newEntry.hash) {
        // Add lastModified in the output
        changedEntries.push({
          url: newEntry.url,
          changeType: "modified",
          lastModified: newEntry.lastModified,
        });
      }
    } else {
      // Entry is new
      changedEntries.push({
        url: newEntry.url,
        changeType: "added",
      });
    }
  });

  // Detect deleted entries
  file1Data.forEach((oldEntry) => {
    if (!file2Lookup[oldEntry.url]) {
      changedEntries.push({
        url: oldEntry.url,
        changeType: "removed",
      });
    }
  });

  return changedEntries;
}

if (args.diff) {
  const paths = args._;

  if (paths.length !== 2) {
    console.error("ToDo: Error message");
    Deno.exit(1);
  }

  const [report1Path, report2Path] = paths;

  try {
    const changes = await compareJSONFiles(report1Path, report2Path);
    console.log("Changes:");
    console.log(changes); // Output changes to console
  } catch (error) {
    console.error("Error comparing reports:", error);
    Deno.exit(1);
  }

  Deno.exit(0); //  Exit after performing the comparison
}

// Handle regexes for inclusion or exclusion
if (args["include-urls"]) {
  try {
    includeRegex = new RegExp(args["include-urls"]);
    Debug.log(`Only processing assets matching regex: ${args["include-urls"]}`);
  } catch (error) {
    console.error("Invalid --include-url regex:", error);
    Deno.exit(1);
  }
}

if (args["exclude-urls"]) {
  try {
    excludeRegex = new RegExp(args["exclude-urls"]);
    Debug.log("Ignoring assets matching regex: " + args["exclude-urls"]);
  } catch (error) {
    console.error("Invalid --exclude-url regex:", error);
    Deno.exit(1);
  }
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

  // Only check regex filters if they are provided
  if (includeRegex && !includeRegex.test(url.toString())) {
    Debug.log("Skipping URL: Does not match --include-url regex", url.href);
    return undefined; // Exclude
  }

  if (excludeRegex && excludeRegex.test(url.toString())) {
    Debug.log("Skipping URL: Matches --exclude-url regex", url.href);
    return undefined; // Exclude
  }

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
