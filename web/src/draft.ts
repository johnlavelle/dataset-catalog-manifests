import { emptyManifest, isMapping, normalise, type Manifest } from "./compliance";

/** The form is autosaved in the browser under this key. */
export const DRAFT_KEY = "dataset-manifest-editor:draft";

/** The draft as stored, or an empty object when there is none or it cannot be read. */
export function savedDraft(): Manifest {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
    return isMapping(saved) ? saved : {};
  } catch {
    // Storage unavailable or corrupt
    return {};
  }
}

/** The draft to open the editor with. */
export function loadDraft(): Manifest {
  const saved = savedDraft();
  return Object.keys(saved).length ? normalise(saved) : emptyManifest();
}

export function saveDraft(data: Manifest) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    // Autosave is a convenience only
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear
  }
}
