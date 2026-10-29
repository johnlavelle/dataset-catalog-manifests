import { SECTIONS } from "./guidance";

/** Fired with a section key; the section card opens itself. */
export const OPEN_SECTION_EVENT = "manifest-editor:open-section";

/** The header card holding status and catalogue ID. */
export const ENTRY_SECTION = "entry";

/** Fired with a field path before a jump, so that a collapsed part of the form (a product card) opens. */
export const REVEAL_FIELD_EVENT = "manifest-editor:reveal-field";

/** Fired to close every card in the form, product cards included. */
export const COLLAPSE_ALL_EVENT = "manifest-editor:collapse-all";

/** Accordion expand time (MUI default) plus a little slack. */
const EXPAND_MS = 350;

export const sectionDomId = (key: string) => `section-${key}`;

/** "dataset.name", ".dataset.name" or "exceptions[0].expires" as parts: ["dataset", "name"], ["exceptions", "0", "expires"]. */
export function pathParts(path: string): string[] {
  return path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
}

/** The card that renders a top-level property. */
export function sectionOf(path: string): string {
  const top = pathParts(path)[0];
  if (!top || top === "id" || top === "status") return ENTRY_SECTION;
  return SECTIONS.find((s) => s.fields.includes(top))?.key ?? ENTRY_SECTION;
}

// Inputs in a collapsed card are laid out but invisible
const isShown = (el: HTMLElement) =>
  el.offsetParent !== null && (el as HTMLInputElement).type !== "hidden" && getComputedStyle(el).visibility !== "hidden";

/**
 * Fields the form shows only once another field has a certain value (showIf in uiSchema), with
 * that field. While such a field is hidden, a jump to it goes to the field that reveals it: its
 * neighbours (Release date for the archiving date) would suggest the wrong thing.
 */
const REVEALED_BY: Record<string, string> = {
  "retention.until": "retention.kind",
  "retention.condition": "retention.kind",
  "license.reason": "license.id",
  "license.decided_by": "license.id",
  "links.contract": "storage.tier",
  "dates.archived": "status",
  "storage.lossy_settings": "storage.lossy",
  "storage.lossy_approved_by": "storage.lossy",
  "archiving.pipeline": "archiving.automated",
  "archiving.owning_team": "archiving.automated",
};

/** The field to jump to for a path: the field revealing it while it is hidden, else itself. */
function jumpTarget(path: string): string {
  const key = pathParts(path).join(".");
  const field = document.getElementById(`root_${pathParts(path).join("_")}`) as HTMLInputElement | null;
  return REVEALED_BY[key] && (!field || field.type === "hidden") ? REVEALED_BY[key] : path;
}

/**
 * The nearest element on the page for a path: the field itself or, while it is hidden
 * (e.g. retention.until before a kind is chosen), the first shown input of its closest
 * parent (here the retention kind that reveals it), then the card.
 */
function findTarget(path: string): HTMLElement | null {
  const parts = pathParts(path);
  // A list with nothing in it yet, e.g. the products: its add button
  const add = document.getElementById(`root_${parts.join("_")}_add`);
  if (add && isShown(add) && add.dataset.empty === "true") return add;
  for (let n = parts.length; n > 0; n--) {
    const id = `root_${parts.slice(0, n).join("_")}`;
    const el = document.getElementById(id);
    if (el && isShown(el)) return el;
    const inputs = document.querySelectorAll<HTMLElement>(
      `input[id^="${id}_"], textarea[id^="${id}_"], [role="combobox"][id^="${id}_"]`
    );
    const first = [...inputs].find(isShown);
    if (first) return first;
  }
  return document.getElementById(sectionDomId(sectionOf(path)));
}

function flash(el: HTMLElement) {
  el.classList.remove("goto-flash");
  void el.offsetWidth; // restart the animation when the same field is targeted twice
  el.classList.add("goto-flash");
  el.addEventListener("animationend", () => el.classList.remove("goto-flash"), { once: true });
}

function reveal(path: string) {
  const el = findTarget(path);
  if (!el) return;
  const field = el.closest<HTMLElement>(".MuiFormControl-root") ?? el;
  field.scrollIntoView({ behavior: "smooth", block: "center" });
  if (el.tabIndex >= 0 && !el.id.startsWith("section-")) el.focus({ preventScroll: true });
  flash(field);
}

/** Open the card holding a field, scroll the field into view, focus it and highlight it briefly. */
export function goTo(field: string) {
  const path = jumpTarget(field);
  const key = sectionOf(path);
  const card = document.getElementById(sectionDomId(key));
  const wasOpen = key === ENTRY_SECTION || !!card?.classList.contains("Mui-expanded");
  window.dispatchEvent(new CustomEvent(OPEN_SECTION_EVENT, { detail: key }));
  window.dispatchEvent(new CustomEvent(REVEAL_FIELD_EVENT, { detail: path }));
  // A field inside a product may first have to wait for its card to open
  const inProduct = pathParts(path)[0] === "products" && pathParts(path).length > 1;
  if (wasOpen && !inProduct) reveal(path);
  else setTimeout(() => reveal(path), EXPAND_MS);
}

/** Close every card in the form. */
export function collapseAll() {
  window.dispatchEvent(new Event(COLLAPSE_ALL_EVENT));
}

/** Open a card and scroll it to the top of the form. */
export function openSection(key: string) {
  window.dispatchEvent(new CustomEvent(OPEN_SECTION_EVENT, { detail: key }));
  document.getElementById(sectionDomId(key))?.scrollIntoView({ behavior: "smooth", block: "start" });
}
