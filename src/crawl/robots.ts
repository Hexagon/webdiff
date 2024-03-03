import { Debug } from "../cli/debug.ts";

interface RobotsData {
  allowedUrls: Set<string>;
  sitemaps: Set<string>;
  minimumCrawlDelay: number | null;
}

export class Robots implements RobotsData {
  baseURL: URL; // Explicitly type baseURL
  robotsUrl: string;
  content: ArrayBuffer | null;
  allowedUrls: Set<string>;
  sitemaps: Set<string>;
  minimumCrawlDelay: number | null;

  constructor(baseURL: string) {
    this.baseURL = new URL(baseURL);
    this.robotsUrl = new URL("/robots.txt", this.baseURL).toString();
    this.content = null;
    this.allowedUrls = new Set();
    this.sitemaps = new Set();
    this.minimumCrawlDelay = null;
  }

  async fetch(userAgent: string | undefined): Promise<void> {
    try {
      const customHeaders = new Headers();
      if (userAgent) {
        customHeaders.append("User-Agent", userAgent);
      }
      const response = await fetch(this.robotsUrl, { headers: customHeaders });
      if (!response.ok) {
        throw new Error(`Failed to fetch robots.txt: ${response.status} ${response.statusText}`);
      }
      this.content = await response.arrayBuffer();
      this.parse();
    } catch (_error) {
      Debug.log("/robots.txt not found on hostname.");
    }
  }

  parse(): void {
    if (!this.content) return; // Handle potential null value of content

    const textDecoder = new TextDecoder();
    const decodedContent = textDecoder.decode(this.content);

    this.extractAllowedUrls(decodedContent);
    this.extractSitemaps(decodedContent);
    this.extractCrawlDelay(decodedContent);
  }

  extractAllowedUrls(content: string) {
    const allowRegex = /Allow:\s*(\S+)/g;
    let match;
    while ((match = allowRegex.exec(content)) !== null) {
      this.allowedUrls.add(match[1]);
    }
  }

  extractCrawlDelay(content: string) {
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

  extractSitemaps(content: string) {
    const sitemapRegex = /Sitemap:\s*(\S+)/g;
    let match;
    while ((match = sitemapRegex.exec(content)) !== null) {
      this.sitemaps.add(match[1]);
    }
  }
}
