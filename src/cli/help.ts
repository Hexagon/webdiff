import metadata from "../../deno.json" with { type: "json" };

import { Colors } from "@cross/utils";
import { Settings } from "./settings.ts";
import { renderTable } from "../utils/table.ts";

const settings = Settings.getInstance();

const command = "deno run -A webdiff.js";

export function help() {
  console.log(Colors.bold(`${metadata.name} ${metadata.version}`));
  console.log("A cli tool for recursive web asset crawling and analysis.\n");

  console.log(Colors.bold("Usage\n"));

  console.log(Colors.green(`  ${command} crawl [options] [<target_url>] \n`));
  console.log(Colors.green(`  ${command} resume [options] <report>`));
  console.log(Colors.green(`  ${command} serve <report>`));
  console.log(Colors.green(`  ${command} diff <report1> <report2>`));

  console.log("");

  renderTable([
    [Colors.bold("Option"), Colors.bold("Description"), Colors.bold("Default")],
    ["", "", ""],
    ["  --delay <milliseconds>", "Delay between fetches", `${settings.getDefault("delay")}ms`],
    ["  --directory <directory>", "Report directory", `"./"`],
    ["  --report <filename>", "Report filename", "report-<timestamp>.json"],
    ["  --mime-filter <mimes>", "Comma-separated list of allowed MIME types", ""], // Or a default if applicable
    ["  --user-agent <name>", "User agent string to use", `none, chrome, ..., default: ${settings.getDefault("user-agent")}`],
    ["  --ignore-robots", "Ignore all directives of robots.txt", ""],
    ["  --exclude-urls", "Ignore asset urls matching a specific regex", ""],
    ["  --include-urls", "Only process asset urls matching a specific regex", ""],
    ["  --no-override", "Do not force previous settings while resuming", ""],
    ["  --autosave", "Number of seconds to wait between autosaves, 0 to disable, default: 60", ""],
    ["  --verbose", "Enable verbose logging", ""],
    ["  --help", "Displays this help message", ""],
  ]);

  console.log("");
}
