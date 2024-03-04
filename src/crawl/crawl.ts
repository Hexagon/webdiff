import metadata from "../../deno.json" with { type: "json" };

import { lookup } from "mrmime";
import { colors } from "cliffy/ansi/mod.ts";

import { Asset } from "./asset.ts";
import { delay } from "../utils/delay.ts";
import { Debug } from "../cli/debug.ts";
import { Report } from "./report.ts";
import { Robots } from "./robots.ts";
import assetQueue from "./queue.ts";
import { userAgents } from "./user_agents.ts";

// Interfaces (explained later)
import type { CliArguments } from "../cli/args.ts";

function shouldEnqueue(url: URL, baseUrl: string, mimeFilter: string[], includeRegex: RegExp | null, excludeRegex: RegExp | null) {
  // Remove anchor information
  url.hash = ""; // Reset the hash (anchor) part

  // MIME Type Filtering (if the flag is provided)
  if (mimeFilter.length) {
    const mimeType = lookup(url.pathname);
    if (mimeType && !mimeFilter.includes(mimeType)) {
      Debug.debugFeed(`Skipping URL due to MIME type: ${url.href}`);
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
    Debug.logFeed(`Skipping URL: Does not match --include-url regex: ${url.href}`);
    return undefined; // Exclude
  }

  if (excludeRegex && excludeRegex.test(url.toString())) {
    Debug.debugFeed(`Skipping URL: Matches --exclude-url regex: ${url.href}`);
    return undefined; // Exclude
  }

  if (isFromTargetSite) {
    return url.toString();
  } else {
    return undefined;
  }
}

async function fetchRobots(targetUrl: string, userAgentString: string | undefined) {
  const robots = new Robots(targetUrl);
  try {
    await robots.fetch(userAgentString);

    Debug.debugFeed("Found /robots.txt");

    // Modify delay based on crawl-delay
    if (robots.minimumCrawlDelay !== null) {
      Debug.debugFeed(`Adjusted delayMs to ${robots.minimumCrawlDelay * 1000} based on robots.txt`);
    }

    // Add sitemaps
    robots.sitemaps.forEach((sitemapUrl) => {
      Debug.debugFeed(`Found sitemap in robots.txt: ${sitemapUrl}`);
      assetQueue.enqueue(sitemapUrl);
    });
  } catch (error) {
    throw new Error(`Error fetching robots.txt for ${targetUrl}: ${error.message}`);
  }
}

export const report = new Report(metadata.version); // Create a report object

export async function crawl(targetUrl: string, args: CliArguments) {
  console.log(colors.bold("Processing queue\n"));

  // Handle regexes for inclusion or exclusion
  // - Already validated in args.js, no error handling needed
  let includeRegex: RegExp | null = null;
  let excludeRegex: RegExp | null = null;
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
  const resolvedUserAgent = userAgents[args["user-agent"]] as string | undefined;

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

  const mimeFilter: string[] = args["mime-filter"] ? args["mime-filter"].split(",").map((item) => item.trim()) : [];

  // Process Queue
  let assetsProcessed = 0;

  while (assetQueue.queue.length > 0) {
    const url = assetQueue.dequeue();
    const asset = new Asset(url);

    try {
      await asset.fetch(resolvedUserAgent);
      await asset.parse();
      // Find, filter, and enqueue new links
      asset.references.forEach((link) => {
        if (link) { // Ensure the link has an href attribute
          try {
            const resolvedUrl = new URL(link as string, targetUrl); // Resolve against the current asset
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
            Debug.debugFeed(`Error processing link ${link}:  ${error}`);
          }
        }
      });

      // Conditionally save the asset to disk
      if (!args["report-only"]) {
        await asset.save(args.output);
      }

      // Add to report
      report.addAsset(asset);
    } catch (error) {
      Debug.errorFeed(error);
    } finally {
      const delayMs = parseInt(args.delay, 10);
      await delay(delayMs);
    }

    Debug.logFeed(`[${assetsProcessed}/${assetsProcessed + assetQueue.queue.length}] ${url}`);

    assetsProcessed++;
  }

  await report.generate(
    args.output,
    args.report,
  );
}
