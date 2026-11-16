import yaml from "js-yaml";
import ownersText from "../../registry/owners.yaml?raw";

/** An approved Data Owner from registry/owners.yaml (mirrors scripts/validate_manifests.py). */
export interface Owner {
  name: string;
  email: string;
  unit?: string;
}

const EMAIL_RE = /^[^<>@\s]+@[^<>@\s]+$/;
const PERSON_EMAIL_RE = /<([^<>@\s]+@[^<>@\s]+)>$/;

function parse(text: string): Owner[] {
  try {
    const data = yaml.load(text) as { owners?: unknown } | null;
    const entries = Array.isArray(data?.owners) ? data!.owners : [];
    return entries.filter(
      (o): o is Owner => !!o && typeof o.name === "string" && o.name.trim() !== "" && EMAIL_RE.test(o.email ?? "")
    );
  } catch {
    return [];
  }
}

/** Read at build time; editing the list redeploys the editor. Empty = the Owner check is off. */
export const OWNERS: Owner[] = parse(ownersText);

export const ownerPerson = (o: Owner) => `${o.name} <${o.email}>`;

const approved = new Set(OWNERS.map((o) => o.email.toLowerCase()));

/** True when the list is empty (check off) or the person's e-mail is on it. */
export function isApprovedOwner(person: unknown): boolean {
  if (!approved.size) return true;
  const m = typeof person === "string" ? PERSON_EMAIL_RE.exec(person) : null;
  return !!m && approved.has(m[1].toLowerCase());
}

/** The example entry is fictional, so the Owner check skips it (as CI does for examples/). */
export const EXAMPLE_ID = "example-archived";
