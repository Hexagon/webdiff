import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { dirname, join, extname } from "https://deno.land/std/path/mod.ts";
import { Debug } from "./debug.js";

export class Page {
  constructor(url, outputDirectory) {
    this.url = url;
    this.sourceCode = null;
    this.scripts = [];
    this.images = [];
    this.links = [];
    this.maxTries = 3;
    this.tries = 0;
    this.localPath = this.createLocalPath(url, outputDirectory);
  }

  async fetchAndParse() {
    Debug.log("Fetching: " + this.url);
    try {
      const response = await fetch(this.url);
      this.sourceCode = await response.text();

      const document = new DOMParser().parseFromString(
        this.sourceCode,
        "text/html",
      );
      this.extractAssets(document);

      this.tries = 0; // Reset tries on success
    } catch (error) {
      this.tries++;
      console.error(
        `Error fetching ${this.url} (attempt ${this.tries}):`,
        error,
      );
    }
  }

  extractAssets(document) {
    Debug.log("Extracting assets from: " + this.url);
    this.scripts = Array.from(document.querySelectorAll("script")).map(
      (script) => this.getNamedAsset(script, "src"),
    );
    this.images = Array.from(document.querySelectorAll("img")).map((img) =>
      this.getNamedAsset(img, "src")
    );
    this.links = Array.from(document.querySelectorAll("a")).map((link) =>
      this.getNamedAsset(link, "href")
    );
    Debug.log(
      `\tFound ${this.links.length} links, ${this.scripts.length} scripts and ${this.images.length} images.`,
    );
  }

  getNamedAsset(node, attributeName) {
    const attribute = node.attributes.getNamedItem(attributeName);
    return attribute ? attribute.value : null; // Return value directly
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
    const dirPath = dirname(this.localPath);
    try {
      await Deno.mkdir(dirPath, { recursive: true });
      await Deno.writeTextFile(this.localPath, this.sourceCode);
    } catch (error) {
      Debug.log("Error saving page:", error);
    }
  }
}
