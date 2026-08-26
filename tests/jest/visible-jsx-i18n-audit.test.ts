import { execFileSync } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");

describe("使用者可見 JSX i18n AST 守門", () => {
  it("以 TypeScript AST 掃描 app 與 components，且不含未抽取的可見自然語言文字", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/audit-visible-jsx-i18n.mjs"],
      { cwd: projectRoot, encoding: "utf8" },
    );
    const findings = JSON.parse(output) as Array<{ file: string }>;
    expect(findings).toEqual([]);
  });
});
