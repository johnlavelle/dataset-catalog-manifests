import { savedManifests } from "./draft";

/** Set once the tour has been finished or skipped in this browser. */
const TOUR_KEY = "dataset-manifest-editor:tour-done";

export type Side = "bottom" | "top" | "left" | "right";

export interface TourStep {
  /** The elements to point at, as a CSS selector (all visible matches); none centres the card. */
  target?: string;
  /** Side of the target to put the card on, if there is room. */
  side?: Side;
  /** Side-panel tab to show first. */
  tab?: "checklist" | "steps" | "yaml";
  /** Section card to open first. */
  section?: string;
  title: string;
  text: string;
}

/** A first look at the screen, in the order of the Quick start on the About page. */
export const TOUR: TourStep[] = [
  {
    title: "Welcome to the Dataset Manifest Editor",
    text:
      "A manifest is the catalogue entry for one dataset: what it is, who is responsible for it, how long it is kept " +
      "and where the data lives. This short tour shows you around the screen. What you type is saved in this browser; " +
      "nothing is sent anywhere.",
  },
  {
    target: '[data-tour="start"]',
    title: "Start or pick up a manifest",
    text:
      "New starts an empty form, Open loads a .yaml file and Recent lists the manifests you have edited in this " +
      "browser. Example shows every field in use for a fictional archived dataset. AI prompt gives you a file with " +
      "which an AI assistant interviews you and writes the YAML.",
  },
  {
    target: "#section-entry",
    title: "The status comes first",
    text:
      "The lifecycle status decides which fields are mandatory, what the checklist asks for and which steps are " +
      "shown. A new dataset starts as Proposed: only the basics and its products are needed then. The catalogue ID " +
      "becomes the file name, <id>.yaml, and never changes; “From title” suggests one.",
  },
  {
    target: '[data-tour="sections"]',
    title: "The section bar",
    text:
      "One chip per card; click one to jump to it. The dot shows how the card stands: red has fields to fix, blue is " +
      "required now, green is filled in, grey is not needed yet.",
  },
  {
    target: '#section-dataset [data-tour="card-header"], #section-dataset [data-tour="guidance"]',
    side: "top",
    section: "dataset",
    title: "Cards",
    text:
      "Each card holds one part of the manifest and says whether it is required for the chosen status. “How to fill " +
      "this in” explains what the card asks and why, with the rule behind it from the DMI documents.",
  },
  {
    target: '[data-tour="panel"]',
    side: "left",
    tab: "checklist",
    title: "The checklist",
    text:
      "What the chosen status requires, what the next one will need, recommendations and open placeholders, each " +
      "with the requirement behind it. The number on the tab counts what is still to fix or fill in. Click an item " +
      "to go to its field.",
  },
  {
    target: '[data-tour="panel"]',
    side: "left",
    tab: "steps",
    title: "The steps",
    text:
      "The work behind the chosen status, in order and by role: registering, preparing, packaging data as squashfs, " +
      "checksums, deleting. Commands are filled in from the manifest; check them before you run them.",
  },
  {
    target: '[data-tour="panel"]',
    side: "left",
    tab: "yaml",
    title: "YAML, and submitting it",
    text:
      "The manifest as it will be saved. Download it as <id>.yaml and add it to manifests/ in the catalogue " +
      "repository in a merge request; CI checks it and the Data Owner approves it. The pencil button lets you paste " +
      "YAML, e.g. from an AI assistant, and apply it to the form.",
  },
  {
    target: '[data-tour="help"]',
    title: "Help, and this tour again",
    text:
      "The ? button opens the About page: the lifecycle, the roles, the rules, conventions and common questions. The " +
      "flag next to it starts this tour again. A good place to begin: the status, then the Dataset card, then the " +
      "checklist.",
  },
];

/**
 * Whether to start the tour by itself: it has not been taken in this browser and nothing is saved
 * here, so that people who used the editor before it had a tour are not held up by it. Never when
 * the browser keeps nothing, or it would start on every visit.
 */
export function firstVisit(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === null && savedManifests().length === 0;
  } catch {
    return false;
  }
}

export function setTourDone() {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    // It starts again on the next visit
  }
}
