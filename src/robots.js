import { Debug } from "./debug.js";

export class Robots {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.robotsUrl = new URL("/robots.txt", baseURL).toString();
    this.content = null;
    this.allowedUrls = new Set();
    this.sitemaps = new Set();
    this.minimumCrawlDelay = null;
  }

  async fetch(userAgent) {
    try {
      const response = await fetch(this.robotsUrl, {
        headers: {
          "User-Agent": userAgent, // Pass the userAgent
        },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch robots.txt: ${response.status} ${response.statusText}`,
        );
      }
      this.content = await response.arrayBuffer();
      this.parse();
    } catch (_error) {
      Debug.log("/robots.txt not found on hostname.");
    }
  }

  parse() {
    const textDecoder = new TextDecoder();
    const decodedContent = textDecoder.decode(this.content);

    this.extractAllowedUrls(decodedContent);
    this.extractSitemaps(decodedContent);
    this.extractCrawlDelay(decodedContent);
  }

  extractAllowedUrls(content) {
    const allowRegex = /Allow:\s*(\S+)/g;
    let match;
    while ((match = allowRegex.exec(content)) !== null) {
      this.allowedUrls.add(match[1]);
    }
  }

  extractCrawlDelay(content) {
    const crawlDelayRegex = /Crawl-delay:\s*(\d+)/g;
    let matchCrawlDelay;
    while ((matchCrawlDelay = crawlDelayRegex.exec(content)) !== null) {
      const delaySeconds = parseInt(matchCrawlDelay[1], 10);

      if (isNaN(delaySeconds)) {
        Debug.log("Invalid Crawl-delay format");
        continue;
      }

      if (
        this.minimumCrawlDelay === null || delaySeconds < this.minimumCrawlDelay
      ) {
        this.minimumCrawlDelay = delaySeconds;
      }
    }
  }

  extractSitemaps(content) {
    const sitemapRegex = /Sitemap:\s*(\S+)/g;
    let match;
    while ((match = sitemapRegex.exec(content)) !== null) {
      this.sitemaps.add(match[1]);
    }
  }
}
