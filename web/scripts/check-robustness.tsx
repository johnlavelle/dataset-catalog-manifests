/**
 * Checks that the editor survives malformed manifests: every field of the example, and
 * every section and product field the schema knows, is replaced in turn by values of the
 * wrong type (null, numbers, booleans, text, lists, mappings) and by unknown statuses.
 * Each variant goes through what the page does with a draft or an imported file
 * (normalise, validation, checklist, YAML, AI prompt) and is rendered with the form,
 * checklist and YAML panel. Any exception fails the check.
 *
 *   npm run check:robustness
 */
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import yaml from "js-yaml";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import validator from "@rjsf/validator-ajv8";
import ManifestForm from "../src/components/ManifestForm";
import ChecklistPanel from "../src/components/ChecklistPanel";
import YamlPreview from "../src/components/YamlPreview";
import { checklist, customValidate, hasContent, missingCount, normalise, placeholders, schema, type Manifest } from "../src/compliance";
import transformErrors from "../src/transformErrors";
import { buildPrompt } from "../src/llmPrompt";
import { parseYaml, toYaml } from "../src/yamlExport";
import exampleYaml from "../../examples/example-archived.yaml?raw";

const WRONG: unknown[] = [null, 0, 7.5, true, "", "text", [], ["a", 1], [null], [{ x: 1 }], {}, { x: { y: 1 } }];
const STATUSES = ["proposed", "active", "archived", "deprecated", "deleted"];

type Path = (string | number)[];

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function setAt(doc: Manifest, path: Path, value: unknown): Manifest {
  const out = clone(doc);
  let node: any = out;
  path.slice(0, -1).forEach((key, i) => {
    if (node[key] === null || typeof node[key] !== "object") node[key] = typeof path[i + 1] === "number" ? [] : {};
    node = node[key];
  });
  node[path[path.length - 1]] = clone(value);
  return out;
}

/** Every path in a document, objects and arrays included. */
function pathsOf(value: unknown, path: Path = []): Path[] {
  const found: Path[] = path.length ? [path] : [];
  if (Array.isArray(value)) value.forEach((v, i) => found.push(...pathsOf(v, [...path, i])));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) found.push(...pathsOf(v, [...path, k]));
  return found;
}

/** Sections, their fields and product fields from the schema, whether or not the example fills them. */
function schemaPaths(productKey: string): Path[] {
  const props = schema.properties as Record<string, any>;
  const found: Path[] = [];
  for (const [key, def] of Object.entries(props)) {
    found.push([key]);
    for (const field of Object.keys(def.properties ?? {})) found.push([key, field]);
  }
  const product = props.products.additionalProperties.properties as Record<string, unknown>;
  for (const field of Object.keys(product)) found.push(["products", productKey, field]);
  found.push(["products", productKey], ["exceptions", 0], ["exceptions", 0, "expires"], ["stac", "dois", "x"]);
  return found;
}

/** A fresh style cache per render: the default one keeps every style it has seen, and runs out of memory. */
const render = (element: ReactElement) =>
  renderToString(<CacheProvider value={createCache({ key: "css" })}>{element}</CacheProvider>);

/**
 * What App does with a draft or an imported file, plus rendering the form and both panels.
 * Import may refuse a file with a message (returns true); the draft is rendered either way,
 * as one saved by an older version of the editor could hold anything.
 */
function exercise(input: Manifest): boolean {
  let refused = false;
  try {
    parseYaml(yaml.dump(input));
  } catch {
    refused = true;
  }
  const data = normalise(input);
  const errors = validator.validateFormData(data, schema, customValidate, transformErrors).errors;
  missingCount(checklist(data));
  placeholders(data);
  const { status: _, ...rest } = data;
  Object.values(rest).some(hasContent);
  const text = toYaml(data);
  buildPrompt(text);
  // What the editor writes can be opened again (unless the input was refused to begin with)
  if (text && !refused) parseYaml(text);
  const noop = () => {};
  render(<ManifestForm formData={data} onChange={noop} />);
  render(<ChecklistPanel formData={data} errors={errors} />);
  render(<YamlPreview formData={data} onImport={noop} />);
  return refused;
}

const base = parseYaml(exampleYaml);
const productKey = Object.keys(base.products as object)[0];
const seen = new Set<string>();
const paths = [...pathsOf(base), ...schemaPaths(productKey)].filter((p) => {
  const key = JSON.stringify(p);
  return !seen.has(key) && seen.add(key);
});

// Archived shows nearly every field; deleted adds the deletion record and its dates. The other
// statuses only change which checklist groups apply, so they are covered without the mutations.
const cases: { label: string; doc: Manifest }[] = STATUSES.map((status) => ({ label: `status ${status}`, doc: { ...base, status } }));
const mutate = (status: string, path: Path) => {
  const doc = { ...base, status };
  for (const value of WRONG) cases.push({ label: `[${status}] ${path.join(".")} = ${JSON.stringify(value)}`, doc: setAt(doc, path, value) });
};
for (const path of paths) {
  mutate("archived", path);
  if (path[0] === "deletion" || path[0] === "dates") mutate("deleted", path);
}
for (const value of [...WRONG, "activeqwerty", "ACTIVE"]) cases.push({ label: `status = ${JSON.stringify(value)}`, doc: { ...base, status: value } });
cases.push({ label: "empty manifest", doc: {} });

// React and MUI report odd values (prop types, values not among the options) on console.error
// and console.warn; only exceptions count here
const { error: consoleError, warn: consoleWarn } = console;
console.error = console.warn = () => {};
const failures = new Map<string, string[]>();
let refused = 0;
const started = Date.now();
for (const [i, { label, doc }] of cases.entries()) {
  if (process.env.PROGRESS && i % 200 === 0) process.stderr.write(`${i}/${cases.length} ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
  try {
    if (exercise(doc)) refused++;
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    failures.set(message, [...(failures.get(message) ?? []), label]);
  }
}
console.error = consoleError;
console.warn = consoleWarn;

for (const [message, labels] of failures) {
  console.log(`FAIL  ${message}\n      ${labels.length} case(s), e.g.\n      ${labels.slice(0, 6).join("\n      ")}`);
}
const failed = [...failures.values()].reduce((n, l) => n + l.length, 0);
console.log(
  `\n${cases.length} malformed variant(s) of the example: ${refused} refused on import with a message, ${failed} crashed the editor.`
);
process.exit(failed ? 1 : 0);
