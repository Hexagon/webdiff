# Hexagon's webdiff

A Deno-based tool to recursively crawl and analyze web assets, focused on identifying changes or differences (hence the tentative name "webdiff"). This tool can be valuable for web developers tracking
changes to their own sites or those of competitors, content managers monitoring updates, and anyone interested in website archival or analysis.

**Features**

- **Recursive Fetching:** Starting from one or more seed URLs, the tool fetches the web page(s) and parses them to discover links to all other reachable assets (pages, images, stylesheets, scripts)
  within the same domain.
- **Resource Discovery:** Follows internal links within a target website (or websites) to discover and download connected assets of any type.
- **Site summary:** Summarizes the page to a `report.json` containing last-modified, url, a hash of the content and a list of all references (urls) for every discovered asset on the page.
- **Sitemap and robots.txt Parsing:** Can parse `sitemap.xml` and `robots.txt` to assist in the discovery of assets.
- **Report Generation:** Creates analyzed reports for understanding differences between fetched assets.
- **Mime filtering:** Can filter on only interesting mime types to reduce traffic.

## Prerequisites

- Deno ([https://deno.land/](https://deno.land/)) installed on your system.

## Getting Started

1. **Install webdiff:**

   ```bash
   deno install -A -n webdiff --import-map https://raw.githubusercontent.com/hexagon/webdiff/main/import_map.json https://raw.githubusercontent.com/hexagon/webdiff/main/webdiff.ts
   ```

   - `-A` grants all permissions to the program.
   - `-n webdiff` forces the installed command to be named `webdiff`.

   Add `-f` to upgrade a previous install.

2. **Run webdiff:**
   ```bash
   webdiff crawl <target_url>
   webdiff diff [--verbose] <report-1> <report-2>
   webdiff serve <report>
   ```
   - Replace `<target_url>`, `<report-1>` etc. with the actual websites or reports you want to work with.
   - **Options:**
     - `--delay <milliseconds>` Set a delay between fetches (default: 100ms)
     - `--output <directory>` Specify the output directory (default: "./")
     - `--report <filename>` Specify the report filename (default: "report-<timestamp>.json")
     - `--verbose` Enable verbose debugging output
     - `--report-only` Generates the report without storing the assets.
     - `--mime-filter` Does only process assets with the specified mime type(s), comma separated. (example: `--mime-filter "text/html, image/jpeg"`).
     - `--include-urls` Does only process assets matching the specified regex.
     - `--exclude-urls` Ignores assets matching the specified regex.
     - `--user-agent` Use a specific user agent string, one of `chrome`, `firefox`, `webdiff` or `none`. (default: `webdiff`)
     - `--ignore-robots` Ignore directives of `robots.txt` even if found on server.

Webdiff will by default store `report-<timestamp>.json` in the current directory, and a compressed version of each downloaded asset in `assets/<hash>`.

## Example

```bash
webdiff crawl https://56k.guru
```

This will crawl `https://56k.guru`, and download all assets into the specified output directory. A `report.json` will also be created.

**Comparing Fetched Versions**

After running the `webdiff` tool on a website at different points in time, you will have two or more reports to compare.

```bash
webdiff diff report-1.json report-2.json
```

**Understanding the Output**

The diff command will output differences it finds between the two reports, specifically added, removed or changed urls along with the last-updated date (if found).

**Browsing a archived version of a website**

```bash
webdiff serve report-1.json
```

This will serve all downloaded assets from the specified report at `https://localhost:8080`, be aware that any external links or assets will be used from the internet. Any relative assets will be
served from the local webserver.

## Contributions

Contributions are welcome! Feel free to open issues or submit pull requests.

## Disclaimer

This tool is in an early development stage. Use it at your own risk, and always respect the `robots.txt` rules of websites you target.

**Let me know if you want me to expand on any particular section or concept!**
