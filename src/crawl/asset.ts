import { DOMParser } from "linkedom";
import { dirname, join } from "@std/path";
import { lookup } from "mrmime";
import { XMLParser } from "fast-xml-parser";
import { zlibSync } from "fflate";
import { Debug } from "../cli/debug.ts";
import { exists, mkdir, writeFile } from "@cross/fs";

export interface AssetData {
  url: string | undefined;
  data_mime: string | null;
  charset: string | null;
  references: Set<string>;
  last_modified: string | null;
  hash: string | null;
}

interface HTMLDocument { // Inherits from the basic Document type
  querySelectorAll(selectors: string): HTMLNode[];
  querySelector(selectors: string): HTMLNode | null;
  // ... other properties and methods
}

interface HTMLNode {
  getAttribute(arg0: string): string | undefined;
  attributes: {
    getNamedItem(attrName: string): HTMLNodeAttr | null;
  };
}

interface HTMLNodeAttr {
  value: string;
}

interface Sitemap {
  urlset: UrlSet;
}

interface UrlSet {
  url: UrlEntry[];
}

interface UrlEntry {
  loc: string;
}

interface ContentType {
  mediaType: string;
  charset?: string; // Optional charset property
}

function extractContentType(contentTypeHeader: string): ContentType {
  const contentTypeParts = contentTypeHeader.split(";");
  const mediaType = contentTypeParts[0].trim();

  let charset: string | undefined; // Initialize charset as optional
  const charsetMatch = contentTypeParts.slice(1).find((part) => {
    const trimmedPart = part.trim();
    return trimmedPart.toLowerCase().startsWith("charset=");
  });

  if (charsetMatch) {
    charset = charsetMatch.split("=")[1].trim();
  }

  return {
    mediaType,
    charset,
  };
}

export class Asset implements AssetData {
  /* Own */
  ok: boolean;
  maxTries: number;
  redirectLimit: number;
  tries: number;
  data: ArrayBuffer | null;

  /* From AssetData */
  url: string | undefined;
  data_mime: string | null;
  charset: string | null;
  last_modified: string | null;
  hash: string | null;
  references: Set<string>;

  constructor(url: string | undefined) {
    /* The original url */
    if (url !== undefined) {
      this.url = decodeURI(new URL(url).href);
    } else {
      this.url = undefined;
    }

    /* The data */
    this.ok = false; // Successful request with status >= 200 and < 300
    this.data = null;
    this.data_mime = null;
    this.charset = null;
    this.last_modified = null; // Date representation of last modification
    this.hash = null; // Hash of the asset content

    /* Found references to other assets */
    this.references = new Set();

    /* Settings */
    this.maxTries = 3;
    this.redirectLimit = 10;

    /* States */
    this.tries = 0;
  }

  async fetch(userAgentString: string | undefined) {
    Debug.debug("Fetching: " + this.url);
    let redirectCount = 0;
    while (redirectCount < this.redirectLimit) {
      if (this.url !== undefined) {
        try {
          const customHeaders = new Headers();
          if (userAgentString) {
            customHeaders.append("User-Agent", userAgentString);
          }
          const response = await fetch(encodeURI(this.url), {
            redirect: "manual",
            headers: customHeaders,
          });
          if (response.redirected && response.url !== this.url) {
            Debug.debug(`Redirected to: ${response.url}`);
            this.url = response.url; // Update the URL
            redirectCount++;
            continue; // Initiate re-fetch
          }
          if (response.status === 301 && response.headers.has("Location")) {
            const url = response.headers.get("Location");
            if (url) {
              Debug.debug(`Redirected (301) to: ${url}`);
              this.url = url; // Update URL
              redirectCount++;
              continue;
            }
          }

          // If no redirect or redirect limit reached...

          // Check response type
          if (!(response.status >= 200 && response.status < 300)) {
            throw new Error("Status not ok (" + response.status + ")");
          } else {
            this.ok = true;
          }

          this.data = await response.arrayBuffer();

          const contentTypeHeader = response.headers.get("content-type");
          if (contentTypeHeader) { // Ensure header exists
            const { mediaType, charset } = extractContentType(contentTypeHeader);
            this.data_mime = mediaType;
            // Use the charset if it was found:
            if (charset) {
              this.charset = charset;
            }
          }

          // Guess mime type if needed
          if (!this.data_mime) {
            // No MIME type provided. Attempt to guess from filename
            const urlPathName = new URL(this.url).pathname;
            this.data_mime = lookup(urlPathName) || "application/octet-stream"; // Default fallback
            Debug.debug(
              `Guessed MIME type: ${this.data_mime} for asset ${this.url}`,
            );
          }

          // Extract last modified
          const lastModifiedHeader = response.headers.get("Last-Modified");
          if (lastModifiedHeader) {
            this.last_modified = new Date(lastModifiedHeader).toISOString();
          }

          // Calculate hash
          this.hash = await this.calculateHash();

          break; // Exit the loop
        } catch (_error) {
          this.tries++;
          throw new Error(
            `Error fetching ${this.url} (attempt ${this.tries}):`,
          );
        }
      } else {
        Debug.debug("Refusing to fetch a missing URL.");
      }
    }

    if (redirectCount >= this.redirectLimit) {
      Debug.debug(`Redirect limit reached for ${this.url}`);
    }
  }

  async calculateHash(): Promise<string | null> {
    if (this.data) {
      // Using SHA-256 as an example, you can change the algorithm if needed
      const algorithm = "SHA-256";

      // Get a Uint8Array view of your Asset data
      const dataView = new Uint8Array(this.data);

      // Hash the data
      const hashBuffer = await crypto.subtle.digest(algorithm, dataView);

      // Convert the ArrayBuffer to a Uint8Array for easier handling
      const hashArray = Array.from(new Uint8Array(hashBuffer));

      // Format each byte as a 2-digit zero-padded hexadecimal string
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } else {
      return null;
    }
  }

  parse() {
    if (!this.data) return; // Do nothing if there's no data
    if (!this.data_mime) return; // Do nothing if there's no mime type
    if (
      this.data_mime.startsWith("text/html") ||
      this.data_mime.startsWith("application/xhtml+xml")
    ) {
      const textDecoder = new TextDecoder();
      const textData = textDecoder.decode(this.data);
      const document = new DOMParser().parseFromString(textData, "text/html");
      this.extractHtmlAssets(document);

      // Amend last_modified using HTML values
      if (!this.last_modified) {
        this.extractHtmllast_modified(document);
      }
    } else if (this.data_mime.endsWith("xml")) { // Assuming sitemaps are XML
      if (this.url !== undefined && this.url.endsWith("sitemap.xml")) {
        this.extractAssetsFromSitemap(this.data);
      }
    }
  }

  addReference(refUrl: string) {
    // Ensure refUrl and this.url exist before proceeding
    if (!refUrl || !this.url) {
      return; // Or you could throw an error here
    }

    // Create a URL object for robust parsing and handling
    const absoluteUrl = new URL(refUrl, this.url);

    // Add the resolved absolute URL to the references
    this.references.add(absoluteUrl.href);
  }

  extractHtmlAssets(document: HTMLDocument) {
    Debug.debug("Extracting assets from: " + this.url);

    // Find scripts
    Array.from(document.querySelectorAll("script")).forEach((script) => {
      const src = this.getNamedAsset(script as HTMLNode, "src");
      if (src) this.addReference(src);
    });

    // Find images
    Array.from(document.querySelectorAll("img")).forEach((img) => {
      const src = this.getNamedAsset(img as HTMLNode, "src");
      if (src) this.addReference(src);
    });

    // Find links
    Array.from(document.querySelectorAll("a")).forEach((link) => {
      const href = this.getNamedAsset(link as HTMLNode, "href");
      if (href) this.addReference(href);
    });

    Debug.debug(
      `\tFound ${this.references.size} referenced urls.`,
    );
  }

  extractHtmllast_modified(document: HTMLDocument) {
    const lastModifiedMeta = document.querySelector(
      'meta[name="last-modified"]',
    );
    const articleModifiedMeta = document.querySelector(
      'meta[property="article:modified_time"]',
    );
    const articlePublishedMeta = document.querySelector(
      'meta[property="article:published_time"]',
    );
    if (lastModifiedMeta) {
      const dateString = lastModifiedMeta.getAttribute("content");
      if (dateString) {
        try {
          this.last_modified = new Date(dateString).toISOString();
          if (this.last_modified) {
            Debug.debug("Successfully extracted last_modified from HTML.");
          }
        } catch (_error) {
          // Ignore console.error("Error parsing last_modified meta tag:", error);
        }
      }
    } else if (articleModifiedMeta) {
      const dateString = articleModifiedMeta.getAttribute("content");
      if (dateString) {
        try {
          this.last_modified = new Date(dateString).toISOString();
          if (this.last_modified) {
            Debug.debug("Successfully extracted article:modified_time meta from HTML.");
          }
        } catch (_error) {
          // Ignore console.error("Error parsing article:modified meta tag:", error);
        }
      }
    } else if (articlePublishedMeta) {
      const dateString = articlePublishedMeta.getAttribute("content");
      if (dateString) {
        try {
          this.last_modified = new Date(dateString).toISOString();
          if (this.last_modified) {
            Debug.debug("Successfully extracted article:published meta from HTML.");
          }
        } catch (_error) {
          // Ignore console.error("Error parsing article:published meta tag:", error);
        }
      }
    }
  }

  extractAssetsFromSitemap(data: ArrayBuffer) {
    const textDecoder = new TextDecoder();
    const sitemapText = textDecoder.decode(data);
    try {
      const parser = new XMLParser();
      const parsedSitemap: Sitemap = parser.parse(sitemapText) as unknown as Sitemap;
      const urlSet: UrlSet = parsedSitemap.urlset;
      if (urlSet && urlSet.url) { // Narrow down the type
        urlSet.url.forEach((urlEntry) => {
          this.addReference(urlEntry.loc); // 'loc' is guaranteed by the interface
        });
      }
    } catch (error) {
      Debug.debug(`Error parsing sitemap: ${error.message}`);
    }
  }

  getNamedAsset(node: HTMLNode, attributeName: string): string | null {
    const attribute = node.attributes.getNamedItem(attributeName);
    return attribute ? attribute.value : null;
  }

  async save(assetDirectory: string) {
    if (!this.hash) {
      throw new Error("Error saving page: No hash for file");
    }
    if (!this.data) {
      throw new Error("Error saving page: No data");
    }
    const fullLocalPath = join(assetDirectory, "assets", this.hash);
    try {
      if (await exists(fullLocalPath)) {
        // Asset already exists
        return;
      }
    } catch (_e) {
      // Ignore
    }
    if (this.ok) {
      const dirPath = dirname(fullLocalPath);
      await mkdir(dirPath, { recursive: true });
      const data = zlibSync(new Uint8Array(this.data));
      await writeFile(fullLocalPath, data);
    }
  }
}
