import yaml from "js-yaml";
import { asText, orderManifest, structureProblems, upgradeLegacy, type Manifest } from "./compliance";

/** Lets VS Code (YAML extension) validate the manifest against the schema while editing. */
const SCHEMA_HINT = "# yaml-language-server: $schema=../schemas/dataset_manifest.schema.json\n";

/** Remove empty strings, empty objects, and undefined values recursively. */
export function stripEmpty(obj: unknown): unknown {
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

/**
 * A blank line before each section (after id and status) and between products, as in
 * hand-written manifests. Only inserted before keys: a top-level key starts in column 0 and
 * a product key is indented by exactly two spaces, while multi-line values are indented deeper.
 */
function spaceOut(text: string): string {
  const out: string[] = [];
  let inProducts = false;
  let firstProduct = true;
  for (const line of text.split("\n")) {
    if (/^[^\s#-]/.test(line)) {
      inProducts = line.startsWith("products:");
      firstProduct = true;
      if (out.length && !/^(id|status):/.test(line)) out.push("");
    } else if (inProducts && /^ {2}[^\s#-]/.test(line)) {
      if (!firstProduct) out.push("");
      firstProduct = false;
    }
    out.push(line);
  }
  return out.join("\n");
}

export function toYaml(formData: Record<string, unknown>): string {
  const cleaned = stripEmpty(formData);
  if (!cleaned || typeof cleaned !== "object") return "";
  // Dates and YAML 1.1 booleans ("no", "yes") are quoted by js-yaml, so PyYAML reads them back as strings.
  return (
    SCHEMA_HINT +
    spaceOut(
      yaml.dump(orderManifest(cleaned as Record<string, unknown>), {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false,
      })
    )
  );
}

export function parseYaml(text: string): Record<string, unknown> {
  // CORE_SCHEMA keeps unquoted dates (2024-05-22) as strings, as the schema expects
  const doc = yaml.load(text, { schema: yaml.CORE_SCHEMA });
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("YAML must be a mapping (key-value object), not a scalar or list");
  }
  const manifest = upgradeLegacy(doc as Record<string, unknown>);
  const problems = structureProblems(manifest);
  if (problems.length) {
    const more = problems.length > 3 ? ` (and ${problems.length - 3} more)` : "";
    throw new Error(`The form cannot hold this YAML: ${problems.slice(0, 3).join("; ")}${more}`);
  }
  return manifest;
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

/** Save a manifest as <id>.yaml, as JSON if it cannot be written as YAML. */
export function downloadManifest(data: Manifest): void {
  let text: string;
  try {
    text = toYaml(data);
  } catch {
    text = JSON.stringify(data, null, 2);
  }
  downloadFile(text, `${asText(data.id) || "manifest-draft"}.yaml`, "text/yaml");
}
