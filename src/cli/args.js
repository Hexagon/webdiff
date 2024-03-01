import { parseArgs } from "std/cli/parse_args.ts";
import userAgents from "../crawl/user_agents.js";

export function parseAndValidateArgs() {
  const parsedArgs = parseArgs(Deno.args, {
    boolean: [
      "verbose",
      "report-only",
      "help",
      "ignore-robots",
    ],
    number: [
      "port",
      "delay",
    ],
    string: [
      "output",
      "report",
      "mime-filter",
      "user-agent",
      "include-urls",
      "exclude-urls",
    ],
    alias: {
      d: "delay",
      p: "port",
      o: "output",
      r: "report",
      u: "user-agent",
      i: "ignore-robots",
      h: "help",
    },
    default: {
      delay: 100,
      port: 8080,
      output: "output/",
      "user-agent": "webdiff",
      report: new Date().getTime() + ".json",
    },
  });

  // Validate delayMs
  if (parsedArgs.delay <= 0) {
    console.error("Error: Delay must be a positive number.");
    Deno.exit(1);
  }
  if (parsedArgs.delay >= 3600 * 1000) {
    console.error("Error: Delay must be less than 3 600 000 (1 hour).");
    Deno.exit(1);
  }

  // Validate user agent string
  if (!parsedArgs["user-agent"] || !Object.keys(userAgents).includes(parsedArgs["user-agent"])) {
    console.error(
      `Error: Invalid user-agent. Valid options are: ${Object.keys(userAgents).join(", ")}`,
    );
    Deno.exit(1);
  }

  // Validate regexes for inclusion or exclusion
  if (parsedArgs["include-urls"]) {
    try {
      new RegExp(parsedArgs["include-urls"]);
    } catch (error) {
      console.error("Invalid --include-url regex:" + parsedArgs["include-urls"], error);
      Deno.exit(1);
    }
  }
  if (parsedArgs["exclude-urls"]) {
    try {
      new RegExp(parsedArgs["exclude-urls"]);
    } catch (error) {
      console.error("Invalid --exclude-url regex:" + parsedArgs["include-urls"], error);
      Deno.exit(1);
    }
  }

  return parsedArgs;
}
