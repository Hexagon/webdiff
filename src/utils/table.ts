import { stripAnsi } from "@cross/utils";

export function renderTable(data: string[][]) {
  // Calculate column widths
  const columnWidths: number[] = data.reduce((acc: number[], row) => {
    row.forEach((item, index) => {
      acc[index] = Math.max(acc[index] || 0, stripAnsi(item).length + 2); // +2 for spacing
    });
    return acc;
  }, []);

  // Render the table
  // Render the table
  data.forEach((row) => {
    let line = "";
    row.forEach((item, index) => {
      const ansiDiff = item.length - stripAnsi(item).length;
      line += item.padEnd(columnWidths[index] + ansiDiff) + "  ";
    });
    console.log(line);
  });
}
