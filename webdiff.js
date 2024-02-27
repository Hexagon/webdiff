import { parseAndValidateArgs } from "./src/cli/args.js";
import { help } from "./src/cli/help.js";
import { diff } from "./src/diff/diff.js";
import { crawl } from "./src/crawler/crawl.js";
import { Debug } from "./src/utils/debug.js";

const args = await parseAndValidateArgs();

if (args.verbose) {
    Debug.enable();
}

if (args.help) {
    help(args);
    Deno.exit(0);
} 

if (args.diff) {
    diff(args);
    Deno.exit(0);
}

// Default action is to crawl
await crawl(args);