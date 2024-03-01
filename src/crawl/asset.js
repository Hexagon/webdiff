import { DOMParser } from "deno_dom/deno-dom-wasm.ts";
import { dirname, join } from "std/path/mod.ts";
import { exists } from "std/fs/mod.ts";
import { lookup } from "mrmime/mod.ts";
import { parse } from "xml/mod.ts";
import { gzip } from "compress/mod.ts";
import { Debug } from "../cli/debug.js";

export class Asset {
  constructor(url) {
    /* The original url */
    this.url = decodeURI(new URL(url).href);

    /* The data */
    this.ok = false; // Successful request with status >= 200 and < 300
    this.data = null;
    this.data_mime = null;
    this.lastModified = null; // Date representation of last modification
    this.hash = null; // Hash of the asset content

    /* Found references to other assets */
    this.references = new Set();

    /* Settings */
    this.maxTries = 3;
    this.redirectLimit = 10;

    /* States */
    this.tries = 0;
  }

  async fetch(userAgent) {
    Debug.debug("Fetching: " + this.url);
    let redirectCount = 0;

    while (redirectCount < this.redirectLimit) {
      try {
        const response = await fetch(encodeURI(this.url), {
          redirect: "manual",
          headers: {
            "User-Agent": userAgent, // Pass the userAgent
          },
        });
        if (response.redirected && response.url !== this.url) {
          Debug.debug(`Redirected to: ${response.url}`);
          this.url = response.url; // Update the URL
          redirectCount++;
          continue; // Initiate re-fetch
        }
        if (response.status === 301 && response.headers.has("Location")) {
          Debug.debug(`Redirected (301) to: ${response.headers.get("Location")}`);
          this.url = response.headers.get("Location"); // Update URL
          redirectCount++;
          continue;
        }

        // If no redirect or redirect limit reached...

        // Check response type
        if (!(response.status >= 200 && response.status < 300)) {
          throw new Error("Status not ok (" + response.status + ")");
        } else {
          this.ok = true;
        }

        this.data = await response.arrayBuffer();
        this.data_mime = response.headers.get("content-type");

        // Guess mime type if needed
        if (!this.data_mime) {
          // No MIME type provided. Attempt to guess from filename
          this.data_mime = lookup(this.localPath) || "application/octet-stream"; // Default fallback
          Debug.debug(
            `Guessed MIME type: ${this.data_mime} for asset ${this.url}`,
          );
        }

        // Extract last modified
        if (response.headers.has("Last-Modified")) {
          this.lastModified = new Date(response.headers.get("Last-Modified"));
        }

        // Calculate hash
        await this.calculateHash(); // Calculate hash here

        break; // Exit the loop
      } catch (_error) {
        this.tries++;
        throw new Error(
          `Error fetching ${this.url} (attempt ${this.tries}):`,
        );
      }
    }

    if (redirectCount >= this.redirectLimit) {
      Debug.debug(`Redirect limit reached for ${this.url}`);
    }
  }

  async calculateHash() {
    // Using SHA-256 as an example, you can change the algorithm if needed
    const algorithm = "SHA-256";

    // Get a Uint8Array view of your Asset data
    const dataView = new Uint8Array(this.data);

    // Hash the data
    const hashBuffer = await crypto.subtle.digest(algorithm, dataView);

    // Convert the ArrayBuffer to a Uint8Array for easier handling
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Format each byte as a 2-digit zero-padded hexadecimal string
    this.hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  parse() {
    if (!this.data) return; // Do nothing if there's no data

    if (
      this.data_mime.startsWith("text/html") ||
      this.data_mime.startsWith("application/xhtml+xml")
    ) {
      const textDecoder = new TextDecoder();
      const textData = textDecoder.decode(this.data);
      const document = new DOMParser().parseFromString(textData, "text/html");
      this.extractHtmlAssets(document);

      // Amend lastModified using HTML values
      if (!this.lastModified) {
        this.extractHtmlLastModified(document);
      }
    } else if (this.data_mime.endsWith("xml")) { // Assuming sitemaps are XML
      if (this.url.endsWith("sitemap.xml")) {
        this.extractAssetsFromSitemap(this.data);
      }
    }
  }

  addReference(refUrl) {
    // Ensure refUrl and this.url exist before proceeding
    if (!refUrl || !this.url) {
      return; // Or you could throw an error here
    }

    // Create a URL object for robust parsing and handling
    const absoluteUrl = new URL(refUrl, this.url);

    // Add the resolved absolute URL to the references
    this.references.add(absoluteUrl.href);
  }

  extractHtmlAssets(document) {
    Debug.debug("Extracting assets from: " + this.url);

    // Find scripts
    Array.from(document.querySelectorAll("script")).forEach((script) => {
      const src = this.getNamedAsset(script, "src");
      if (src) this.addReference(src);
    });

    // Find images
    Array.from(document.querySelectorAll("img")).forEach((img) => {
      const src = this.getNamedAsset(img, "src");
      if (src) this.addReference(src);
    });

    // Find links
    Array.from(document.querySelectorAll("a")).forEach((link) => {
      const href = this.getNamedAsset(link, "href");
      if (href) this.addReference(href);
    });

    Debug.debug(
      `\tFound ${this.references.size} referenced urls.`,
    );
  }

  extractHtmlLastModified(document) {
    const lastModifiedMeta = document.querySelector(
      'meta[name="last-modified"]',
    );
    const articleModifiedMeta = document.querySelector(
      'meta[name="article:modified"]',
    );
    const articlePublishedMeta = document.querySelector(
      'meta[name="article:published"]',
    );
    if (lastModifiedMeta) {
      const dateString = lastModifiedMeta.getAttribute("content");
      try {
        this.lastModified = new Date(dateString);
        if (this.lastModified) {
          Debug.debug("Successfully extracted lastModified from HTML.");
        }
      } catch (_error) {
        // Ignore console.error("Error parsing last-modified meta tag:", error);
      }
    } else if (articleModifiedMeta) {
      const dateString = articleModifiedMeta.getAttribute("content");
      try {
        this.lastModified = new Date(dateString);
        if (this.lastModified) {
          Debug.debug("Successfully extracted article:modified meta from HTML.");
        }
      } catch (_error) {
        // Ignore console.error("Error parsing article:modified meta tag:", error);
      }
    } else if (articlePublishedMeta) {
      const dateString = articlePublishedMeta.getAttribute("content");
      try {
        this.lastModified = new Date(dateString);
        if (this.lastModified) {
          Debug.debug("Successfully extracted article:published meta from HTML.");
        }
      } catch (_error) {
        // Ignore console.error("Error parsing article:published meta tag:", error);
      }
    }
  }

  extractAssetsFromSitemap(data) {
    const textDecoder = new TextDecoder();
    const sitemapText = textDecoder.decode(data);

    try {
      const parsedSitemap = parse(sitemapText);

      if (parsedSitemap.urlset && parsedSitemap.urlset.url) {
        parsedSitemap.urlset.url.forEach((urlEntry) => {
          if (urlEntry.loc) {
            this.addReference(urlEntry.loc);
          }
        });
      }
    } catch (error) {
      Debug.debug("Error parsing sitemap:", error);
    }
  }

  getNamedAsset(node, attributeName) {
    const attribute = node.attributes.getNamedItem(attributeName);
    return attribute ? attribute.value : null;
  }

  async save(assetDirectory) {
    const fullLocalPath = join(assetDirectory, "assets", this.hash);
    if (await exists(fullLocalPath)) {
      // Asset already exists
      return;
    }
    if (this.ok) {
      const dirPath = dirname(fullLocalPath);
      try {
        await Deno.mkdir(dirPath, { recursive: true });
        const data = gzip(new Uint8Array(this.data));
        await Deno.writeFile(fullLocalPath, data);
      } catch (error) {
        Debug.debug("Error saving page:", error);
      }
    }
  }
}