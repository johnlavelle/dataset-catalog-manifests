import { emptyManifest, hasContent, isMapping, normalise, type Manifest } from "./compliance";
import { toYaml } from "./yamlExport";

/** Every manifest edited in this browser is kept under this key, so none is lost when another is opened. */
export const SAVED_KEY = "dataset-manifest-editor:saved";
/** Earlier versions kept a single draft under this key; it is moved into the list. */
const DRAFT_KEY = "dataset-manifest-editor:draft";
/**
 * The entry it is moved to. Always the same one: a tab still running an earlier version writes the
 * draft again on every change, which must not add an entry each time.
 */
const EARLIER_DRAFT = "earlier-draft";
/** The entry open in this tab, so that a reload reopens it. Per tab, hence sessionStorage. */
const CURRENT_KEY = "dataset-manifest-editor:current";

export interface SavedManifest {
  key: string;
  /** When it last changed, in milliseconds since 1970. */
  saved: number;
  data: Manifest;
}

/** The manifest open in the editor and the entry it is saved under. */
export interface Draft {
  key: string;
  data: Manifest;
}

export const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Nothing filled in beyond the status: such a form is not kept. */
export function isBlank(data: Manifest): boolean {
  const { status: _, ...rest } = data;
  return !Object.values(rest).some(hasContent);
}

const isEntry = (v: unknown): v is SavedManifest =>
  isMapping(v) && typeof v.key === "string" && typeof v.saved === "number" && isMapping(v.data);

function writeList(list: SavedManifest[]): boolean {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    return true;
  } catch {
    // Storage unavailable (some private windows) or full
    return false;
  }
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    // Storage unavailable or corrupt
    return null;
  }
}

/** The stored list, with the single draft of earlier versions moved into it. */
function readList(): SavedManifest[] {
  const stored = readJson(SAVED_KEY);
  const list = Array.isArray(stored) ? stored.filter(isEntry) : [];
  const draft = readJson(DRAFT_KEY);
  if (isMapping(draft) && !isBlank(draft)) {
    const entry = { key: EARLIER_DRAFT, saved: Date.now(), data: draft };
    const i = list.findIndex((e) => e.key === EARLIER_DRAFT);
    if (i >= 0) list[i] = entry;
    else list.push(entry);
    if (!writeList(list)) return list;
  }
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to remove
  }
  return list;
}

/** The manifests kept in this browser, most recently changed first. */
export function savedManifests(): SavedManifest[] {
  return readList().sort((a, b) => b.saved - a.saved);
}

function currentKey(): string | null {
  try {
    return sessionStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

function setCurrentKey(key: string) {
  try {
    sessionStorage.setItem(CURRENT_KEY, key);
  } catch {
    // A reload then opens the most recently changed manifest
  }
}

/**
 * What this tab opens with, as stored: the manifest it had open before a reload, otherwise the
 * most recently changed one, otherwise nothing.
 */
export function openingDraft(): Draft {
  const list = savedManifests();
  const key = currentKey();
  if (key !== null) return { key, data: list.find((e) => e.key === key)?.data ?? {} };
  return list[0] ? { key: list[0].key, data: list[0].data } : { key: newKey(), data: {} };
}

/** The draft to open the editor with. */
export function loadDraft(): Draft {
  const { key, data } = openingDraft();
  return { key, data: Object.keys(data).length ? normalise(data) : emptyManifest() };
}

/**
 * Keep the manifest open in this tab under its entry; a blank form removes the entry instead.
 * The time is only updated when the content changed. False if the browser does not store it.
 */
export function saveDraft({ key, data }: Draft): boolean {
  setCurrentKey(key);
  const list = readList();
  const i = list.findIndex((e) => e.key === key);
  if (isBlank(data)) {
    if (i >= 0) list.splice(i, 1);
  } else if (i < 0) {
    list.push({ key, saved: Date.now(), data });
  } else if (JSON.stringify(list[i].data) !== JSON.stringify(data)) {
    list[i] = { key, saved: Date.now(), data };
  }
  return writeList(list);
}

const yamlOf = (data: Manifest) => {
  try {
    return toYaml(data);
  } catch {
    return null;
  }
};

/**
 * An entry holding the same manifest, so that opening the same file twice does not keep two copies.
 * Compared as YAML: the form adds empty fields and orders keys its own way.
 */
export function findSaved(data: Manifest): SavedManifest | undefined {
  const text = yamlOf(data);
  return text === null ? undefined : readList().find((e) => yamlOf(e.data) === text);
}

export function removeSaved(key: string): boolean {
  return writeList(readList().filter((e) => e.key !== key));
}

/** Put back an entry that was removed. */
export function restoreSaved(entry: SavedManifest): boolean {
  return writeList([...readList().filter((e) => e.key !== entry.key), entry]);
}

/** Make the next load of this tab start with an empty form. */
export function startBlank() {
  setCurrentKey(newKey());
}
