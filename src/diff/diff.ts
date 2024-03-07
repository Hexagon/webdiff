import { exit } from "@cross/utils";
import { exists } from "std/fs";
import { colors } from "cliffy/ansi/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { AssetReportData, ReportData } from "../crawl/report.ts";
import { createTwoFilesPatch } from "diff";
import { unzlibSync } from "fflate";
import { join } from "std/path";
import { readFile } from "node:fs/promises";

interface ChangedAssetData {
  change_type: "removed" | "added" | "modified";
  old?: AssetReportData;
  new?: AssetReportData;
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
  const file1Data = await readFile(file1Path);
  const file2Data = await readFile(file2Path);
  const file1Text = new TextDecoder().decode(file1Data);
  const file2Text = new TextDecoder().decode(file2Data);
  const file1Object: ReportData = JSON.parse(file1Text);
  const file2Object: ReportData = JSON.parse(file2Text);

  // Create dictionaries for faster lookups
  const file1Lookup = new Map();
  file1Object.assets.forEach((entry: AssetReportData) => file1Lookup.set(entry.url as string, entry));

  const file2Lookup = new Map();
  file2Object.assets.forEach((entry: AssetReportData) => file2Lookup.set(entry.url as string, entry));

  // Identify changes
  const changedEntries: ChangedAssetData[] = [];
  file2Object.assets.forEach((newEntry: AssetReportData) => {
    const oldEntry = file1Lookup.get(newEntry.url as string);
    if (oldEntry) {
      // Entry exists in both, compare fields
      if (oldEntry.hash !== newEntry.hash) {
        // Add last_modified in the output
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
  file1Object.assets.forEach((oldEntry: AssetReportData) => {
    if (!file2Lookup.has(oldEntry.url)) {
      changedEntries.push({
        change_type: "removed",
        old: oldEntry,
      });
    }
  });

  return changedEntries;
}

export async function diff(report1Path: string, report2Path: string, verbose: boolean, outputDir: string) {
  try {
    const changes = await compareJSONFiles(report1Path, report2Path);

    // Create a table for structured output
    const table = new Table()
      .header([colors.bold("URL"), colors.bold("Change Type"), colors.bold("Last Modified")]);

    for (const change of changes) {
      switch (change.change_type) {
        case "added":
          table.push([change.new?.url, colors.green(change.change_type), change.new?.last_modified || ""]);
          break;
        case "removed":
          table.push([change.old?.url, colors.red(change.change_type), ""]);
          break;
        case "modified":
          table.push([change.new?.url, colors.yellow(change.change_type), change.new?.last_modified || ""]);
          if (verbose && change.new && change.old) {
            const assetDir = join(outputDir, "assets");
            const file1Path = `${assetDir}/${change.new.hash}`;
            const file2Path = `${assetDir}/${change.old.hash}`;
            const file1 = new TextDecoder().decode(unzlibSync(await readFile(file1Path)));
            const file2 = new TextDecoder().decode(unzlibSync(await readFile(file2Path)));
            const patch = createTwoFilesPatch(file1Path, file2Path, file1, file2);
            table.push([patch]);
          }
          break;
      }
    }
    console.log(table.toString());
  } catch (error) {
    console.error("Error comparing reports:", error);
    exit(1);
  }
}
