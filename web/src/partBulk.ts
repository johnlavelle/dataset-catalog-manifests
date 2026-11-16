import { isMapping } from "./compliance";

/**
 * Setting a field on several parts at once. Each value is written to each part: there is
 * no dataset-level default, because the validator and a STAC scan read these fields per part.
 */
export type Parts = Record<string, unknown>;

/** Fields parts often share. name, dir and notes belong to one part. */
export const BULK_FIELDS: { field: string; label: string }[] = [
  { field: "type", label: "Type" },
  { field: "category", label: "Category" },
  { field: "model_component", label: "Model component" },
  { field: "domain", label: "Domain" },
];

/** Copied to a new part when all the others agree. Not type: that is a choice about each part's role. */
const SHARED_FIELDS = ["category", "model_component", "domain"];

export interface BulkPlan {
  /** Ticked parts that have no value yet. */
  fill: string[];
  /** Ticked parts whose different value would be lost. */
  replace: string[];
  /** Ticked parts that keep a different value, because only empty values are filled. */
  keep: string[];
}

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim());

/**
 * What a change to the ticked parts would do; with onlyEmpty, values already there stay. Anything but a
 * mapping is an error in the checklist, and is left alone.
 */
export function bulkPlan(parts: Parts, field: string, value: string, ticked: Set<string>, onlyEmpty: boolean): BulkPlan {
  const plan: BulkPlan = { fill: [], replace: [], keep: [] };
  const text = value.trim();
  for (const [key, part] of Object.entries(parts)) {
    if (!isMapping(part) || !ticked.has(key)) continue;
    if (isEmpty(part[field])) plan.fill.push(key);
    else if (part[field] !== text) (onlyEmpty ? plan.keep : plan.replace).push(key);
  }
  return plan;
}

/** The parts with the plan applied, in the same order. */
export function applyBulk(parts: Parts, field: string, value: string, plan: BulkPlan): Parts {
  const keys = new Set([...plan.fill, ...plan.replace]);
  const text = value.trim();
  return Object.fromEntries(
    Object.entries(parts).map(([key, part]) => [key, keys.has(key) ? { ...(part as object), [field]: text } : part])
  );
}

/** The different text values a field has across the parts, to offer as suggestions. */
export function usedValues(parts: Parts, field: string): string[] {
  const found = new Set<string>();
  for (const part of Object.values(parts)) {
    const value = isMapping(part) ? part[field] : undefined;
    if (typeof value === "string" && value.trim()) found.add(value);
  }
  return [...found].sort();
}

/** The values a new part starts with: those every existing part has in common. */
export function sharedValues(parts: Parts): Record<string, string> {
  const shared: Record<string, string> = {};
  const all = Object.values(parts);
  for (const field of SHARED_FIELDS) {
    const used = usedValues(parts, field);
    if (used.length === 1 && all.every((p) => isMapping(p) && p[field] === used[0])) shared[field] = used[0];
  }
  return shared;
}
