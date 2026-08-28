import fs from "node:fs";
import path from "node:path";

const sourceRoots = ["app", "components", "lib"];
const sourceExtensions = new Set([".ts", ".tsx", ".json"]);

function collectSourceFiles(relativeDirectory: string): string[] {
  const directory = path.resolve(__dirname, "../..", relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    return sourceExtensions.has(path.extname(entry.name)) ? [relativePath] : [];
  });
}

describe("繁中品牌與騎乘術語守門", () => {
  const sourceFiles = sourceRoots.flatMap(collectSourceFiles);

  it("所有使用者可見來源均不再包含已回報的品牌或騎乘錯字", () => {
    const forbiddenTerms = ["單車助理", "騎程"];
    const matches = sourceFiles.flatMap((relativePath) => {
      const contents = fs.readFileSync(
        path.resolve(__dirname, "../..", relativePath),
        "utf8",
      );
      return forbiddenTerms
        .filter((term) => contents.includes(term))
        .map((term) => `${relativePath}: ${term}`);
    });

    expect(matches).toEqual([]);
  });

  it("繁中名稱、結束騎乘與統計用詞均使用已核定詞彙", () => {
    const core = fs.readFileSync(
      path.resolve(__dirname, "../../lib/i18n/locales/core-ui.zh-TW.json"),
      "utf8",
    );
    const ui = fs.readFileSync(
      path.resolve(__dirname, "../../lib/i18n/locales/zh-TW.json"),
      "utf8",
    );

    expect(core).toContain('"appName": "單車助手"');
    expect(core).toContain('"appVersion": "單車助手 v{{version}}"');
    expect(ui).toContain('"finishRide": "結束騎乘"');
    expect(ui).toContain('"rideCount": "騎乘次數"');
  });
});
