import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function collectNonWhitespaceJsxText(node: ts.Node, found: string[], withinText = false) {
  if (ts.isJsxText(node) && !withinText && node.getText().trim()) {
    found.push(node.getText().trim());
    return;
  }
  if (ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName.getText();
    const childWithinText = withinText || tagName === "Text" || tagName === "SvgText";
    node.children.forEach((child) => collectNonWhitespaceJsxText(child, found, childWithinText));
    return;
  }
  node.forEachChild((child) => collectNonWhitespaceJsxText(child, found, withinText));
}

describe("ride detail JSX safety", () => {
  it("does not leave raw text nodes inside React Native views", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");
    const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rawTextNodes: string[] = [];
    collectNonWhitespaceJsxText(ast, rawTextNodes);

    expect(rawTextNodes).toEqual([]);
    expect(source).not.toContain("90m/*");
  });
});
