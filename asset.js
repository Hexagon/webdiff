import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { dirname, join, extname } from "https://deno.land/std/path/mod.ts";
import { Debug } from "./debug.js";
import { lookup } from "https://deno.land/x/mrmime@v2.0.0/mod.ts";
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts"

export class Asset {
  constructor(url, outputDirectory) {

    /* The original url */
    this.url = url;

    /* The data */
    this.ok = false; // Successful request with status >= 200 and < 300
    this.data = null;
    this.data_mime = null;

    /* Found references to other assets */
    this.references = [];
    
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
        if (response.status === 301 && response.headers.has('Location')) { 
          Debug.log(`Redirected (301) to: ${response.headers.get('Location')}`);
          this.url = response.headers.get('Location'); // Update URL
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
        this.data_mime = response.headers.get('content-type'); 
        
        // Guess mime type if needed
        if (!this.data_mime) {
          // No MIME type provided. Attempt to guess from filename
          this.data_mime = lookup(this.localPath) || 'application/octet-stream'; // Default fallback
          Debug.log(`Guessed MIME type: ${this.data_mime} for asset ${this.url}`);
        }

        break; // Exit the loop 

      } catch (error) {
        this.tries++;
        console.error(`Error fetching ${this.url} (attempt ${this.tries}):`, error);
        break; // Exit loop on error 
      }
    } 

    if (redirectCount >= this.redirectLimit) {
      Debug.log(`Redirect limit reached for ${this.url}`);
    }
  }

  async parse() {
    if (!this.data) return; // Do nothing if there's no data

    if (this.data_mime.startsWith('text/html') || this.data_mime.startsWith('application/xhtml+xml')) {
      const textDecoder = new TextDecoder();
      const textData = textDecoder.decode(this.data);
      const document = new DOMParser().parseFromString(textData, "text/html");
      this.extractHtmlAssets(document);
    } else if (this.data_mime === 'text/plain') {
      if (this.url.endsWith('robots.txt')) {
        this.extractAssetsFromRobots(this.data);
      }
  
    } else if (this.data_mime.endsWith('xml')) { // Assuming sitemaps are XML
       if (this.url.endsWith('sitemap.xml')) {
         this.extractAssetsFromSitemap(this.data);
       }
    } 
  }

  extractHtmlAssets(document) {
    Debug.log("Extracting assets from: " + this.url);

    // Find scripts
    Array.from(document.querySelectorAll("script")).forEach((script) => {
      const src = this.getNamedAsset(script, "src");
      if (src) this.references.push(src); 
    });

    // Find images
    Array.from(document.querySelectorAll("img")).forEach((img) => {
      const src = this.getNamedAsset(img, "src");
      if (src) this.references.push(src);
    });

    // Find links
    Array.from(document.querySelectorAll("a")).forEach((link) => {
      const href = this.getNamedAsset(link, "href");
      if (href) this.references.push(href); 
    });

    Debug.log(
      `\tFound ${this.references.length} referenced urls.`,
    );
  }
  async extractAssetsFromRobots(data) {
    const textDecoder = new TextDecoder();
    const robotsContent = textDecoder.decode(data);
    
    // Simple regular expression parser:
    const allowRegex = /Allow:\s*(\S+)/g; 
    let match = undefined;
    while ((match = allowRegex.exec(robotsContent)) !== null) {
      const allowedUrl = match[1];
      this.references.push(allowedUrl); 
    }

    // Sitemap Extraction
    const sitemapRegex = /Sitemap:\s*(\S+)/g;
    let matchSitemap;
    while ((matchSitemap = sitemapRegex.exec(robotsContent)) !== null) {
      const sitemapUrl = matchSitemap[1]; 
      this.references.push(sitemapUrl); 
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
            this.references.push(urlEntry.loc);
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

  createLocalPath(url, outputDirectory) {
    const urlPath = new URL(url).pathname;
    let relativePath = join(outputDirectory, urlPath); // Use path.join for consistency
    relativePath = relativePath.replace(/^\//, "");
   
    // Only append .html in specific cases
    if (extname(relativePath) === "" || relativePath.endsWith("/")) { 
      relativePath += "index.html";
    } 

    return relativePath;
  }

  async save() {
    if (this.ok) {
      const dirPath = dirname(this.localPath);
      try {
        await Deno.mkdir(dirPath, { recursive: true });
        await Deno.writeFile(this.localPath, new Uint8Array(this.data));
      } catch (error) {
        Debug.log("Error saving page:", error);
      }
    }
  }
}
