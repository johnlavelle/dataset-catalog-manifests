import type { FormValidation, RJSFSchema } from "@rjsf/utils";
import rawSchema from "../../schemas/dataset_manifest.schema.json";
import { REGISTERED, archiveRulesApply, inArchive, statusOf } from "./guidance";
import { EXAMPLE_ID, OWNERS, isApprovedOwner } from "./owners";

export type Manifest = Record<string, any>;

export const schema = rawSchema as RJSFSchema;

export const TBD_RE = /^TBD by (\d{4}-\d{2}-\d{2})$/;
export const PERSON_RE = new RegExp(rawSchema.definitions.person.pattern);

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
  "parts",
];

const PART_KEY_ORDER = ["name", "dir", "dir_pattern", "category", "model_component", "domain", "type", "notes"];

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

/** YYYY-MM-DD in local time: toISOString gives UTC, which is still yesterday just after midnight east of Greenwich. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const today = () => ymd(new Date());

export function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    // Letters (æ, ø, å) that do not decompose into a letter and an accent
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
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
 * The stac section, dropped in October 2026: its DOIs become related DOIs (titled with their
 * product code), the model system fills an empty dataset.model, and whatever else it held
 * moves to extensions.stac. The STAC catalogue is generated from the rest of the manifest
 * and a scan of the files.
 */
function upgradeStac(out: Manifest) {
  const { stac, ...rest } = out;
  const extensions = rest.extensions ?? {};
  const leftover: Manifest = {};
  if (isMapping(stac)) {
    const identifiers = rest.identifiers ?? {};
    const related = isMapping(identifiers) ? (identifiers.related ?? []) : undefined;
    const dois = isMapping(stac.dois) ? stac.dois : {};
    for (const [key, value] of Object.entries(stac)) {
      if (key === "dois" && Array.isArray(related) && isMapping(value)) {
        const known = new Set(related.map((r: unknown) => (isMapping(r) ? r.doi : undefined)));
        const added = Object.entries(value)
          .filter(([, doi]) => typeof doi === "string" && doi && !known.has(doi))
          .map(([title, doi]) => ({ doi, title }));
        const odd = Object.entries(value).filter(([, doi]) => !(typeof doi === "string" && doi));
        if (odd.length) leftover.dois = Object.fromEntries(odd);
        if (added.length) rest.identifiers = { ...identifiers, related: [...related, ...added] };
      } else if (key === "cmems_product_code" && typeof value === "string" && Object.keys(dois).includes(value)) {
        // Kept as the title of its related DOI
      } else if (key === "model_system" && isMapping(rest.dataset) && !has(rest.dataset.model) && typeof value === "string") {
        rest.dataset = { ...rest.dataset, model: value };
      } else if (has(value)) {
        leftover[key] = value;
      }
    }
  }
  const moved = isMapping(stac) ? leftover : stac;
  if (!hasContent(moved)) return rest;
  // An existing extensions.stac is never overwritten: the section then stays where it is, flagged by the schema
  if (!isMapping(extensions) || "stac" in extensions) return out;
  return { ...rest, extensions: { ...extensions, stac: moved } };
}

/**
 * Fields replaced in October 2026, so that older files and saved drafts open without losing
 * anything: the free-text storage.format and storage.compression move to the details fields
 * (the values are then picked from the lists again), dataset.contact moves to
 * extensions.contact, and the stac section is taken apart (upgradeStac).
 *
 * November 2026: Archived is no longer a status (an archived entry is active, and being in the
 * archive follows from its location), and products were renamed parts. The tape section the editor
 * wrote for a few days before that is dropped: the location says the same. Runs before anything
 * reads the status (statusOf would take "archived" for proposed), on every edit, so it changes
 * nothing twice.
 */
export function upgradeLegacy(data: Manifest): Manifest {
  let out: Manifest = { ...data };
  // The old Archived status and tape block become the tape switch, which says the same with the status
  const wasArchived = out.status === "archived" || (isMapping(out.tape) && out.tape.archived === true);
  if (out.status === "archived") out.status = "active";
  if ("tape" in out) {
    const { tape: _, ...rest } = out;
    out = rest;
  }
  if (wasArchived && isMapping(out.dataset) && !("on_tape" in out.dataset)) out.dataset = { ...out.dataset, on_tape: true };
  // With both keys, products stays where it is, flagged by the schema
  if ("products" in out && !("parts" in out)) {
    const { products, ...rest } = out;
    out = { ...rest, parts: products };
  }
  if (isMapping(out.storage)) {
    const storage: Manifest = { ...out.storage };
    // November 2026: the WIS2 discipline is the archive folder, not a field of its own
    delete storage.wis2_discipline;
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
  return "stac" in out ? upgradeStac(out) : out;
}

/**
 * Bring form data into the shape the editor expects: every section present (possibly empty)
 * and fields that only apply to another choice removed (e.g. retention.until when the
 * retention is indefinite). Empty values are stripped again when exporting YAML.
 */
/**
 * Fields that only apply to one choice in their section, as the schema's "else" rules say: with any
 * other choice they are not stored (the form hides them, and CI refuses them).
 */
export const DEPENDENT_FIELDS: { section: string; field: string; applies: (data: Manifest) => boolean }[] = [
  { section: "retention", field: "until", applies: (d) => d.retention?.kind === "date" },
  { section: "retention", field: "condition", applies: (d) => d.retention?.kind === "condition" },
  { section: "license", field: "reason", applies: (d) => d.license?.id === "restricted" || d.license?.id === "internal" },
  { section: "license", field: "decided_by", applies: (d) => d.license?.id === "restricted" },
  { section: "storage", field: "lossy_settings", applies: (d) => d.storage?.lossy === true },
  { section: "storage", field: "lossy_approved_by", applies: (d) => d.storage?.lossy === true },
  { section: "archiving", field: "pipeline", applies: (d) => d.archiving?.automated === true },
  { section: "archiving", field: "owning_team", applies: (d) => d.archiving?.automated === true },
];

/** A DOI link or "doi:" prefix in front of a DOI, which is stored bare. */
const DOI_PREFIX = /^\s*(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i;
const bareDoi = (v: unknown) => (typeof v === "string" ? v.replace(DOI_PREFIX, "") : v);

export function normalise(data: Manifest): Manifest {
  const out: Manifest = upgradeLegacy(data);
  for (const key of OBJECT_KEYS) {
    if (out[key] === undefined || out[key] === null) out[key] = {};
  }
  // A part key with nothing after it ("my_part:") is a part still to be filled in
  if (isMapping(out.parts) && Object.values(out.parts).some((p) => p === null))
    out.parts = Object.fromEntries(Object.entries(out.parts).map(([k, p]) => [k, p ?? {}]));

  for (const { section, field, applies } of DEPENDENT_FIELDS) {
    if (isMapping(out[section]) && field in out[section] && !applies(out)) {
      const { [field]: _, ...rest } = out[section];
      out[section] = rest;
    }
  }
  // roles.single_person is kept when the names differ: they often do for a moment while one is being
  // edited, and the box stays visible while ticked, so it can be unticked

  // DOIs are stored bare: a pasted https://doi.org/ link loses its prefix
  const ids = out.identifiers;
  if (isMapping(ids)) {
    const related = Array.isArray(ids.related)
      ? ids.related.map((r: unknown) => (isMapping(r) && DOI_PREFIX.test(asText(r.doi)) ? { ...r, doi: bareDoi(r.doi) } : r))
      : ids.related;
    if (DOI_PREFIX.test(asText(ids.doi)) || related?.some?.((r: unknown, i: number) => r !== ids.related[i]))
      out.identifiers = { ...ids, doi: bareDoi(ids.doi), related };
  }
  return out;
}

/**
 * Values the form hides because they only apply to another choice are kept here for the session,
 * so that switching back restores them; the manifest itself never holds them. `typed` is the form
 * as changed, `data` the same after normalise.
 */
export function keepHidden(typed: Manifest, data: Manifest, stash: Record<string, unknown>): Manifest {
  let out = data;
  for (const { section, field, applies } of DEPENDENT_FIELDS) {
    const key = `${section}.${field}`;
    if (!applies(out)) {
      const value = isMapping(typed[section]) ? typed[section][field] : undefined;
      if (has(value)) stash[key] = value;
      continue;
    }
    if (key in stash && isMapping(out[section]) && !has(out[section][field]))
      out = { ...out, [section]: { ...out[section], [field]: stash[key] } };
    delete stash[key];
  }
  return out;
}

/**
 * The path of a form field from its element id: "root_links_archiving_guide" is links.archiving_guide.
 * Keys may contain "_", so the id is matched against the keys in the data, longest first.
 */
export function pathFromId(data: unknown, id: string): string[] | null {
  if (!id.startsWith("root_")) return null;
  const walk = (node: unknown, rest: string): string[] | null => {
    if (!rest) return [];
    const keys = Array.isArray(node) ? node.map((_, i) => String(i)) : isMapping(node) ? Object.keys(node) : [];
    for (const k of keys.sort((a, b) => b.length - a.length)) {
      if (rest !== k && !rest.startsWith(`${k}_`)) continue;
      const sub = walk((node as Manifest)[k], rest.slice(k.length + 1));
      if (sub) return [k, ...sub];
    }
    return null;
  };
  return walk(data, id.slice("root_".length));
}

/** The field with this element id without spaces at either end; the same object if nothing changes. */
export function trimField(data: Manifest, id: string): Manifest {
  const path = pathFromId(data, id);
  if (!path?.length) return data;
  const value = path.reduce<unknown>((v, k) => (isMapping(v) || Array.isArray(v) ? (v as Manifest)[k] : undefined), data);
  if (typeof value !== "string" || value === value.trim()) return data;
  const set = (node: unknown, [k, ...rest]: string[]): unknown => {
    const copy: Manifest = Array.isArray(node) ? [...node] : { ...(node as Manifest) };
    copy[k] = rest.length ? set((node as Manifest)[k], rest) : value.trim() || undefined;
    return copy;
  };
  return set(data, path) as Manifest;
}

function orderObject(obj: Manifest, order: string[]): Manifest {
  const result: Manifest = {};
  for (const k of order) if (k in obj) result[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in result)) result[k] = obj[k];
  return result;
}

/** Canonical key order for YAML output: schema order for sections, a fixed order for parts. */
export function orderManifest(data: Manifest): Manifest {
  const props = (rawSchema.properties ?? {}) as Record<string, { properties?: Record<string, unknown> }>;
  const top = orderObject(data, Object.keys(props));
  for (const [key, value] of Object.entries(top)) {
    if (key === "parts" && value && typeof value === "object") {
      top.parts = Object.fromEntries(
        Object.entries(value as Manifest).map(([k, p]) => [k, p && typeof p === "object" ? orderObject(p, PART_KEY_ORDER) : p])
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
  const names = [roles.owner, roles.steward, roles.custodian];
  if (roles.single_person === true && names.every(has) && !sameRoleHolder(roles)) {
    errors.roles?.single_person?.addError("Owner, Steward and Custodian are not the same person — untick this");
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

/**
 * Placeholders are accepted until a registered dataset is in the archive (REQ-ARC-001), so whether one
 * counts depends on where a group leads: `noTbd` for the archive, and for registration once in the archive.
 */
function evaluate(data: Manifest, rules: Rule[], relation: CheckGroup["relation"], noTbd: boolean): CheckItem[] {
  return rules.map(({ label, ref, level, value, ok, fields }) => {
    const target = fields && (fields.find((f) => !has(valueAt(data, f))) ?? fields[0]);
    const item = (state: CheckState): CheckItem => ({ label, ref, state, target, mandatory: level === "shall" });
    if (level === "manual") return item("manual");
    const satisfied = ok ?? has(value);
    if (satisfied && isTbd(value)) {
      if (!noTbd) return item("tbd");
      if (relation !== "now") return item("todo");
      return item(level === "shall" ? "missing" : "warn");
    }
    if (satisfied) return item("ok");
    if (level === "optional") return item("optional");
    if (relation !== "now") return item("todo");
    return item(level === "shall" ? "missing" : "warn");
  });
}

/** Once written to the archive, the tape switch says so and the location is the archive directory (Procedure C.7). */
function archiveFolderRules(data: Manifest): Rule[] {
  return [
    {
      label: "On tape: ticked once the data is written to the archive, with the archive directory as the location",
      ref: "Procedure C.7",
      level: "shall",
      ok: inArchive(data),
      fields: ["dataset.on_tape", "dataset.path"],
    },
  ];
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
  const parts: Manifest = isMapping(data.parts) ? data.parts : {};
  const partList = Object.values(parts).filter(isMapping);
  const person = (v: unknown) => typeof v === "string" && PERSON_RE.test(v);

  const retentionFields = [
    "retention.kind",
    ret.kind === "date" ? "retention.until" : ret.kind === "condition" ? "retention.condition" : "retention.rationale",
  ];
  const retentionDeclared =
    (ret.kind === "date" && has(ret.until)) ||
    (ret.kind === "condition" && has(ret.condition)) ||
    (ret.kind === "indefinite" && has(ret.rationale));

  // Until registered, the existing location stands in for a proposed path not decided yet (as in the schema)
  const registered = REGISTERED.includes(status);
  const located = has(d.path) || (!registered && has(d.legacy_path));
  const basics: Rule[] = [
    { label: "Catalogue ID", ref: "REQ-CAT-003", level: "shall", value: data.id, fields: ["id"] },
    {
      label: registered ? "Title, location and description" : "Title, location (or existing location) and description",
      ref: "REQ-CAT-004",
      level: "shall",
      ok: has(d.name) && located && has(d.description),
      fields: ["dataset.name", "dataset.path", "dataset.description"],
    },
    { label: "At least one part", level: "shall", ok: Object.keys(parts).length > 0, fields: ["parts"] },
  ];

  const register: Rule[] = [
    ...(registered
      ? []
      : [{ label: "Location decided: where the dataset will live", ref: "REQ-CAT-004", level: "shall" as const, ok: has(d.path), fields: ["dataset.path"] }]),
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
    ...archiveFolderRules(data),
    { label: "Integrity checksums recorded", ref: "REQ-PRT-003", level: "should", value: storage.checksums, fields: ["storage.checksums"] },
    {
      label: "No intermediate files among the parts",
      ref: "REQ-ARC-005",
      level: "should",
      ok: !partList.some((p) => p.type === "intermediate file"),
      fields: ["parts"],
    },
    { label: "Archive files are 5 GiB–5 TiB (ideally 10 GiB–2 TiB)", ref: "REQ-SIZE-001/002", level: "manual" },
    { label: "Names: letters, digits, underscores; ISO 8601 dates", ref: "REQ-NAME-001–003", level: "manual" },
    { label: "Write-protection applied and tested by the Custodian", ref: "REQ-PRT-001", level: "manual" },
  ];

  const remove: Rule[] = [
    { label: "Owner's approval recorded", ref: "REQ-RET-002", level: "shall", ok: person(deletion.approved_by), fields: ["deletion.approved_by"] },
    { label: "Deletion date", ref: "Procedure G.4", level: "shall", value: deletion.date, fields: ["deletion.date"] },
    { label: "National archives authorisation, if the data has lasting value", ref: "REQ-RIG-002", level: "manual" },
  ];

  const groups: CheckGroup[] = [];
  // The last argument: placeholders no longer count (the group leads to, or is, the archive)
  const add = (key: string, title: string, relation: CheckGroup["relation"], rules: Rule[], noTbd: boolean) =>
    groups.push({ key, title, relation, items: evaluate(data, rules, relation, noTbd) });

  const archived = inArchive(data);
  add("basics", "Basics (every entry)", "now", basics, false);
  if (status === "proposed") {
    add("register", "Register the dataset (Procedure A)", "next", register, false);
    // Planned for tape: the archive record is the next step after registering
    add("archive", archived ? "Archiving record, needed once registered (Procedures B–C)" : "Archive the dataset (Procedures B–C)", archived ? "next" : "later", archive, true);
  } else if (status === "active" || status === "deprecated") {
    add("register", "Registration (Procedure A)", "now", register, archiveRulesApply(data));
    if (archived) add("archive", "Archiving (Procedures B–C, checklist §11)", "now", archive, true);
    else if (status === "active") add("archive", "Archive the dataset (Procedures B–C)", "next", archive, true);
    if (status === "deprecated") add("delete", "Delete the dataset (Procedure G)", "next", remove, false);
  } else {
    add("delete", "Deletion (Procedure G)", "now", remove, false);
  }

  // Recommendations (SHOULD / Guidelines) that apply now
  const recs: CheckItem[] = [];
  if ((ret.kind === "date" || ret.kind === "condition") && !has(ret.rationale))
    recs.push({ label: "Give a rationale for the retention", ref: "Guidelines §4.2", state: "warn", target: "retention.rationale" });
  if (lic.id === "internal" && !has(lic.reason))
    recs.push({ label: "Record why the data is internal only", ref: "Guidelines §8.2", state: "warn", target: "license.reason" });
  if (has(appraisal.approved_by) && has(roles.owner) && appraisal.approved_by !== roles.owner)
    recs.push({ label: "Appraisal should be approved by the Data Owner", ref: "REQ-APP-003", state: "warn", target: "appraisal.approved_by" });
  const compression = Array.isArray(storage.compression) ? storage.compression : [];
  if (compression.includes("gzip"))
    recs.push({ label: "Prefer zstd or xz to gzip", ref: "REQ-CMP-001", state: "warn", target: "storage.compression" });
  const formats: unknown[] = Array.isArray(storage.formats) ? storage.formats : [];
  if ((inArchive(data) || storage.tier === "archive") && formats.some((f) => f === "binary" || f === "other"))
    recs.push({ label: "Check that every format is open and documented", ref: "REQ-FMT-001", state: "warn", target: "storage.formats" });
  if (storage.tier === "archive" && !inArchive(data) && REGISTERED.includes(status))
    recs.push({ label: "The tier is Archive: tick On tape once the data is written to tape", ref: "Procedure C.7", state: "warn", target: "dataset.on_tape" });
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
