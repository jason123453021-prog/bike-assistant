#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const includeRoots = ["app", "components"];
const ignored =
  /^(?:[×✓▶✕‹›·•–—←+●＋,\/☰]|&#9632;|🗺️|🖼️|\.\.\.|RPE|\/10|ms|(?:\d+(?:[.,]\d+)?)?(?:%|°|°C|km\/h|kg|kg\/m³|km|m|W|ml|kcal)|\d+(?:-\d+)?%\+?)$/u;

function listTsx(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTsx(target);
    return entry.isFile() && target.endsWith(".tsx") ? [target] : [];
  });
}

function getElementName(node) {
  if (!ts.isJsxOpeningElement(node.openingElement)) return "";
  const tagName = node.openingElement.tagName;
  return ts.isIdentifier(tagName) ? tagName.text : "";
}

function getLiteralText(node) {
  if (ts.isJsxText(node)) return node.getText().trim().replace(/\s+/g, " ");
  if (
    ts.isJsxExpression(node) &&
    node.expression &&
    ts.isStringLiteral(node.expression)
  ) {
    return node.expression.text.trim();
  }
  return "";
}

const findings = [];
for (const relativeRoot of includeRoots) {
  const directory = path.join(root, relativeRoot);
  if (!fs.existsSync(directory)) continue;
  for (const filename of listTsx(directory)) {
    const source = ts.createSourceFile(
      filename,
      fs.readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node) => {
      if (ts.isJsxElement(node) && getElementName(node) === "Text") {
        for (const child of node.children) {
          const text = getLiteralText(child);
          if (text && !ignored.test(text)) {
            const { line } = source.getLineAndCharacterOfPosition(
              child.getStart(source),
            );
            findings.push({
              file: path.relative(root, filename),
              line: line + 1,
              text,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

console.log(JSON.stringify(findings, null, 2));
if (process.argv.includes("--strict") && findings.length > 0) {
  process.exitCode = 1;
}
