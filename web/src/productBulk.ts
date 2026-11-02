import { isMapping } from "./compliance";

/**
 * Setting a field on several products at once. Each value is written to each product: there is
 * no dataset-level default, because the validator and a STAC scan read these fields per product.
 */
export type Products = Record<string, unknown>;

/** Fields products often share. name, dir and notes belong to one product. */
export const BULK_FIELDS: { field: string; label: string }[] = [
  { field: "type", label: "Type" },
  { field: "category", label: "Category" },
  { field: "model_component", label: "Model component" },
  { field: "domain", label: "Domain" },
];

/** Copied to a new product when all the others agree. Not type: that is a choice about each product's role. */
const SHARED_FIELDS = ["category", "model_component", "domain"];

/** Which products a change reaches: those without a value, all of them, or those ticked in the list. */
export type BulkScope = "empty" | "all" | "ticked";

export interface BulkPlan {
  /** Product keys that have no value yet. */
  fill: string[];
  /** Product keys whose different value would be lost. */
  replace: string[];
}

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim());

/** What a change would do. Anything but a mapping is an error in the checklist, and is left alone. */
export function bulkPlan(products: Products, field: string, value: string, scope: BulkScope, ticked: Set<string>): BulkPlan {
  const plan: BulkPlan = { fill: [], replace: [] };
  const text = value.trim();
  for (const [key, product] of Object.entries(products)) {
    if (!isMapping(product)) continue;
    const empty = isEmpty(product[field]);
    if ((scope === "empty" && !empty) || (scope === "ticked" && !ticked.has(key))) continue;
    if (empty) plan.fill.push(key);
    else if (product[field] !== text) plan.replace.push(key);
  }
  return plan;
}

/** The products with the plan applied, in the same order. */
export function applyBulk(products: Products, field: string, value: string, plan: BulkPlan): Products {
  const keys = new Set([...plan.fill, ...plan.replace]);
  const text = value.trim();
  return Object.fromEntries(
    Object.entries(products).map(([key, product]) => [key, keys.has(key) ? { ...(product as object), [field]: text } : product])
  );
}

/** The different text values a field has across the products, to offer as suggestions. */
export function usedValues(products: Products, field: string): string[] {
  const found = new Set<string>();
  for (const product of Object.values(products)) {
    const value = isMapping(product) ? product[field] : undefined;
    if (typeof value === "string" && value.trim()) found.add(value);
  }
  return [...found].sort();
}

/** The values a new product starts with: those every existing product has in common. */
export function sharedValues(products: Products): Record<string, string> {
  const shared: Record<string, string> = {};
  const all = Object.values(products);
  for (const field of SHARED_FIELDS) {
    const used = usedValues(products, field);
    if (used.length === 1 && all.every((p) => isMapping(p) && p[field] === used[0])) shared[field] = used[0];
  }
  return shared;
}
