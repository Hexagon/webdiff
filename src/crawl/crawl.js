import { lookup } from "mrmime/mod.ts";
import { colors } from "cliffy/ansi/mod.ts";

import { Asset } from "./asset.js";
import { delay } from "../utils/delay.js";
import { Debug } from "../cli/debug.js";
import { Summary } from "./summary.js";
import { Robots } from "./robots.js";
import assetQueue from "./queue.js";
import userAgents from "./user_agents.js";

function shouldEnqueue(url, baseUrl, mimeFilter, includeRegex, excludeRegex) {
  // Remove anchor information
  url.hash = ""; // Reset the hash (anchor) part

  // MIME Type Filtering (if the flag is provided)
  if (mimeFilter) {
    const mimeType = lookup(url.pathname);
    if (mimeType && !mimeFilter.includes(mimeType)) {
      Debug.debugFeed("Skipping URL due to MIME type:", url.href);
      return undefined; // Exclude
    }
  }

  // Check if the URL's hostname matches any of the target hostnames
  const isFromTargetSite = baseUrl ? url.hostname === new URL(baseUrl).hostname : false;
  if (!isFromTargetSite) {
    return false;
  }

  // Only check regex filters if they are provided
  if (includeRegex && !includeRegex.test(url.toString())) {
    Debug.logFeed("Skipping URL: Does not match --include-url regex", url.href);
    return undefined; // Exclude
  }

  if (excludeRegex && excludeRegex.test(url.toString())) {
    Debug.debugFeed("Skipping URL: Matches --exclude-url regex", url.href);
    return undefined; // Exclude
  }

  if (isFromTargetSite) {
    return url.toString();
  } else {
    return undefined;
  }
}

async function fetchRobots(targetUrl, userAgentString) {
  const robots = new Robots(targetUrl);
  try {
    await robots.fetch(userAgentString);

    Debug.debugFeed("Found /robots.txt");

    // Modify delay based on crawl-delay
    if (robots.minimumCrawlDelay !== null) {
      delayMs = robots.minimumCrawlDelay * 1000;
      Debug.debugFeed(`Adjusted delayMs to ${delayMs} based on robots.txt`);
    }

    // Add sitemaps
    robots.sitemaps.forEach((sitemapUrl) => {
      Debug.debugFeed(`Found sitemap in robots.txt: ${sitemapUrl}`);
      assetQueue.enqueue(sitemapUrl);
    });
  } catch (error) {
    throw new CrawlError(`Error fetching robots.txt for ${targetUrl}`, targetUrl, error);
  }
}

export const summary = new Summary(); // Create a summary object

export async function crawl(targetUrl, args) {
  console.log(colors.bold("Processing queue\n"));

  // Handle regexes for inclusion or exclusion
  // - Already validated in args.js, no error handling needed
  let includeRegex = null;
  let excludeRegex = null;
  if (args["include-urls"]) {
    includeRegex = new RegExp(args["include-urls"]);
    Debug.debugFeed(`Only processing assets matching regex: ${args["include-urls"]}`);
  }
  if (args["exclude-urls"]) {
    excludeRegex = new RegExp(args["exclude-urls"]);
    Debug.debugFeed("Ignoring assets matching regex: " + args["exclude-urls"]);
  }

  try {
    new URL(targetUrl); // Validate each URL individually
  } catch (_error) {
    console.error(`Error: Invalid target URL: ${targetUrl}`);
    Deno.exit(1);
  }

  // Enqueue the target url
  assetQueue.enqueue(targetUrl);

  // Resolve to the actual user agent string
  // - Already validated by args.js, no need for error handling
  const resolvedUserAgent = userAgents[args["user-agent"]];
  Debug.debugFeed(`User user agent string: ${resolvedUserAgent}`);

  if (!args["ignore-robots"]) {
    try {
      await fetchRobots(targetUrl, resolvedUserAgent);
    } catch (error) {
      Debug.errorFeed(error);
    }
  } else {
    Debug.debugFeed("Ignoring robots.txt");
  }

  const mimeFilter = args["mime-filter"] ? args["mime-filter"].split(",").map((item) => item.trim()) : null;

  // Process Queue
  let assetsProcessed = 0;

  while (assetQueue.queue.length > 0) {
    const url = assetQueue.dequeue();
    const asset = new Asset(url, args.output);

    try {
      await asset.fetch(resolvedUserAgent);
      await asset.parse();
      // Find, filter, and enqueue new links
      asset.references.forEach((link) => {
        if (link) { // Ensure the link has an href attribute
          try {
            const resolvedUrl = new URL(link, targetUrl); // Resolve against the current asset
            if (
              shouldEnqueue(
                resolvedUrl,
                targetUrl,
                mimeFilter,
                includeRegex,
                excludeRegex,
              )
            ) { // Apply your filtering logic
              assetQueue.enqueue(resolvedUrl.href);
            }
          } catch (error) {
            Debug.debugFeed("Error processing link:", link, error);
          }
        }
      });
      if (!args["report-only"]) await asset.save(args.output); // Save the asset
      summary.addAssetData(asset); // Add asset data to the summary
    } catch (error) {
      Debug.errorFeed(error);
    } finally {
      await delay(args.delay);
    }

    Debug.logFeed(`[${assetsProcessed}/${assetsProcessed + assetQueue.queue.length}] ${url}`);

    assetsProcessed++;
  }

  await summary.generateReport(
    args.output,
    args.report,
  );
}
