import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HARDEN-01 WU-A3 structural oracle: the accepted structured transforms may be
 * activated from exactly ONE production module. A second importer would mean a
 * bypass of the reviewed configuration/plan, so this oracle must be able to
 * disagree with the implementation (planted-import falsifiable).
 */
const SRC = path.resolve(__dirname, "..");

function listProductionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "testing") continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listProductionFiles(absolute));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(absolute);
    }
  }
  return out;
}

describe("structured transform isolation", () => {
  it("only transformed-dataset.ts activates T19/codify in production", () => {
    const definitionFiles = new Set(["date-age-policy.ts", "codify.ts", "transformed-dataset.ts"]);
    // `transformed-dataset.ts` is the sanctioned importer; its own file is the
    // single allowed hit (it both defines the call and is the gate).
    const hits = listProductionFiles(SRC)
      .filter((file) => !definitionFiles.has(path.basename(file)))
      .filter((file) => {
        const text = fs.readFileSync(file, "utf8");
        return text.includes("applyStructuredDateAgePolicy") || text.includes("codifyColumnValues");
      })
      .map((file) => path.relative(SRC, file));

    expect(hits.sort()).toEqual([]);
    // And the sanctioned module DOES call both (so the oracle is not vacuous).
    const sanctioned = fs.readFileSync(path.join(SRC, "structured/transformed-dataset.ts"), "utf8");
    expect(sanctioned).toContain("applyStructuredDateAgePolicy");
    expect(sanctioned).toContain("codifyColumnValues");
  });
});
