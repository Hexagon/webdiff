import metadata from "../../metadata.js";

import { colors } from "cliffy/ansi/mod.ts";
import { Table } from "cliffy/table/mod.ts";

const command = "deno run -A webdiff.js";

export function help(args) {
  console.log(colors.bold(`${metadata.name} ${metadata.version}`));
  console.log("A cli tool for recursive web asset crawling and analysis.\n");

  console.log(colors.bold("Usage\n"));

  console.log(colors.green(`  ${command} serve <filename>`));
  console.log(colors.green(`  ${command} diff <file1> <file2>`));
  console.log(colors.green(`  ${command} crawl [<target_url>] [options]\n`));

  const table = new Table()
    .header([colors.bold("Option"), colors.bold("Description"), colors.bold("Default")]);

  table.push(
    ["  --delay <milliseconds>", "Delay between fetches", `${args.delay}ms`],
    ["  −−output <directory>", "Output directory", `"./output"`],
    ["  --report <filename>", "Report filename", "<timestamp>.json"],
    ["  --mime-filter <mimes>", "Comma-separated list of allowed MIME types", ""], // Or a default if applicable
    ["  --user-agent <name>", "User agent string to use", `none, chrome, ..., default: ${args["user-agent"]}`],
    ["  --ignore-robots", "Ignore all directives of robots.txt", ""],
    ["  --exclude-urls", "Ignore asset urls matching a specific regex", ""],
    ["  --include-urls", "Only process asset urls matching a specific regex", ""],
    ["  --verbose", "Enable verbose logging", ""],
    ["  --report-only", "Generates the report without storing assets", ""],
    ["  --help", "Displays this help message", ""],
  );

  console.log(table.toString());
}
