import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const files = process.argv.slice(2);

for (const path of files) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
  const sheets = workbook.worksheets.items;
  const result = { path, sheets: [] };

  for (const sheet of sheets) {
    const used = sheet.getUsedRange();
    const entry = {
      name: sheet.name,
      usedRange: used?.address ?? null,
      rowCount: used?.rowCount ?? 0,
      columnCount: used?.columnCount ?? 0,
      tables: sheet.tables.items.length,
      charts: sheet.charts.items.length,
      preview: null,
      formulaCount: 0,
    };
    if (used) {
      const rows = Math.min(used.rowCount, 12);
      const cols = Math.min(used.columnCount, 12);
      const sample = sheet.getRangeByIndexes(used.rowIndex, used.columnIndex, rows, cols);
      entry.preview = sample.values;
      const formulas = used.formulas;
      entry.formulaCount = formulas.flat().filter((v) => typeof v === "string" && v.startsWith("=")).length;
    }
    result.sheets.push(entry);
  }
  console.log(JSON.stringify(result));
}
