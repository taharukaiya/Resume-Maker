import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
const configPath = ts.findConfigFile(
  process.cwd(),
  ts.sys.fileExists,
  "tsconfig.json",
);
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  process.cwd(),
);
const host = {
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: () => "0",
  getScriptSnapshot: (file) => {
    const text = ts.sys.readFile(file);
    return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
  },
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
};
const service = ts.createLanguageService(host);
for (const file of parsed.fileNames.filter(
  (file) =>
    file.replaceAll("\\", "/").includes("/src/") ||
    file.replaceAll("\\", "/").includes("/scripts/"),
)) {
  for (const edit of service.organizeImports(
    { type: "file", fileName: file },
    {},
    {},
  )) {
    let source = fs.readFileSync(edit.fileName, "utf8");
    for (const change of [...edit.textChanges].sort(
      (a, b) => b.span.start - a.span.start,
    )) {
      source =
        source.slice(0, change.span.start) +
        change.newText +
        source.slice(change.span.start + change.span.length);
    }
    fs.writeFileSync(edit.fileName, source);
  }
}
