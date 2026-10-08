/** Opens the file picker for a bank statement (PDF, CSV or Excel) and hands back the chosen file's name. */
export function pickStatementFile(onPick: (fileName: string) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.csv,.xls,.xlsx";
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) onPick(f.name);
  };
  input.click();
}
