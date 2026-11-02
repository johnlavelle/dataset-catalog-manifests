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
import validator, { customizeValidator } from "@rjsf/validator-ajv8";
import { createSchemaUtils, type RJSFSchema, type ValidationData } from "@rjsf/utils";
import formValidator, { formSchema, onlyErrors } from "../src/formValidator";
import ManifestForm from "../src/components/ManifestForm";
import { ProductCard, type ProductActions } from "../src/components/ProductsField";
import ChecklistPanel from "../src/components/ChecklistPanel";
import StepsPanel from "../src/components/StepsPanel";
import YamlPreview from "../src/components/YamlPreview";
import { deepEquals as same } from "@rjsf/utils";
import { checklist, customValidate, hasContent, isMapping, missingCount, normalise, placeholders, schema, type Manifest } from "../src/compliance";
import { applyBulk, bulkPlan, sharedValues } from "../src/productBulk";
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
  found.push(["products", productKey], ["exceptions", 0], ["exceptions", 0, "expires"]);
  found.push(["identifiers", "related", 0], ["identifiers", "related", 0, "doi"], ["identifiers", "related", 0, "relation"]);
  // The legacy stac section, which is taken apart on load
  found.push(["stac"], ["stac", "dois"], ["stac", "dois", "x"], ["stac", "model_system"]);
  return found;
}

/** rjsf's own validator, with an Ajv of its own, and what the form holds is measured against it. */
const reference = customizeValidator();
const referenceUtils = createSchemaUtils(reference, schema as RJSFSchema);
const formUtils = createSchemaUtils(formValidator, formSchema);
const sorted = (errors: { property?: string; message?: string; stack: string }[]) =>
  errors.map((e) => `${e.property} ${e.stack}`).sort();

function compareResults(label: string, want: ValidationData<any>, got: ValidationData<any>) {
  const wantTree = onlyErrors(want.errorSchema) ?? {};
  const detail = JSON.stringify([sorted(want.errors), wantTree, sorted(got.errors), got.errorSchema]).slice(0, 400);
  // The same errors in another order are the same errors
  if (JSON.stringify(sorted(want.errors)) !== JSON.stringify(sorted(got.errors))) throw new Error(`${label}: errors differ: ${detail}`);
  if (!same(wantTree, got.errorSchema)) throw new Error(`${label}: error trees differ: ${detail}`);
}

/** The form's validator must report exactly what rjsf's does, however it gets there. */
function compareValidators(data: Manifest) {
  // As the form validates: against the schema resolved for the data
  compareResults(
    "form",
    reference.validateFormData(data, referenceUtils.retrieveSchema(schema as RJSFSchema, data), customValidate, transformErrors),
    formValidator.validateFormData(data, formUtils.retrieveSchema(formSchema, data), customValidate, transformErrors)
  );
  // As App validates, for the checklist: against the schema itself
  compareResults(
    "checklist",
    reference.validateFormData(data, schema as RJSFSchema, customValidate, transformErrors),
    formValidator.validateFormData(data, schema as RJSFSchema, customValidate, transformErrors)
  );
}

const noActions = new Proxy({}, { get: () => () => false }) as ProductActions;

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
  compareValidators(data);
  missingCount(checklist(data));
  placeholders(data);
  const { status: _, ...rest } = data;
  Object.values(rest).some(hasContent);
  // Setting a field on all products, and adding one, must cope with whatever the products hold
  if (isMapping(data.products)) {
    sharedValues(data.products);
    const keys = new Set(Object.keys(data.products));
    applyBulk(data.products, "type", "diagnostic", bulkPlan(data.products, "type", "diagnostic", "all", keys));
  }
  const text = toYaml(data);
  buildPrompt(text, data);
  // What the editor writes can be opened again (unless the input was refused to begin with)
  if (text && !refused) parseYaml(text);
  const noop = () => {};
  render(<ManifestForm formData={data} onChange={noop} />);
  // Closed cards hold no fields, so each product is also shown open
  if (isMapping(data.products)) {
    for (const [key, product] of Object.entries(data.products)) {
      render(
        <ProductCard
          productKey={key}
          product={isMapping(product) ? product : {}}
          fieldId="root_products"
          open
          ticked={false}
          showTick
          status={data.status}
          errors={undefined}
          actions={noActions}
        />
      );
    }
  }
  render(<ChecklistPanel formData={data} errors={errors} />);
  render(<StepsPanel formData={data} errors={errors} />);
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
const manifests = import.meta.glob("../../manifests/*.yaml", { query: "?raw", import: "default", eager: true });
for (const [path, text] of Object.entries(manifests)) cases.push({ label: path, doc: parseYaml(text as string) });

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

/** The rules that keep a bulk change from losing a value nobody meant to lose. */
function bulkRuleFailures(): string[] {
  const products = {
    a: { name: "A", dir: "a", type: "raw output", category: "Ice" },
    b: { name: "B", dir: "b", category: "Ice" },
    c: { name: "C", dir: "c", type: " ", category: "Ice" },
    d: { name: "D", dir: "d", type: "diagnostic" },
    broken: "plain text",
  };
  const none = new Set<string>();
  const check = (label: string, got: unknown, want: unknown) =>
    JSON.stringify(got) === JSON.stringify(want) ? [] : [`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`];
  const empty = bulkPlan(products, "type", " diagnostic ", "empty", none);
  const all = bulkPlan(products, "type", "diagnostic", "all", none);
  const ticked = bulkPlan(products, "type", "diagnostic", "ticked", new Set(["a", "b"]));
  const applied = applyBulk(products, "type", " diagnostic ", empty) as Record<string, any>;
  return [
    ...check("Empty only leaves values alone", empty, { fill: ["b", "c"], replace: [] }),
    ...check("All counts different values, not equal ones", all, { fill: ["b", "c"], replace: ["a"] }),
    ...check("Ticked reaches only ticked products", ticked, { fill: ["b"], replace: ["a"] }),
    ...check("A value is trimmed", applied.b.type, "diagnostic"),
    ...check("Other values survive", [applied.a.type, applied.b.category], ["raw output", "Ice"]),
    ...check("Order is kept", Object.keys(applied), Object.keys(products)),
    ...check("A product that is not a mapping is left alone", applied.broken, "plain text"),
    ...check("A new product takes only what all agree on", sharedValues(products), {}),
    ...check("Type is not passed on", sharedValues({ a: products.a, b: products.b, x: { type: "raw output", category: "Ice" } }), { category: "Ice" }),
  ];
}
const ruleFailures = bulkRuleFailures();
for (const message of ruleFailures) console.log(`FAIL  ${message}`);

for (const [message, labels] of failures) {
  console.log(`FAIL  ${message}\n      ${labels.length} case(s), e.g.\n      ${labels.slice(0, 6).join("\n      ")}`);
}
const failed = [...failures.values()].reduce((n, l) => n + l.length, 0);
console.log(
  `\n${cases.length} malformed variant(s) of the example: ${refused} refused on import with a message, ${failed} crashed the editor.`
);
process.exit(failed || ruleFailures.length ? 1 : 0);
