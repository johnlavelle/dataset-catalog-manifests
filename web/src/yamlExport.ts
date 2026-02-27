import yaml from "js-yaml";

/** Remove empty strings, empty objects, and undefined values recursively. */
function stripEmpty(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    const filtered = obj.map(stripEmpty).filter((v) => v !== undefined);
    return filtered.length ? filtered : undefined;
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = stripEmpty(v);
      if (cleaned !== undefined) result[k] = cleaned;
    }
    return Object.keys(result).length ? result : undefined;
  }
  if (obj === "" || obj === undefined || obj === null) return undefined;
  return obj;
}

export function toYaml(formData: Record<string, unknown>): string {
  const cleaned = stripEmpty(formData);
  if (!cleaned || typeof cleaned !== "object") return "";
  return yaml.dump(cleaned, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

export function parseYaml(text: string): Record<string, unknown> {
  const doc = yaml.load(text);
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("YAML must be a mapping (key-value object), not a scalar or list");
  }
  return doc as Record<string, unknown>;
}

export function downloadYaml(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
