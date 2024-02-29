import { exists } from "std/fs/mod.ts";

// Run diff
async function compareJSONFiles(file1Path, file2Path) {
  // Error handling for file existence
  if (!await exists(file1Path) || !await exists(file2Path)) {
    console.error(
      "One or both JSON files not found. Paths:",
      file1Path,
      file2Path,
    );
    return;
  }

  // Load JSON data
  const file1Data = JSON.parse(await Deno.readTextFile(file1Path));
  const file2Data = JSON.parse(await Deno.readTextFile(file2Path));

  // Create dictionaries for faster lookups
  const file1Lookup = {};
  file1Data.forEach((entry) => file1Lookup[entry.url] = entry);

  const file2Lookup = {};
  file2Data.forEach((entry) => file2Lookup[entry.url] = entry);

  // Identify changes
  const changedEntries = [];
  file2Data.forEach((newEntry) => {
    const oldEntry = file1Lookup[newEntry.url];

    if (oldEntry) {
      // Entry exists in both, compare fields
      if (oldEntry.hash !== newEntry.hash) {
        // Add lastModified in the output
        changedEntries.push({
          url: newEntry.url,
          changeType: "modified",
          lastModified: newEntry.lastModified,
        });
      }
    } else {
      // Entry is new
      changedEntries.push({
        url: newEntry.url,
        changeType: "added",
      });
    }
  });

  // Detect deleted entries
  file1Data.forEach((oldEntry) => {
    if (!file2Lookup[oldEntry.url]) {
      changedEntries.push({
        url: oldEntry.url,
        changeType: "removed",
      });
    }
  });

  return changedEntries;
}

export async function diff(args) {
  const paths = args._;

  if (paths.length !== 2) {
    console.error("ToDo: Error message");
    Deno.exit(1);
  }

  const [report1Path, report2Path] = paths;

  try {
    const changes = await compareJSONFiles(report1Path, report2Path);
    console.log("Changes:");
    console.log(changes); // Output changes to console
  } catch (error) {
    console.error("Error comparing reports:", error);
    Deno.exit(1);
  }
}
