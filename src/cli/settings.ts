import { args, ArgsParser, exit } from "@cross/utils";
import { getEnv } from "@cross/env";
import { userAgents } from "../crawl/user_agents.ts";
import { Debug } from "./debug.ts";

interface SettingConfig {
  argName: string;
  objectName: string;
  envName: string;
  scope: WebdiffScope[];
  defaultValue?: string;
}

export type SettingsData = { [key: string]: string | undefined };

type WebdiffScope = "diff" | "crawl" | "resume" | "serve" | "help";

export class Settings {
  private static _instance: Settings; // Private static instance
  private settingsConfig: SettingConfig[] = [
    { argName: "delay", objectName: "delay", envName: "DELAY", scope: ["crawl", "resume"], defaultValue: "500" },
    { argName: "port", objectName: "port", envName: "PORT", scope: ["serve"], defaultValue: "8080" },
    { argName: "output", objectName: "output", envName: "OUTPUT", scope: ["crawl", "resume"], defaultValue: "./" },
    { argName: "report", objectName: "report", envName: "REPORT", scope: ["crawl", "resume"], defaultValue: `report-${new Date().getTime()}.json` },
    { argName: "report-only", objectName: "reportOnly", envName: "REPORT_ONLY", scope: ["crawl", "resume"] },
    { argName: "mime-filter", objectName: "mimeFilter", envName: "MIME_FILTER", scope: ["crawl", "resume"] },
    { argName: "user-agent", objectName: "userAgent", envName: "USER_AGENT", scope: ["crawl", "resume"], defaultValue: "webdiff" },
    { argName: "include-urls", objectName: "includeUrls", envName: "INCLUDE_URLS", scope: ["crawl", "resume"] },
    { argName: "exclude-urls", objectName: "excludeUrls", envName: "EXCLUDE_URLS", scope: ["crawl", "resume"] },
    { argName: "override", objectName: "override", envName: "OVERRIDE", scope: ["resume"] },
    { argName: "autosave", objectName: "autosave", envName: "AUTOSAVE", scope: ["crawl", "resume"], defaultValue: "60" },
    { argName: "ignore-robots", objectName: "ignoreRobots", envName: "IGNORE_ROBOTS", scope: ["crawl", "resume"] },
    { argName: "verbose", objectName: "verbose", envName: "VERBOSE", scope: ["crawl", "resume", "diff", "serve"] },
    { argName: "help", objectName: "help", envName: "HELP", scope: ["crawl", "resume", "diff", "serve"] },
    { argName: "action", objectName: "action", envName: "ACTION", scope: ["diff", "serve", "crawl", "resume", "help"] },
    { argName: "target", objectName: "target", envName: "TARGET", scope: ["crawl", "diff", "serve", "resume"] },
    { argName: "target-two", objectName: "targetTwo", envName: "TARGET_TWO", scope: ["diff"] },
  ];

  private settingsData: SettingsData = {};

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
    this.validate();
  }

  private byDefault() {
    this.settingsConfig.forEach((setting) => {
      this.settingsData[setting.objectName] = setting.defaultValue;
    });
  }

  set(objectName: string, stringValue: string) {
    this.settingsData[objectName] = stringValue;
  }

  getDefault(key: string): unknown {
    const settingConfig = this.settingsConfig.find((setting) => setting.objectName === key);
    if (settingConfig) {
      return settingConfig.defaultValue;
    } else {
      return undefined; // Or throw an error if you prefer stricter handling
    }
  }

  private byArgs() {
    const parsedArgs = new ArgsParser(args());

    if (parsedArgs.countLoose() >= 1) this.set("action", parsedArgs.getLoose()[0].toLowerCase());
    if (parsedArgs.countLoose() >= 2) this.set("target", parsedArgs.getLoose()[1]);
    if (parsedArgs.countLoose() >= 3) this.set("targetTwo", parsedArgs.getLoose()[2]);

    // Transfer the options
    for (const settingConfig of this.settingsConfig) {
      if (parsedArgs.count(settingConfig.argName) > 1) {
        Debug.log(`Argument '${settingConfig.argName} specified multiple times. Exiting.`);
      } else if (parsedArgs.count(settingConfig.argName) === 1) {
        // Find the corresponding setting in the settingsConfig
        if (typeof parsedArgs.get(settingConfig.argName) === "boolean") {
          this.settingsData[settingConfig.objectName] = "true";
        } else {
          this.settingsData[settingConfig.objectName] = parsedArgs.get(settingConfig.argName) as string | undefined;
        }
      }
    }
  }

  byObject(settingsObject: SettingsData) {
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

  get(key: string): string | undefined {
    let setting = this.settingsData[key];
    if (setting == "") setting = undefined;
    return setting;
  }

  exportToObject(): SettingsData {
    return { ...this.settingsData };
  }

  validate() {
    // Validate delayMs
    const delayValue = this.get("delay");
    if (delayValue !== undefined) {
      const parsedDelay = parseInt(delayValue, 10);
      if (isNaN(parsedDelay) || parsedDelay <= 0 || parsedDelay >= 3600 * 1000) {
        console.error("Error: Delay must be a positive number less than 3 600 000 (1 hour).");
        exit(1);
      }
    }

    // Validate port
    const portValue = this.get("port");
    if (portValue !== undefined) {
      const parsedPort = parseInt(portValue, 10);
      if (isNaN(parsedPort) || parsedPort < 0 || parsedPort >= 65536) {
        console.error("Error: Delay must be a positive number less than 65536.");
        exit(1);
      }
    }

    // Validate autosave
    const autosaveValue = this.get("autosave");
    if (autosaveValue) {
      const parsedAutosave = parseInt(autosaveValue, 10);
      if (isNaN(parsedAutosave) || parsedAutosave < 0 || parsedAutosave >= 3600) {
        console.error("Error: Autosave argument must be a positive number less than 3600, or 0 (disabled).");
        exit(1);
      }
    }

    // Validate user agent
    const userAgent = this.get("userAgent");
    if (!userAgent || (userAgent !== undefined && !Object.keys(userAgents).includes(userAgent))) {
      console.error(
        `Error: Invalid user-agent. Valid options are: ${Object.keys(userAgents).join(", ")}`,
      );
      exit(1);
    }

    // Validate regexes for inclusion or exclusion
    const includeUrls = this.get("includeUrls");
    if (includeUrls !== undefined) {
      try {
        new RegExp(includeUrls);
      } catch (error) {
        console.error("Invalid --include-url regex:" + includeUrls, error);
        exit(1);
      }
    }
    const excludeUrls = this.get("excludeUrls");
    if (excludeUrls) {
      try {
        new RegExp(excludeUrls);
      } catch (error) {
        console.error("Invalid --exclude-url regex:" + this.get("excludeUrls"), error);
        exit(1);
      }
    }

    // Validate scopes
    const action = this.get("action") as WebdiffScope;
    this.settingsConfig.forEach((setting) => {
      if (!setting.scope.includes(action) && setting.defaultValue !== this.get(setting.objectName)) {
        console.error(`Error: Setting '${setting.objectName}' is not valid for the action '${action}'.`);
        exit(1);
      }
    });
  }
}
