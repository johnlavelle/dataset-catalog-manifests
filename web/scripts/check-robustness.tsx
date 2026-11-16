/**
 * Checks that the editor survives malformed manifests: every field of the example, and
 * every section and part field the schema knows, is replaced in turn by values of the
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
import { PartCard, type PartActions } from "../src/components/PartsField";
import ChecklistPanel from "../src/components/ChecklistPanel";
import StepsPanel from "../src/components/StepsPanel";
import YamlPreview from "../src/components/YamlPreview";
import { deepEquals as same } from "@rjsf/utils";
import {
  checklist,
  customValidate,
  hasContent,
  isMapping,
  missingCount,
  normalise,
  placeholders,
  schema,
  upgradeLegacy,
  type Manifest,
} from "../src/compliance";
import { applyBulk, bulkPlan, sharedValues } from "../src/partBulk";
import { archiveRulesApply, inArchive, tapeLabels, type Status } from "../src/guidance";
import { stagesFor } from "../src/steps";
import transformErrors from "../src/transformErrors";
import { buildPrompt } from "../src/llmPrompt";
import { parseYaml, toYaml } from "../src/yamlExport";
import exampleYaml from "../../examples/example-archived.yaml?raw";

const WRONG: unknown[] = [null, 0, 7.5, true, "", "text", [], ["a", 1], [null], [{ x: 1 }], {}, { x: { y: 1 } }];
const STATUSES = ["proposed", "active", "deprecated", "deleted"];

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

/** Sections, their fields and part fields from the schema, whether or not the example fills them. */
function schemaPaths(partKey: string): Path[] {
  const props = schema.properties as Record<string, any>;
  const found: Path[] = [];
  for (const [key, def] of Object.entries(props)) {
    found.push([key]);
    for (const field of Object.keys(def.properties ?? {})) found.push([key, field]);
  }
  const part = props.parts.additionalProperties.properties as Record<string, unknown>;
  for (const field of Object.keys(part)) found.push(["parts", partKey, field]);
  found.push(["parts", partKey], ["exceptions", 0], ["exceptions", 0, "expires"]);
  found.push(["identifiers", "related", 0], ["identifiers", "related", 0, "doi"], ["identifiers", "related", 0, "relation"]);
  // The legacy stac section, which is taken apart on load, and products, which became parts
  found.push(["stac"], ["stac", "dois"], ["stac", "dois", "x"], ["stac", "model_system"]);
  found.push(["products"], ["products", partKey], ["products", partKey, "dir"]);
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

const noActions = new Proxy({}, { get: () => () => false }) as PartActions;

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
  // Setting a field on all parts, and adding one, must cope with whatever the parts hold
  if (isMapping(data.parts)) {
    sharedValues(data.parts);
    const keys = new Set(Object.keys(data.parts));
    applyBulk(data.parts, "type", "diagnostic", bulkPlan(data.parts, "type", "diagnostic", keys, false));
  }
  const text = toYaml(data);
  buildPrompt(text, data);
  // What the editor writes can be opened again (unless the input was refused to begin with)
  if (text && !refused) parseYaml(text);
  const noop = () => {};
  render(<ManifestForm formData={data} onChange={noop} />);
  // Closed cards hold no fields, so each part is also shown open
  if (isMapping(data.parts)) {
    for (const [key, part] of Object.entries(data.parts)) {
      render(
        <PartCard
          partKey={key}
          part={isMapping(part) ? part : {}}
          fieldId="root_parts"
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

// The example: an active dataset on tape
const example = parseYaml(exampleYaml);
const partKey = Object.keys(example.parts as object)[0];
const base: Manifest = example;
/** The example before it was written to tape: in project space, the switch off. */
const { on_tape: _onTape, ...diskDataset } = base.dataset as Manifest;
const onDisk: Manifest = { ...base, dataset: { ...diskDataset, path: "/data/projects/qaanaaq_fieldwork/campaigns" } };
const seen = new Set<string>();
const paths = [...pathsOf(base), ...schemaPaths(partKey)].filter((p) => {
  const key = JSON.stringify(p);
  return !seen.has(key) && seen.add(key);
});

// Active and in the archive shows nearly every field; deleted adds the deletion record and its dates. The
// other statuses, in the archive or not, only change which checklist groups and steps apply, so they are
// covered without the mutations.
const cases: { label: string; doc: Manifest }[] = STATUSES.flatMap((status) => [
  { label: `status ${status}, on disk`, doc: { ...onDisk, status } },
  { label: `status ${status}, on tape`, doc: { ...base, status } },
]);
const mutate = (status: string, path: Path) => {
  const doc = { ...base, status };
  for (const value of WRONG) cases.push({ label: `[${status}] ${path.join(".")} = ${JSON.stringify(value)}`, doc: setAt(doc, path, value) });
};
for (const path of paths) {
  mutate("active", path);
  if (path[0] === "deletion" || path[0] === "dates") mutate("deleted", path);
}
// A manifest from before November 2026: the Archived status and products; and a draft from the editor of
// early November 2026, with a tape section and a part's archive directory
const { parts: oldParts, ...oldRest } = example;
cases.push({ label: "old format: status archived, products", doc: { ...oldRest, status: "archived", products: oldParts } });
cases.push({
  label: "draft with tape and archive_path",
  doc: setAt({ ...base, tape: { archived: true, location: "both" } }, ["parts", partKey, "archive_path"], `${base.dataset.path}/${partKey}`),
});
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
  const parts = {
    a: { name: "A", dir: "a", type: "raw output", category: "Ice" },
    b: { name: "B", dir: "b", category: "Ice" },
    c: { name: "C", dir: "c", type: " ", category: "Ice" },
    d: { name: "D", dir: "d", type: "diagnostic" },
    broken: "plain text",
  };
  const all = new Set(Object.keys(parts));
  const check = (label: string, got: unknown, want: unknown) =>
    JSON.stringify(got) === JSON.stringify(want) ? [] : [`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`];
  const empty = bulkPlan(parts, "type", " diagnostic ", all, true);
  const every = bulkPlan(parts, "type", "diagnostic", all, false);
  const ticked = bulkPlan(parts, "type", "diagnostic", new Set(["a", "b"]), false);
  const applied = applyBulk(parts, "type", " diagnostic ", empty) as Record<string, any>;
  return [
    ...check("Only empty values leaves values alone, and counts them", empty, { fill: ["b", "c"], replace: [], keep: ["a"] }),
    ...check("All counts different values, not equal ones", every, { fill: ["b", "c"], replace: ["a"], keep: [] }),
    ...check("Only ticked parts are reached", ticked, { fill: ["b"], replace: ["a"], keep: [] }),
    ...check("Nothing ticked, nothing changes", bulkPlan(parts, "type", "diagnostic", new Set(), false), { fill: [], replace: [], keep: [] }),
    ...check("A value is trimmed", applied.b.type, "diagnostic"),
    ...check("Other values survive", [applied.a.type, applied.b.category], ["raw output", "Ice"]),
    ...check("Order is kept", Object.keys(applied), Object.keys(parts)),
    ...check("A part that is not a mapping is left alone", applied.broken, "plain text"),
    ...check("A new part takes only what all agree on", sharedValues(parts), {}),
    ...check("Type is not passed on", sharedValues({ a: parts.a, b: parts.b, x: { type: "raw output", category: "Ice" } }), { category: "Ice" }),
  ];
}

/**
 * Old manifests and drafts open as new ones; whether the archive rules apply follows the tape switch exactly as
 * the schema has it, with the status; and a location is a directory written in full.
 */
function archiveRuleFailures(): string[] {
  const check = (label: string, got: unknown, want: unknown) =>
    JSON.stringify(got) === JSON.stringify(want) ? [] : [`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`];
  const old = { id: "x", status: "archived", dataset: { name: "N" }, products: { a: { name: "A", dir: "a" } } };
  const once = upgradeLegacy(old);
  const draft = { status: "active", dataset: { name: "N" }, tape: { archived: true, location: "parts" }, parts: { a: { name: "A", dir: "a" } } };
  const failures = [
    ...check("Archived becomes active, on tape", [once.status, "tape" in once, once.dataset.on_tape], ["active", false, true]),
    ...check("Products become parts", [once.parts, "products" in once], [old.products, false]),
    ...check("The upgrade changes nothing twice", upgradeLegacy(once), once),
    ...check("With both keys, products stays for the schema to flag", Object.keys(upgradeLegacy({ products: {}, parts: {} })), ["products", "parts"]),
    ...check("A tape section becomes the switch", [("tape" in normalise(draft)), normalise(draft).dataset.on_tape], [false, true]),
    ...check("A switch set by hand is kept", upgradeLegacy({ status: "archived", dataset: { on_tape: false } }).dataset.on_tape, false),
  ];

  // The archive rules: registered and the switch on (exactly true), and the schema, the editor and the steps agree
  for (const status of ["proposed", "active", "deprecated", "deleted"]) {
    for (const onTape of [true, false, undefined, "yes", 1]) {
      const dataset: Manifest = { name: "N", path: "/data/archive/ocean/x", description: "D" };
      if (onTape !== undefined) dataset.on_tape = onTape;
      const doc = { id: "x", status, dataset, parts: { a: { name: "A", dir: "a" } } };
      const applies = onTape === true && (status === "active" || status === "deprecated");
      const errors = validator.validateFormData(doc, schema, undefined, undefined).errors;
      const schemaSays = errors.some((e) => e.name === "required" && e.params?.missingProperty === "appraisal");
      const label = `${status}, on_tape ${JSON.stringify(onTape)}`;
      failures.push(
        ...check(`${label}: the schema's archive rule`, schemaSays, applies),
        ...check(`${label}: the editor's archive rule`, archiveRulesApply(doc), applies),
        ...check(`${label}: the steps for data on tape`, stagesFor(doc).some((s) => s.key === "recall"), applies),
        ...check(`${label}: on tape`, inArchive(doc), onTape === true),
        ...check(`${label}: a switch that is not true or false is refused`, errors.some((e) => e.property === ".dataset.on_tape"), onTape !== undefined && typeof onTape !== "boolean"),
      );
    }
  }
  // The switch reads with the lifecycle
  const labels = (["proposed", "active", "deprecated", "deleted"] as Status[]).map((st) => tapeLabels(st).label);
  failures.push(...check("Tape labels by status", labels, ["Will go to tape", "On tape", "On tape", "Was on tape"]));
  // On tape, the tier (if given) is archive
  const tiered = (tier: string, onTape: boolean) =>
    validator
      .validateFormData({ id: "x", status: "proposed", dataset: { name: "N", path: "/data/x", description: "D", on_tape: onTape }, storage: { tier }, parts: { a: { name: "A", dir: "a" } } }, schema, undefined, undefined)
      .errors.some((e) => e.property === ".storage.tier");
  failures.push(...check("On tape with tier project_space is refused, archive is not", [tiered("project_space", true), tiered("archive", true), tiered("project_space", false)], [true, false, false]));

  // A location is a directory, written in full: absolute, host:/path or a URL; no trailing slash, no empty, . or .. parts
  const locations: [string, boolean][] = [
    ["/data/projects/x", true],
    ["/data/projects/my dataset", true],
    ["/data/.hidden/x", true],
    ["/data/x.v2", true],
    ["/", true],
    ["host:/data/x", true],
    ["s3://bucket/x", true],
    ["https://example.com/a//b", true],
    ["/data/x/", false],
    ["/data//x", false],
    ["/data/./x", false],
    ["/data/../x", false],
    ["/data/x/..", false],
    ["/data/x/.", false],
    ["host:/data//x", false],
    ["data/x", false],
    ["~/x", false],
    [" /data/x", false],
  ];
  for (const [value, ok] of locations) {
    const doc = { id: "x", status: "proposed", dataset: { name: "N", path: value, legacy_path: value, description: "D" }, parts: { a: { name: "A", dir: "a" } } };
    const errors = transformErrors(validator.validateFormData(doc, schema, undefined, undefined).errors);
    const bad = errors.filter((e) => e.property === ".dataset.path" || e.property === ".dataset.legacy_path");
    failures.push(...check(`Location ${JSON.stringify(value)} accepted`, bad.length === 0, ok));
    if (!ok && bad.some((e) => e.name === "pattern"))
      failures.push(...check(`Location ${JSON.stringify(value)}: the message says what a directory is`, bad.every((e) => e.name !== "pattern" || e.message?.startsWith("A directory")), true));
  }
  return failures;
}

/**
 * The location is required once registered and whenever there is no existing location; until registered, the
 * existing location may stand in for a proposed path not decided yet. The schema and the checklist agree.
 */
function locationRuleFailures(): string[] {
  const check = (label: string, got: unknown, want: unknown) =>
    JSON.stringify(got) === JSON.stringify(want) ? [] : [`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`];
  const where: [string, Record<string, string>][] = [
    ["neither", {}],
    ["existing only", { legacy_path: "/data/old/someone/x" }],
    ["location only", { path: "/data/projects/x" }],
    ["both", { path: "/data/projects/x", legacy_path: "/data/old/someone/x" }],
  ];
  const failures: string[] = [];
  for (const status of ["proposed", "active", "deprecated", "deleted"]) {
    for (const [name, locations] of where) {
      const doc = { id: "x", status, dataset: { name: "N", description: "D", ...locations }, parts: { a: { name: "A", dir: "a" } } };
      const wanted = !("path" in locations) && (status === "active" || status === "deprecated" || !("legacy_path" in locations));
      const schemaSays = validator
        .validateFormData(doc, schema, undefined, undefined)
        .errors.some((e) => e.name === "required" && e.params?.missingProperty === "path");
      const basics = checklist(doc).find((g) => g.key === "basics")?.items.find((i) => i.label.startsWith("Title, location"));
      failures.push(
        ...check(`${status}, ${name}: the schema requires the location`, schemaSays, wanted),
        ...check(`${status}, ${name}: the checklist misses the location`, basics?.state !== "ok", wanted),
      );
    }
  }
  return failures;
}

const ruleFailures = [...bulkRuleFailures(), ...archiveRuleFailures(), ...locationRuleFailures()];
for (const message of ruleFailures) console.log(`FAIL  ${message}`);

for (const [message, labels] of failures) {
  console.log(`FAIL  ${message}\n      ${labels.length} case(s), e.g.\n      ${labels.slice(0, 6).join("\n      ")}`);
}
const failed = [...failures.values()].reduce((n, l) => n + l.length, 0);
console.log(
  `\n${cases.length} malformed variant(s) of the example: ${refused} refused on import with a message, ${failed} crashed the editor.`
);
process.exit(failed || ruleFailures.length ? 1 : 0);
