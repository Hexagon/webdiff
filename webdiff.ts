import { exit } from "@cross/utils";

import { Settings } from "./src/cli/settings.ts";

import { help } from "./src/cli/help.ts";
import { diff } from "./src/diff/diff.ts";
import { crawl } from "./src/crawl/crawl.ts";
import { serve } from "./src/serve/serve.ts";

import { Debug } from "./src/cli/debug.ts";

const settings = Settings.getInstance();

async function main() {
  // Enable verbose debugging if requested, as soon as possible
  if (settings.get("verbose")) {
    Debug.verbose();
  }

  // Extract action
  const action = settings.get("action");

  console.log(settings.exportToObject());
  
  // Handle no-ops
  if (settings.get("help") || action === "help") {
    help();
    exit(0);
  }

  switch (action) {
    case "diff":
      await diff(settings.get("target"), settings.get("targetTwo"), !!settings.get("verbose"), settings.get("output"));
      break;
    case "serve":
      // Assume args.port is validated by args.ts
      serve(parseInt(settings.get("port"), 10), settings.get("output"), settings.get("target"));
      break;
    case "resume":
      await crawl(settings.get("target"), true);
      break;
    case "crawl":
      await crawl(settings.get("target"));
      break;
    default:
      console.error("Invalid arguments or missing action specified.");
      exit(1);
  }
}

// Using the import.meta.main idiom to specify the entry point of the executable script.
if (import.meta.main) {
  await main();
}
