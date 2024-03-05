import { parseAndValidateArgs } from "./src/cli/args.ts";

import { help } from "./src/cli/help.ts";
import { diff } from "./src/diff/diff.ts";
import { crawl } from "./src/crawl/crawl.ts";
import { serve } from "./src/serve/serve.ts";

import { Debug } from "./src/cli/debug.ts";

async function main() {
  const args = parseAndValidateArgs();

  // Enable verbose debugging if requested, as soon as possible
  if (args.verbose) {
    Debug.verbose();
  }

  // Extract action
  const action = (args._[0] ?? "").toLowerCase();

  // Handle no-ops
  if (args.help || action === "help") {
    help(args);
    Deno.exit(0);
  }

  const arg1 = (args._[1] ?? "").toLowerCase();
  const arg2 = (args._[2] ?? "").toLowerCase();

  switch (action) {
    case "diff":
      await diff(arg1, arg2, args.verbose, args.output);
      break;
    case "serve":
      // Assume args.port is validated by args.ts
      serve(parseInt(args.port, 10), args.output, arg1 || args.report);
      break;
    case "crawl":
      await crawl(arg1, args);
      break;
    default:
      console.error("Invalid arguments or missing action specified.");
      Deno.exit(1);
  }
}

// Using the import.meta.main idiom to specify the entry point of the executable script.
if (import.meta.main) {
  await main();
}
