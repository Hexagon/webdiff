import { parseAndValidateArgs } from "./src/cli/args.js";

import { help } from "./src/cli/help.js";
import { diff } from "./src/diff/diff.js";
import { crawl } from "./src/crawl/crawl.js";
import { serve } from "./src/serve/serve.js";

import { Debug } from "./src/cli/debug.js";

async function main() {
  const args = await parseAndValidateArgs();

  // Enable debug first of all
  if (args.verbose) {
    Debug.verbose();
  }

  // Extract action
  const action = (args._[0] ?? "").toLowerCase();
  const file1 = (args._[1] ?? "").toLowerCase();
  const file2 = (args._[2] ?? "").toLowerCase();

  // Handle help
  if (args.help || action == "help") {
    help(args);
    Deno.exit(0);
  }

  // Handle actions
  if (action === "diff") {
    if (file1 !== "" && file2 !== "") {
      diff(file1, file2);
    } else {
      console.error("Invalid arguments specified.");
      Deno.exit(1);
    }
  } else if (action == "serve") {
    serve(args.port, args.output, file1 || args.report);
  } else if (action == "crawl") {
    if (file1 !== "" && file2 == "") {
      crawl(file1, args);
    } else {
      console.error("Invalid arguments specified.");
      Deno.exit(1);
    }
  } else {
    console.error((args.length ? "Invalid" : "No") + " action specified");
    Deno.exit(1);
  }
}

// Using the import.meta.main idiom to specify the entry point of the executable script.
if (import.meta.main) {
  await main();
}
