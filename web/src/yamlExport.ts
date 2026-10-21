import yaml from "js-yaml";
import { orderManifest } from "./compliance";

/** Lets VS Code (YAML extension) validate the manifest against the schema while editing. */
const SCHEMA_HINT = "# yaml-language-server: $schema=../schemas/dataset_manifest.schema.json\n";

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
  // Dates and YAML 1.1 booleans ("no", "yes") are quoted by js-yaml, so PyYAML reads them back as strings.
  return (
    SCHEMA_HINT +
    yaml.dump(orderManifest(cleaned as Record<string, unknown>), {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
      quotingType: '"',
      forceQuotes: false,
    })
  );
}

export function parseYaml(text: string): Record<string, unknown> {
  // CORE_SCHEMA keeps unquoted dates (2024-05-22) as strings, as the schema expects
  const doc = yaml.load(text, { schema: yaml.CORE_SCHEMA });
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("YAML must be a mapping (key-value object), not a scalar or list");
  }
  return doc as Record<string, unknown>;
}

export function downloadYaml(content: string, filename: string): void {
  downloadFile(content, filename, "text/yaml");
}

export function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy text, falling back to execCommand when the Clipboard API fails or never settles
 * (it can hang in unfocused or embedded windows). Rejects if both fail.
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Clipboard timed out")), 1500)),
    ]);
    return;
  } catch {
    // Fall back below
  }
  // Inside a dialog, the textarea must live in the dialog or its focus trap steals the selection
  const host = (document.activeElement?.closest('[role="dialog"]') as HTMLElement | null) ?? document.body;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  host.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Copy failed");
}
