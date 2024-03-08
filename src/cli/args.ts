import { exit } from "@cross/utils";

import { Args, parseArgs } from "std/cli";
import { userAgents } from "../crawl/user_agents.ts";

export interface CliArguments extends Args {
  "port": string;
  "delay": string;
  "output": string;
  "report": string;
  "mime-filter": string;
  "user-agent": string;
  "include-urls": string;
  "exclude-urls": string;
  "report-only": boolean;
  "ignore-robots": boolean;
  "verbose": boolean;
  "help": boolean;
  _: string[];
}

export function parseAndValidateArgs() {
  const parsedArgs: CliArguments = parseArgs(Deno.args, {
    boolean: [
      "verbose",
      "report-only",
      "help",
      "ignore-robots",
    ],
    string: [
      "port",
      "delay",
      "output",
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
      output: "./",
      "user-agent": "webdiff",
      report: `report-${new Date().getTime()}.json`,
    },
  });

  // Validate delayMs
  const parsedDelay = parseInt(parsedArgs.delay, 10);
  if (isNaN(parsedDelay) || parsedDelay <= 0 || parsedDelay >= 3600 * 1000) {
    console.error("Error: Delay must be a positive number less than 3 600 000 (1 hour).");
    exit(1);
  }

  const parsedPort = parseInt(parsedArgs.port, 10);
  if (isNaN(parsedPort) || parsedPort < 0 || parsedPort >= 65536) {
    console.error("Error: Delay must be a positive number less than 65536.");
    exit(1);
  }

  // Validate user agent string
  if (!parsedArgs["user-agent"] || !Object.keys(userAgents).includes(parsedArgs["user-agent"])) {
    console.error(
      `Error: Invalid user-agent. Valid options are: ${Object.keys(userAgents).join(", ")}`,
    );
    exit(1);
  }

  // Validate regexes for inclusion or exclusion
  if (parsedArgs["include-urls"]) {
    try {
      new RegExp(parsedArgs["include-urls"]);
    } catch (error) {
      console.error("Invalid --include-url regex:" + parsedArgs["include-urls"], error);
      exit(1);
    }
  }
  if (parsedArgs["exclude-urls"]) {
    try {
      new RegExp(parsedArgs["exclude-urls"]);
    } catch (error) {
      console.error("Invalid --exclude-url regex:" + parsedArgs["include-urls"], error);
      exit(1);
    }
  }

  return parsedArgs;
}
