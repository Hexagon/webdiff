import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { dirname, extname, join } from "https://deno.land/std/path/mod.ts";
import { Debug } from "./debug.js";
import { lookup } from "https://deno.land/x/mrmime@v2.0.0/mod.ts";
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";

export class Asset {
  constructor(url, outputDirectory) {
    /* The original url */
    this.url = url;

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

    /* Generated local path to asset */
    this.localPath = this.createLocalPath(url, outputDirectory);
  }

  async fetch() {
    Debug.log("Fetching: " + this.url);
    let redirectCount = 0;

    while (redirectCount < this.redirectLimit) {
      try {
        const response = await fetch(this.url, { redirect: "manual" });
        if (response.redirected && response.url !== this.url) {
          Debug.log(`Redirected to: ${response.url}`);
          this.url = response.url; // Update the URL
          redirectCount++;
          continue; // Initiate re-fetch
        }
        if (response.status === 301 && response.headers.has("Location")) {
          Debug.log(`Redirected (301) to: ${response.headers.get("Location")}`);
          this.url = response.headers.get("Location"); // Update URL
          redirectCount++;
          continue;
        }

        // If no redirect or redirect limit reached...

        // Check response type
        if (!(response.status >= 200 && response.status < 300)) {
          throw new Error("Status not ok");
        } else {
          this.ok = true;
        }

        this.data = await response.arrayBuffer();
        this.data_mime = response.headers.get("content-type");

        // Guess mime type if needed
        if (!this.data_mime) {
          // No MIME type provided. Attempt to guess from filename
          this.data_mime = lookup(this.localPath) || "application/octet-stream"; // Default fallback
          Debug.log(
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
      } catch (error) {
        this.tries++;
        console.error(
          `Error fetching ${this.url} (attempt ${this.tries}):`,
          error,
        );
        break; // Exit loop on error
      }
    }

    if (redirectCount >= this.redirectLimit) {
      Debug.log(`Redirect limit reached for ${this.url}`);
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

  async parse() {
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
    } else if (this.data_mime === "text/plain") {
      if (this.url.endsWith("robots.txt")) {
        this.extractAssetsFromRobots(this.data);
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
    Debug.log("Extracting assets from: " + this.url);

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

    Debug.log(
      `\tFound ${this.references.size} referenced urls.`,
    );
  }

  async extractHtmlLastModified(document) {
    const lastModifiedMeta = document.querySelector(
      'meta[name="last-modified"]',
    );
    if (lastModifiedMeta) {
      const dateString = lastModifiedMeta.getAttribute("content");
      try {
        this.lastModified = new Date(dateString);
        if (this.lastModified) {
          Debug.log("Successfully extracted lastModified from HTML.");
        }
      } catch (error) {
        // Ignore console.error("Error parsing last-modified meta tag:", error);
      }
    }
  }

  async extractAssetsFromRobots(data) {
    const textDecoder = new TextDecoder();
    const robotsContent = textDecoder.decode(data);

    // Simple regular expression parser:
    const allowRegex = /Allow:\s*(\S+)/g;
    let match = undefined;
    while ((match = allowRegex.exec(robotsContent)) !== null) {
      const allowedUrl = match[1];
      this.addReference(allowedUrl);
    }

    // Sitemap Extraction
    const sitemapRegex = /Sitemap:\s*(\S+)/g;
    let matchSitemap;
    while ((matchSitemap = sitemapRegex.exec(robotsContent)) !== null) {
      const sitemapUrl = matchSitemap[1];
      this.addReference(sitemapUrl);
    }
  }

  async extractAssetsFromSitemap(data) {
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
      Debug.log("Error parsing sitemap:", error);
    }
  }

  getNamedAsset(node, attributeName) {
    const attribute = node.attributes.getNamedItem(attributeName);
    return attribute ? attribute.value : null;
  }

  createLocalPath(url) {
    const urlPath = new URL(url).pathname;
    let relativePath = join("assets", urlPath); // Use path.join for consistency
    relativePath = relativePath.replace(/^\//, "");

    // Only append .html in specific cases
    const defaultIndexName = "index.html";
    if (extname(relativePath) === "" && !relativePath.endsWith("/")) {
      relativePath += "/";
      relativePath += defaultIndexName;
    } else if (relativePath.endsWith("/")) {
      relativePath += defaultIndexName;
    }

    return relativePath;
  }

  async save(outputDirectory) {
    const fullLocalPath = join(outputDirectory, this.localPath);
    if (this.ok) {
      const dirPath = dirname(fullLocalPath);
      try {
        await Deno.mkdir(dirPath, { recursive: true });
        await Deno.writeFile(fullLocalPath, new Uint8Array(this.data));
      } catch (error) {
        Debug.log("Error saving page:", error);
      }
    }
  }
}
