import { exists } from "std/fs";
import { colors } from "cliffy/ansi/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { AssetData } from "../crawl/asset.ts";

interface ChangedAssetData {
  change_type: "removed" | "added" | "modified";
  old?: AssetData;
  new?: AssetData;
}

// Run diff
async function compareJSONFiles(file1Path: string, file2Path: string): Promise<ChangedAssetData[]> {
  // Error handling for file existence
  if (!await exists(file1Path) || !await exists(file2Path)) {
    console.error(
      "One or both JSON files not found. Paths:",
      file1Path,
      file2Path,
    );
    return [];
  }

  // Load JSON data
  const file1Data = JSON.parse(await Deno.readTextFile(file1Path));
  const file2Data = JSON.parse(await Deno.readTextFile(file2Path));

  // Create dictionaries for faster lookups
  const file1Lookup = new Map();
  file1Data.report.forEach((entry: AssetData) => file1Lookup.set(entry.url as string, entry));

  const file2Lookup = new Map();
  file2Data.report.forEach((entry: AssetData) => file2Lookup.set(entry.url as string, entry));

  // Identify changes
  const changedEntries: ChangedAssetData[] = [];
  file2Data.report.forEach((newEntry: AssetData) => {
    const oldEntry = file1Lookup.get(newEntry.url as string);
    if (oldEntry) {
      // Entry exists in both, compare fields
      if (oldEntry.hash !== newEntry.hash) {
        // Add lastModified in the output
        changedEntries.push({
          change_type: "modified",
          old: oldEntry,
          new: newEntry,
        });
      }
    } else {
      // Entry is new
      changedEntries.push({
        change_type: "added",
        new: newEntry,
      });
    }
  });

  // Detect deleted entries
  file1Data.report.forEach((oldEntry: AssetData) => {
    if (!file2Lookup.has(oldEntry.url)) {
      changedEntries.push({
        change_type: "removed",
        old: oldEntry,
      });
    }
  });

  return changedEntries;
}

export async function diff(report1Path: string, report2Path: string) {
  try {
    const changes = await compareJSONFiles(report1Path, report2Path);

    // Create a table for structured output
    const table = new Table()
      .header([colors.bold("URL"), colors.bold("Change Type"), colors.bold("Last Modified"), colors.bold("Old hash"), colors.bold("New hash")]);

    changes.forEach((change) => {
      switch (change.change_type) {
        case "added":
          table.push([change.new?.url, colors.green(change.change_type), change.new?.lastModified || "", "", change.new?.hash || ""]);
          break;
        case "removed":
          table.push([change.old?.url, colors.red(change.change_type), "", change.old?.hash || "", ""]);
          break;
        case "modified":
          table.push([change.new?.url, colors.yellow(change.change_type), change.new?.lastModified || "", change.new?.hash || "", change.old?.hash || ""]);
          break;
      }
    });
    console.log(table.toString());
  } catch (error) {
    console.error("Error comparing reports:", error);
    Deno.exit(1);
  }
}
