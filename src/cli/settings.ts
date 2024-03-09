import { exit } from "@cross/utils";
import { getEnv } from "@cross/env";
import { parseArgs } from "std/cli";
import { userAgents } from "../crawl/user_agents.ts";
import { Debug } from "./debug.ts";

interface SettingConfig {
  argName: string;
  objectName: string;
  envName: string;
  scope: WebdiffScope[];
  defaultValue?: string;
}

type WebdiffScope = "diff" | "crawl" | "resume" | "serve" | "help";

export class Settings {
  private static _instance: Settings; // Private static instance
  private settingsConfig: SettingConfig[] = [
    { argName: "delay", objectName: "delay", envName: "DELAY", scope: ["crawl", "resume"], defaultValue: "100" },
    { argName: "port", objectName: "port", envName: "PORT", scope: ["serve"], defaultValue: "8080" },
    { argName: "output", objectName: "output", envName: "OUTPUT", scope: ["crawl", "resume"], defaultValue: "./" },
    { argName: "report", objectName: "report", envName: "REPORT", scope: ["crawl", "resume"], defaultValue: `report-${new Date().getTime()}.json` },
    { argName: "mime-filter", objectName: "mimeFilter", envName: "MIME_FILTER", scope: ["crawl", "resume"] },
    { argName: "user-agent", objectName: "userAgent", envName: "USER_AGENT", scope: ["crawl", "resume"] },
    { argName: "include-urls", objectName: "includeUrls", envName: "INCLUDE_URLS", scope: ["crawl", "resume"] },
    { argName: "exclude-urls", objectName: "excludeUrls", envName: "EXCLUDE_URLS", scope: ["crawl", "resume"] },
    { argName: "ignore-robots", objectName: "ignoreRobots", envName: "IGNORE_ROBOTS", scope: ["crawl", "resume"] },
    { argName: "verbose", objectName: "verbose", envName: "VERBOSE", scope: ["crawl", "resume", "diff", "serve"] },
    { argName: "help", objectName: "help", envName: "HELP", scope: ["crawl", "resume", "diff", "serve"] },
    { argName: "target-url", objectName: "targetUrl", envName: "TARGET_URL", scope: ["crawl"] },
    { argName: "action", objectName: "action", envName: "ACTION", scope: ["diff", "serve", "crawl", "resume", "help"] },
    { argName: "target", objectName: "target", envName: "TARGET", scope: ["diff", "serve", "resume"] },
    { argName: "target-two", objectName: "targetTwo", envName: "TARGET_TWO", scope: ["diff"] },
  ];

  private settingsData: { [key: string]: any } = {};

  constructor() {
    this.loadSettings();
  }

  public static getInstance(): Settings {
    if (!Settings._instance) {
      Settings._instance = new Settings();
    }
    return Settings._instance;
  }

  private loadSettings() {
    this.byDefault();
    this.byEnv();
    this.byArgs();
  }

  private byDefault() {
    this.settingsConfig.forEach((setting) => {
      this.settingsData[setting.objectName] = setting.defaultValue;
    });
  }

  set(objectName: string, stringValue: string) {
    this.settingsData[objectName] = stringValue;
  }

  getDefault(key: string): any {
    const settingConfig = this.settingsConfig.find((setting) => setting.objectName === key);
    if (settingConfig) {
      return settingConfig.defaultValue;
    } else {
      return undefined; // Or throw an error if you prefer stricter handling
    }
  }

  private byArgs() {
    const parsedArgs = parseArgs(Deno.args, {
      boolean: [
        "verbose",
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
    });

    if (parsedArgs._.length >= 1) this.set("action", parsedArgs._[0].toString().toLowerCase());
    if (parsedArgs._.length >= 2) this.set("file", parsedArgs._[1].toString());
    if (parsedArgs._.length >= 3) this.set("fileTwo", parsedArgs._[2].toString());

    // Transfer the options
    for (const argName in parsedArgs) {

      // Skip special properties of the parsedArgs object and short aliases
      if (['_', '$0'].includes(argName) || argName.length === 1 || parsedArgs[argName] === false) continue;

      // Find the corresponding setting in the settingsConfig
      const settingConfig = this.settingsConfig.find((setting) => setting.argName === argName);

      if (settingConfig) {
          this.settingsData[settingConfig.objectName] = parsedArgs[argName];
      } else {
          // Optionally handle unknown arguments:
          Debug.log(`Unknown command-line argument: ${argName}`);  
          exit(0);
      }
    }
  }

  private byObject(settingsObject: { [key: string]: any }) {
    this.settingsData = {
      ...this.settingsData,
      ...settingsObject,
    };
  }

  private byEnv() {
    this.settingsConfig.forEach((setting) => {
      const envValue = getEnv(setting.envName);
      if (envValue !== undefined) {
        this.settingsData[setting.objectName] = envValue;
      }
    });
  }

  get(key: string): any {
    return this.settingsData[key];
  }

  exportToObject() {
    return { ...this.settingsData };
  }

  validate() {
    // Validate delayMs
    const parsedDelay = parseInt(this.get("delay"), 10);
    if (isNaN(parsedDelay) || parsedDelay <= 0 || parsedDelay >= 3600 * 1000) {
      console.error("Error: Delay must be a positive number less than 3 600 000 (1 hour).");
      exit(1);
    }

    const parsedPort = parseInt(this.get("port"), 10);
    if (isNaN(parsedPort) || parsedPort < 0 || parsedPort >= 65536) {
      console.error("Error: Delay must be a positive number less than 65536.");
      exit(1);
    }

    if (!this.get("userAgent") || !Object.keys(userAgents).includes(this.get("userAgent"))) {
      console.error(
        `Error: Invalid user-agent. Valid options are: ${Object.keys(userAgents).join(", ")}`,
      );
      exit(1);
    }

    // Validate regexes for inclusion or exclusion
    if (this.get("includeUrls")) {
      try {
        new RegExp(this.get("includeUrls"));
      } catch (error) {
        console.error("Invalid --include-url regex:" + this.get("includeUrls"), error);
        exit(1);
      }
    }
    if (this.get("excludeUrls")) {
      try {
        new RegExp(this.get("excludeUrls"));
      } catch (error) {
        console.error("Invalid --exclude-url regex:" + this.get("excludeUrls"), error);
        exit(1);
      }
    }
  }
}
