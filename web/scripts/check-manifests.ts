/**
 * Checks that every manifest survives the web editor: each file is loaded, turned into form
 * state and written back exactly as the page does it (parseYaml → normalise → rjsf form
 * state → toYaml), and validated with the editor's own validator.
 *
 *   npm run check:manifests              report; fails on data loss or editor errors
 *   npm run check:manifests -- --write   also rewrite files in the editor's format
 *
 * Formatting differences and comments (which the editor drops) are reported, not failed,
 * so hand-written and AI-written manifests still pass.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import validator from "@rjsf/validator-ajv8";
import { getDefaultFormState } from "@rjsf/utils";
import { customValidate, normalise, schema, type Manifest } from "../src/compliance";
import transformErrors from "../src/transformErrors";
import { parseYaml, stripEmpty, toYaml } from "../src/yamlExport";

const root = resolve(process.cwd(), "..");
const write = process.argv.includes("--write");
const SCHEMA_HINT = /^# yaml-language-server:/;

/** As the page does on load and on every change. */
function throughEditor(parsed: Manifest): Manifest {
  return normalise(getDefaultFormState(validator, schema, normalise(parsed), schema) as Manifest);
}

/** Paths where two parsed documents differ. */
function differences(a: unknown, b: unknown, path = ""): string[] {
  if (isDeepStrictEqual(a, b)) return [];
  const isObj = (v: unknown) => v && typeof v === "object" && !Array.isArray(v);
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    return [...keys].flatMap((k) =>
      differences((a as Manifest)[k], (b as Manifest)[k], path ? `${path}.${k}` : k)
    );
  }
  return [path || "(root)"];
}

const files = ["manifests", "examples"].flatMap((dir) =>
  readdirSync(join(root, dir))
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => join(dir, f))
);

let failures = 0;
for (const file of files) {
  const text = readFileSync(join(root, file), "utf8");
  const notes: string[] = [];
  let failed = false;

  let parsed: Manifest;
  try {
    parsed = parseYaml(text);
  } catch (e) {
    console.log(`FAIL  ${file}\n      error: cannot be opened: ${(e as Error).message}`);
    failures++;
    continue;
  }

  const state = throughEditor(parsed);
  const output = toYaml(state);

  const lost = differences(stripEmpty(parsed), parseYaml(output));
  if (lost.length) {
    failed = true;
    notes.push(`error: changed or lost when saved from the editor: ${lost.join(", ")}`);
  }

  const { errors } = validator.validateFormData(state, schema, customValidate, transformErrors);
  for (const e of errors) {
    failed = true;
    notes.push(`error: editor shows: ${e.property ?? ""} ${e.message}`.replace(/\s+/g, " "));
  }

  const comments = text.split("\n").filter((l) => /^\s*#/.test(l) && !SCHEMA_HINT.test(l));
  if (comments.length) notes.push(`note:  ${comments.length} comment line(s) are dropped when saved from the editor`);

  if (output !== text) {
    if (write && !failed) {
      writeFileSync(join(root, file), output);
      notes.push("note:  rewritten in the editor's format");
    } else {
      notes.push("note:  formatting differs from the editor's output (fix with: npm run check:manifests -- --write)");
    }
  }

  if (failed) failures++;
  console.log(`${failed ? "FAIL" : notes.length ? "NOTE" : "OK"}`.padEnd(6) + file);
  for (const n of notes) console.log(`      ${n}`);
}

console.log(`\n${files.length} file(s), ${failures} incompatible with the web editor.`);
process.exit(failures ? 1 : 0);
