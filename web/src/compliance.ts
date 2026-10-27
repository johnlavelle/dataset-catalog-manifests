import type { FormValidation, RJSFSchema } from "@rjsf/utils";
import rawSchema from "../../schemas/dataset_manifest.schema.json";
import { REGISTERED, statusOf } from "./guidance";
import { EXAMPLE_ID, OWNERS, isApprovedOwner } from "./owners";

export type Manifest = Record<string, any>;

export const schema = rawSchema as RJSFSchema;

export const TBD_RE = /^TBD by (\d{4}-\d{2}-\d{2})$/;
export const PERSON_RE = new RegExp(rawSchema.definitions.person.pattern);
const ARCHIVE_PREFIX = "/dmidata/archive/";

/** Top-level properties that hold an object; kept as {} in the form so nested errors show on fields. */
const OBJECT_KEYS = [
  "dataset",
  "roles",
  "retention",
  "license",
  "identifiers",
  "links",
  "dates",
  "storage",
  "appraisal",
  "archiving",
  "deletion",
  "extensions",
  "stac",
  "products",
];

const PRODUCT_KEY_ORDER = ["name", "dir", "dir_pattern", "category", "model_component", "domain", "type", "notes"];

export function emptyManifest(): Manifest {
  return normalise({ status: "proposed" });
}

export const has = (v: unknown) =>
  v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/** A mapping of keys to values, not a list or a single value. */
export const isMapping = (v: unknown): v is Manifest => !!v && typeof v === "object" && !Array.isArray(v);

/** A value shown in a text input: anything but text, a number or a boolean shows as empty. */
export const asText = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";

/** True if a value, or anything nested in it, is non-empty. */
export function hasContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasContent);
  return has(value);
}

export const isTbd =(v: unknown) => typeof v === "string" && v.startsWith("TBD");

export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function kindOf(v: unknown): string {
  if (Array.isArray(v)) return "a list";
  if (typeof v === "string") return "text";
  return typeof v === "object" ? "a mapping" : `a ${typeof v}`;
}

interface SchemaNode {
  type?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  additionalProperties?: SchemaNode | boolean;
}

/**
 * Mappings and lists of the wrong kind, following the schema: e.g. a list where a section
 * belongs, or text where a list of users belongs. The form has no way to show or repair
 * them, so a file with any of these is refused on import with this list. Empty values and
 * wrong single values (a number for a date) are left to the validator.
 */
export function structureProblems(data: Manifest): string[] {
  const problems: string[] = [];
  const walk = (value: unknown, node: SchemaNode | undefined, path: string) => {
    if (value === undefined || value === null || !node) return;
    if (node.type === "object") {
      if (!isMapping(value)) return void problems.push(`${path} must be a mapping (key: value lines), not ${kindOf(value)}`);
      const rest = typeof node.additionalProperties === "object" ? node.additionalProperties : undefined;
      for (const [k, v] of Object.entries(value)) walk(v, node.properties?.[k] ?? rest, path ? `${path}.${k}` : k);
    } else if (node.type === "array") {
      if (!Array.isArray(value)) return void problems.push(`${path} must be a list ("- " lines), not ${kindOf(value)}`);
      value.forEach((v, i) => walk(v, node.items, `${path}[${i}]`));
    }
  };
  walk(data, rawSchema as SchemaNode, "");
  return problems;
}

/** Owner, Steward and Custodian are the same, non-empty person. */
export function sameRoleHolder(roles: Manifest = {}): boolean {
  return has(roles.owner) && roles.owner === roles.steward && roles.owner === roles.custodian;
}

const joinText = (...parts: unknown[]) => parts.filter((p) => typeof p === "string" && p).join("; ");

/**
 * Fields replaced in October 2026, so that older files and saved drafts open without losing
 * anything: the free-text storage.format and storage.compression move to the details fields
 * (the values are then picked from the lists again), and dataset.contact moves to
 * extensions.contact.
 */
export function upgradeLegacy(data: Manifest): Manifest {
  const out: Manifest = { ...data };
  if (isMapping(out.storage)) {
    const storage: Manifest = { ...out.storage };
    if (typeof storage.format === "string") {
      storage.format_notes = joinText(storage.format_notes, storage.format);
      delete storage.format;
    }
    if (typeof storage.compression === "string") {
      storage.compression_settings = joinText(storage.compression_settings, storage.compression);
      delete storage.compression;
    }
    out.storage = storage;
  }
  const extensions = out.extensions ?? {};
  if (isMapping(out.dataset) && "contact" in out.dataset && isMapping(extensions) && !("contact" in extensions)) {
    const { contact, ...dataset } = out.dataset;
    out.dataset = dataset;
    if (has(contact)) out.extensions = { ...extensions, contact };
  }
  return out;
}

/**
 * Bring form data into the shape the editor expects: every section present (possibly empty)
 * and fields that only apply to another choice removed (e.g. retention.until when the
 * retention is indefinite). Empty values are stripped again when exporting YAML.
 */
export function normalise(data: Manifest): Manifest {
  const out: Manifest = upgradeLegacy(data);
  for (const key of OBJECT_KEYS) {
    if (out[key] === undefined || out[key] === null) out[key] = {};
  }
  // A product key with nothing after it ("my_product:") is a product still to be filled in
  if (isMapping(out.products) && Object.values(out.products).some((p) => p === null))
    out.products = Object.fromEntries(Object.entries(out.products).map(([k, p]) => [k, p ?? {}]));

  const prune = (section: string, fields: string[], keep: boolean) => {
    if (keep || typeof out[section] !== "object") return;
    if (fields.some((f) => f in out[section])) {
      out[section] = { ...out[section] };
      for (const f of fields) delete out[section][f];
    }
  };
  const kind = out.retention.kind;
  prune("retention", ["until"], kind === "date");
  prune("retention", ["condition"], kind === "condition");
  const lic = out.license.id;
  prune("license", ["reason"], lic === "restricted" || lic === "DMI-internal");
  prune("license", ["decided_by"], lic === "restricted");
  prune("storage", ["lossy_settings", "lossy_approved_by"], out.storage.lossy === true);
  prune("archiving", ["pipeline", "owning_team"], out.archiving.automated === true);
  prune("roles", ["single_person"], sameRoleHolder(out.roles));
  return out;
}

function orderObject(obj: Manifest, order: string[]): Manifest {
  const result: Manifest = {};
  for (const k of order) if (k in obj) result[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in result)) result[k] = obj[k];
  return result;
}

/** Canonical key order for YAML output: schema order for sections, a fixed order for products. */
export function orderManifest(data: Manifest): Manifest {
  const props = (rawSchema.properties ?? {}) as Record<string, { properties?: Record<string, unknown> }>;
  const top = orderObject(data, Object.keys(props));
  for (const [key, value] of Object.entries(top)) {
    if (key === "products" && value && typeof value === "object") {
      top.products = Object.fromEntries(
        Object.entries(value as Manifest).map(([k, p]) => [k, p && typeof p === "object" ? orderObject(p, PRODUCT_KEY_ORDER) : p])
      );
    } else if (value && typeof value === "object" && !Array.isArray(value) && props[key]?.properties) {
      top[key] = orderObject(value, Object.keys(props[key].properties!));
    }
  }
  return top;
}

/** The Owner must come from registry/owners.yaml (when it lists anyone); deleted entries and the example are exempt. */
export function ownerNotApproved(data: Manifest): boolean {
  const owner = data.roles?.owner;
  return has(owner) && data.status !== "deleted" && data.id !== EXAMPLE_ID && !isApprovedOwner(owner);
}

/** Cross-field rules the JSON Schema cannot express (mirrors scripts/validate_manifests.py). */
export function customValidate(formData: Manifest | undefined, errors: FormValidation<Manifest>) {
  const roles = formData?.roles ?? {};
  if (sameRoleHolder(roles) && !roles.single_person) {
    errors.roles?.custodian?.addError(
      "Owner, Steward and Custodian are the same person — tick 'One person holds all three roles' (Standard §3)"
    );
  }
  if (formData && ownerNotApproved(formData)) {
    errors.roles?.owner?.addError(
      "Not on the list of approved Data Owners (registry/owners.yaml) — choose from the list, or ask for the person to be added"
    );
  }
  return errors;
}

/** All "TBD by YYYY-MM-DD" placeholders with their due dates. */
export function placeholders(data: Manifest): { path: string; due: string; overdue: boolean }[] {
  const found: { path: string; due: string; overdue: boolean }[] = [];
  const now = today();
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string") {
      const m = TBD_RE.exec(v);
      if (m) found.push({ path, due: m[1], overdue: m[1] < now });
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (v && typeof v === "object") {
      for (const [k, item] of Object.entries(v)) walk(item, path ? `${path}.${k}` : k);
    }
  };
  walk(data, "");
  return found;
}

// ── Readiness checklist ─────────────────────────────────────────────────────

/**
 * ok        satisfied
 * missing   mandatory for the current status and not satisfied
 * todo      will be mandatory at a later status
 * tbd       filled with a placeholder (allowed for now)
 * warn      recommended (SHOULD) but not satisfied
 * optional  only applies in some cases
 * manual    a step outside the manifest — confirm it yourself
 */
export type CheckState = "ok" | "missing" | "todo" | "tbd" | "warn" | "optional" | "manual";

export interface CheckItem {
  label: string;
  ref?: string;
  state: CheckState;
  /** Field to jump to from the checklist, e.g. "dataset.name"; none for manual steps. */
  target?: string;
  /** A SHALL item, counted in the checklist's progress. */
  mandatory?: boolean;
}

export interface CheckGroup {
  key: string;
  title: string;
  relation: "now" | "next" | "later";
  items: CheckItem[];
}

type Rule = {
  label: string;
  ref?: string;
  level: "shall" | "should" | "optional" | "manual";
  value?: unknown;
  ok?: boolean;
  /** Fields the rule covers; the checklist jumps to the first empty one. */
  fields?: string[];
};

/** Value at a dotted path, e.g. "dataset.name". */
function valueAt(data: Manifest, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (isMapping(v) ? v[k] : undefined), data);
}

function evaluate(data: Manifest, rules: Rule[], relation: CheckGroup["relation"]): CheckItem[] {
  return rules.map(({ label, ref, level, value, ok, fields }) => {
    const target = fields && (fields.find((f) => !has(valueAt(data, f))) ?? fields[0]);
    const item = (state: CheckState): CheckItem => ({ label, ref, state, target, mandatory: level === "shall" });
    if (level === "manual") return item("manual");
    const satisfied = ok ?? has(value);
    if (satisfied && isTbd(value)) return item(relation === "now" ? "tbd" : "todo");
    if (satisfied) return item("ok");
    if (level === "optional") return item("optional");
    if (relation !== "now") return item("todo");
    return item(level === "shall" ? "missing" : "warn");
  });
}

export function checklist(data: Manifest): CheckGroup[] {
  const status = statusOf(data.status);
  const d = data.dataset ?? {};
  const roles = data.roles ?? {};
  const ret = data.retention ?? {};
  const lic = data.license ?? {};
  const ids = data.identifiers ?? {};
  const links = data.links ?? {};
  const dates = data.dates ?? {};
  const storage = data.storage ?? {};
  const appraisal = data.appraisal ?? {};
  const archiving = data.archiving ?? {};
  const deletion = data.deletion ?? {};
  const products: Manifest = data.products ?? {};
  const person = (v: unknown) => typeof v === "string" && PERSON_RE.test(v);

  const retentionFields = [
    "retention.kind",
    ret.kind === "date" ? "retention.until" : ret.kind === "condition" ? "retention.condition" : "retention.rationale",
  ];
  const retentionDeclared =
    (ret.kind === "date" && has(ret.until)) ||
    (ret.kind === "condition" && has(ret.condition)) ||
    (ret.kind === "indefinite" && has(ret.rationale));

  const basics: Rule[] = [
    { label: "Catalogue ID", ref: "REQ-CAT-003", level: "shall", value: data.id, fields: ["id"] },
    { label: "Title, location and description", ref: "REQ-CAT-004", level: "shall", ok: has(d.name) && has(d.path) && has(d.description), fields: ["dataset.name", "dataset.path", "dataset.description"] },
    { label: "At least one product", level: "shall", ok: Object.keys(products).length > 0, fields: ["products"] },
  ];

  const register: Rule[] = [
    {
      label: OWNERS.length ? "Data Owner from the approved list, with e-mail" : "Data Owner named, with e-mail",
      ref: "REQ-OWN-001",
      level: "shall",
      ok: person(roles.owner) && !ownerNotApproved(data),
      fields: ["roles.owner"],
    },
    { label: "Data Steward named, with e-mail", ref: "Standard §3", level: "shall", ok: person(roles.steward), fields: ["roles.steward"] },
    { label: "Data Custodian named, with e-mail", ref: "Standard §3", level: "shall", ok: person(roles.custodian), fields: ["roles.custodian"] },
    ...(sameRoleHolder(roles)
      ? [{ label: "Single holder of all three roles stated", ref: "Standard §3", level: "shall" as const, ok: roles.single_person === true, fields: ["roles.single_person"] }]
      : []),
    { label: "Retention declared", ref: "REQ-RET-001", level: "shall", ok: retentionDeclared, fields: retentionFields },
    {
      label: lic.id === "restricted" ? "Licence declared, with reason and decision-maker" : "Licence declared",
      ref: lic.id === "restricted" ? "REQ-LIC-002" : "REQ-LIC-001",
      level: "shall",
      ok: has(lic.id) && (lic.id !== "restricted" || (has(lic.reason) && person(lic.decided_by))),
      fields: lic.id === "restricted" ? ["license.id", "license.reason", "license.decided_by"] : ["license.id"],
    },
    { label: "Local persistent identifier", ref: "REQ-CAT-008", level: "shall", value: ids.pid, fields: ["identifiers.pid"] },
    { label: "DOI, if published or cited", ref: "REQ-CAT-009", level: "optional", value: ids.doi, fields: ["identifiers.doi"] },
    { label: "Metadata page linked", ref: "REQ-ARC-003", level: "shall", value: links.metadata, fields: ["links.metadata"] },
    { label: "Archiving guide linked", ref: "REQ-ARC-002", level: "shall", value: links.archiving_guide, fields: ["links.archiving_guide"] },
    { label: "Release date", ref: "REQ-CAT-004", level: "shall", value: dates.released, fields: ["dates.released"] },
    ...(storage.tier === "third_party"
      ? [{ label: "Contract with the supplier linked", ref: "REQ-TPY-003", level: "shall" as const, value: links.contract, fields: ["links.contract"] }]
      : []),
    { label: "Owner approves the entry, e.g. by approving the merge request", ref: "Procedure A.7", level: "manual" },
  ];

  const discipline = storage.wis2_discipline;
  const tbdLeft = placeholders(data);
  const archive: Rule[] = [
    {
      label: "Appraisal: lasting value, users, regenerability",
      ref: "REQ-APP-001/002",
      level: "shall",
      ok: has(appraisal.lasting_value) && has(appraisal.users) && has(appraisal.regenerable),
      fields: ["appraisal.lasting_value", "appraisal.users", "appraisal.regenerable"],
    },
    { label: "Appraisal approved by the Owner, with date", ref: "REQ-APP-003", level: "shall", ok: person(appraisal.approved_by) && has(appraisal.approved_on), fields: ["appraisal.approved_by", "appraisal.approved_on"] },
    { label: "Data quality verified", ref: "REQ-ARC-004", level: "shall", value: archiving.quality_verified_on, fields: ["archiving.quality_verified_on"] },
    { label: "WIS2 discipline chosen", ref: "REQ-NAME-004", level: "shall", value: discipline, fields: ["storage.wis2_discipline"] },
    { label: "File formats recorded", ref: "REQ-FMT-001", level: "shall", value: storage.formats, fields: ["storage.formats"] },
    { label: "Compression recorded ('None' if uncompressed)", ref: "Procedure C.7", level: "shall", value: storage.compression, fields: ["storage.compression"] },
    ...(storage.lossy
      ? [{ label: "Lossy compression approved by the Owner", ref: "REQ-FMT-003", level: "shall" as const, ok: has(storage.lossy_settings) && person(storage.lossy_approved_by), fields: ["storage.lossy_settings", "storage.lossy_approved_by"] }]
      : []),
    ...(archiving.automated
      ? [{ label: "Automated job documented, with owning team", ref: "REQ-OPS-002", level: "shall" as const, ok: has(archiving.pipeline) && has(archiving.owning_team), fields: ["archiving.pipeline", "archiving.owning_team"] }]
      : []),
    { label: "Archiving date", ref: "Procedure C.7", level: "shall", value: dates.archived, fields: ["dates.archived"] },
    { label: "No 'TBD' placeholders left", ref: "REQ-ARC-001", level: "shall", ok: tbdLeft.length === 0, fields: tbdLeft.slice(0, 1).map((t) => t.path) },
    {
      label: `Location under ${ARCHIVE_PREFIX}${discipline ?? "<discipline>"}/`,
      ref: "REQ-NAME-004",
      level: "should",
      ok: typeof d.path === "string" && d.path.startsWith(`${ARCHIVE_PREFIX}${discipline ?? ""}`),
      fields: ["dataset.path"],
    },
    { label: "Integrity checksums recorded", ref: "REQ-PRT-003", level: "should", value: storage.checksums, fields: ["storage.checksums"] },
    {
      label: "No intermediate files among the products",
      ref: "REQ-ARC-005",
      level: "should",
      ok: !Object.values(products).some((p) => p?.type === "intermediate file"),
      fields: ["products"],
    },
    { label: "Archive files are 5 GiB–5 TiB (ideally 10 GiB–2 TiB)", ref: "REQ-SIZE-001/002", level: "manual" },
    { label: "Names: letters, digits, underscores; ISO 8601 dates", ref: "REQ-NAME-001–003", level: "manual" },
    { label: "Write-protection applied and tested by the Custodian", ref: "REQ-PRT-001", level: "manual" },
  ];

  const remove: Rule[] = [
    { label: "Owner's approval recorded", ref: "REQ-RET-002", level: "shall", ok: person(deletion.approved_by), fields: ["deletion.approved_by"] },
    { label: "Deletion date", ref: "Procedure G.4", level: "shall", value: deletion.date, fields: ["deletion.date"] },
    { label: "Rigsarkivet authorisation, if the data has lasting value", ref: "REQ-RIG-002", level: "manual" },
  ];

  const groups: CheckGroup[] = [];
  const add = (key: string, title: string, relation: CheckGroup["relation"], rules: Rule[]) =>
    groups.push({ key, title, relation, items: evaluate(data, rules, relation) });

  add("basics", "Basics (every entry)", "now", basics);
  if (status === "proposed") {
    add("register", "Register the dataset (Procedure A)", "next", register);
    add("archive", "Archive the dataset (Procedures B–C)", "later", archive);
  } else if (status === "active") {
    add("register", "Registration (Procedure A)", "now", register);
    add("archive", "Archive the dataset (Procedures B–C)", "next", archive);
  } else if (status === "archived") {
    add("register", "Registration (Procedure A)", "now", register);
    add("archive", "Archiving (Procedures B–C, checklist §11)", "now", archive);
  } else if (status === "deprecated") {
    add("register", "Registration (Procedure A)", "now", register);
    add("delete", "Delete the dataset (Procedure G)", "next", remove);
  } else {
    add("delete", "Deletion (Procedure G)", "now", remove);
  }

  // Recommendations (SHOULD / Guidelines) that apply now
  const recs: CheckItem[] = [];
  if ((ret.kind === "date" || ret.kind === "condition") && !has(ret.rationale))
    recs.push({ label: "Give a rationale for the retention", ref: "Guidelines §4.2", state: "warn", target: "retention.rationale" });
  if (lic.id === "DMI-internal" && !has(lic.reason))
    recs.push({ label: "Record why the data is internal only", ref: "Guidelines §8.2", state: "warn", target: "license.reason" });
  if (typeof d.path === "string" && d.path.startsWith("/net/isilon"))
    recs.push({ label: "Plan migration off legacy /net/isilon", ref: "REQ-TIER-002", state: "warn", target: "dataset.path" });
  if (has(appraisal.approved_by) && has(roles.owner) && appraisal.approved_by !== roles.owner)
    recs.push({ label: "Appraisal should be approved by the Data Owner", ref: "REQ-APP-003", state: "warn", target: "appraisal.approved_by" });
  const compression = Array.isArray(storage.compression) ? storage.compression : [];
  if (compression.includes("gzip"))
    recs.push({ label: "Prefer zstd or xz to gzip", ref: "REQ-CMP-001", state: "warn", target: "storage.compression" });
  const formats: unknown[] = Array.isArray(storage.formats) ? storage.formats : [];
  if ((status === "archived" || storage.tier === "archive") && formats.some((f) => f === "binary" || f === "other"))
    recs.push({ label: "Check that every format is open and documented", ref: "REQ-FMT-001", state: "warn", target: "storage.formats" });
  const reviewed = dates.reviewed;
  if (REGISTERED.includes(status) && (!has(reviewed) || reviewed < addDays(-366)))
    recs.push({ label: "Review the entry at least yearly (set 'Last reviewed')", ref: "REQ-CAT-006", state: "warn", target: "dates.reviewed" });
  (Array.isArray(data.exceptions) ? data.exceptions : []).forEach((exc, i) => {
    if (exc?.expires && exc.expires < today())
      recs.push({ label: `Exception ${exc.id ?? ""} has expired`, ref: "REQ-EXC-003", state: "warn", target: `exceptions[${i}].expires` });
  });
  if (recs.length) groups.push({ key: "recommendations", title: "Recommendations", relation: "now", items: recs });

  return groups;
}

/** Mandatory items still open for the current status. */
export function missingCount(groups: CheckGroup[]): number {
  return groups
    .filter((g) => g.relation === "now")
    .reduce((n, g) => n + g.items.filter((i) => i.state === "missing").length, 0);
}
