/**
 * Help texts for the editor, condensed from the DMI Storage and Archiving document
 * set (Policy POL-, Standard STD-, Procedures PRC-, Guidelines GDL-STOR-ARCH-001 v1.0).
 */

export type Status = "proposed" | "active" | "archived" | "deprecated" | "deleted";

export const STATUSES: Status[] = ["proposed", "active", "archived", "deprecated", "deleted"];

/** Statuses for which the dataset counts as registered in the catalogue. */
export const REGISTERED: Status[] = ["active", "archived", "deprecated"];

export const STATUS_INFO: Record<Status, { label: string; short: string; detail: string }> = {
  proposed: {
    label: "Proposed",
    short: "not yet registered",
    detail:
      "Draft entry: the dataset is planned, or is legacy data under triage. Only the dataset basics and products are mandatory. " +
      "To register it, name the three roles, decide retention and licence, and add the identifiers, links and release date.",
  },
  active: {
    label: "Active",
    short: "registered, in use",
    detail:
      "Registered and in active use. Every catalogue field in Standard §4.2 is mandatory. Facts and links not known yet may be " +
      "written as 'TBD by YYYY-MM-DD' (Procedure A.5); roles, retention and licence are decisions and must be made.",
  },
  archived: {
    label: "Archived",
    short: "on tape",
    detail:
      "Written to /dmidata/archive. Needs everything from Active plus an Owner-approved appraisal, WIS2 discipline, format, " +
      "compression, quality check and archiving date. No 'TBD' placeholders may remain (REQ-ARC-001).",
  },
  deprecated: {
    label: "Deprecated",
    short: "flagged, not deleted",
    detail:
      "Flagged for retirement but still kept and findable. It can be restored to Active or, with the Owner's approval, deleted.",
  },
  deleted: {
    label: "Deleted",
    short: "data removed",
    detail:
      "The data is gone but the entry stays, marked as deleted, with the deletion date and the Owner's approval (REQ-CAT-007, Procedure G).",
  },
};

/** Mandatory fields per status, as shown on the info page and in the LLM prompt. */
export const REQUIRED_BY_STATUS: [string, string][] = [
  ["Always", "Catalogue ID, status, dataset title, location and description, at least one product"],
  [
    "Active, Archived, Deprecated",
    "Owner, Steward and Custodian (name + e-mail); retention; licence; local PID; metadata page; archiving guide; release date. " +
      "Facts and links may be 'TBD by YYYY-MM-DD' until known.",
  ],
  [
    "Archived",
    "Appraisal approved by the Owner; WIS2 discipline; format; compression; quality check date; archiving date. No TBD placeholders.",
  ],
  ["Deleted", "Deletion date and the Owner's approval. The entry is never removed."],
  [
    "Whenever they apply",
    "Rationale for indefinite retention; reason and decision-maker for a restricted licence; settings and approval for lossy compression; " +
      "job and owning team for automated archiving; contract for third-party hosting.",
  ],
];

export interface Option {
  label: string;
  description?: string;
}

export const LICENSE_OPTIONS: Record<string, Option> = {
  "CC-BY-4.0": {
    label: "CC-BY 4.0",
    description: "Default for publishable, reusable scientific data. Requires attribution. Used by ECMWF and Copernicus.",
  },
  "CC0-1.0": {
    label: "CC0 (public domain)",
    description: "No attribution required. Use sparingly — DMI usually wants attribution.",
  },
  "WMO-UDP-core": {
    label: "WMO Unified Data Policy — core",
    description: "Data exchanged under the WMO framework as core data.",
  },
  "WMO-UDP-recommended": {
    label: "WMO Unified Data Policy — recommended",
    description: "Data exchanged under the WMO framework as recommended data.",
  },
  "DMI-internal": {
    label: "DMI internal use only",
    description: "Unreleased internal data. Record why it is not released externally.",
  },
  restricted: {
    label: "Restricted",
    description: "Anything narrower than the above. State the reason and the decision-maker (REQ-LIC-002).",
  },
};

export const TIER_OPTIONS: Record<string, Option> = {
  project_space: {
    label: "Project space",
    description: "Active project data under preparation or analysis. Has an owning project, a quota and an end-of-life plan.",
  },
  archive: {
    label: "Archive (/dmidata/archive)",
    description: "Tape-backed, write-protected long-term preservation of data with lasting value.",
  },
  database: {
    label: "Database storage",
    description: "Structured data served through DMI databases. Same catalogue requirements apply.",
  },
  third_party: {
    label: "Third party / supplier",
    description: "Hosted by a supplier under a written agreement that must be linked (REQ-TPY-001–003).",
  },
  legacy: {
    label: "Legacy (/net/isilon)",
    description: "Existing data awaiting triage and migration (Policy §7). Not to be used for new data (REQ-TIER-002).",
  },
};

export const WIS2_OPTIONS: Record<string, Option> = {
  "atmospheric-composition": { label: "atmospheric-composition" },
  climate: { label: "climate" },
  cryosphere: { label: "cryosphere" },
  hydrology: { label: "hydrology" },
  ocean: { label: "ocean" },
  "space-weather": { label: "space-weather" },
  weather: { label: "weather" },
};

export const RETENTION_OPTIONS: Record<string, Option> = {
  date: { label: "A fixed date", description: "Keep until a given date." },
  condition: {
    label: "A condition",
    description: "Keep until something happens, e.g. 'superseded by the next version, plus 2 years'.",
  },
  indefinite: { label: "Indefinitely", description: "Only with a written rationale (Procedure A.2)." },
};

export const REGENERABLE_OPTIONS: Record<string, Option> = {
  impossible: {
    label: "No — cannot be regenerated",
    description: "Observations, external inputs that have changed, or lost configuration. The archive earns its keep.",
  },
  expensive: {
    label: "Yes, but at high cost",
    description: "e.g. months of HPC time. Archiving can still be justified.",
  },
  cheap: {
    label: "Yes, cheaply",
    description: "The archive is probably not the right home: keep the code and configuration and regenerate on demand.",
  },
};

export const USER_OPTIONS: Record<string, Option> = {
  dmi_staff: { label: "DMI scientists, forecasters and operational staff" },
  wmo_nmhs: { label: "Other WMO member meteorological and hydrological services" },
  copernicus: { label: "Copernicus Services and their users" },
  danish_researchers: { label: "Danish climate, atmospheric, ocean and cryosphere researchers" },
  public: { label: "The Danish public (open data)" },
};

export const PRODUCT_TYPE_OPTIONS: Record<string, Option> = {
  "final product": { label: "final product", description: "Released or delivered to users." },
  "original output": { label: "original output", description: "Model or instrument output as written, before post-processing." },
  "raw output": { label: "raw output", description: "Unprocessed bulk output, e.g. run tarballs." },
  "intermediate file": {
    label: "intermediate file",
    description: "Temporary or reproducible step — filter out before archiving (REQ-ARC-005).",
  },
  "production file": { label: "production file", description: "Inputs or auxiliary files needed to produce or interpret the data." },
  "project file": { label: "project file", description: "Project-specific derivative." },
  "project archive": { label: "project archive", description: "Packed copy of project data, e.g. a squashfs image." },
  "restart file": { label: "restart file", description: "Model state for restarting or extending runs." },
  diagnostic: { label: "diagnostic", description: "Logs, diagnostics and quality-control output." },
};

export const PRODUCT_CATEGORIES = [
  "Physics",
  "Biogeochemistry",
  "Ice",
  "Observations",
  "Assimilation",
  "Waves",
  "Atmospheric",
  "DECK",
  "CMIP",
  "ScenarioMIP",
  "DCPP",
];

/** A "Learn more" block: short paragraphs and bullet lists. */
export interface Guidance {
  intro?: string;
  points: string[];
  source: string;
}

export interface SectionInfo {
  /** Card id (also the key used for open/closed state). */
  key: string;
  title: string;
  /** Schema property names rendered in this card, in order. */
  fields: string[];
  /** One-line purpose shown in the card header. */
  summary: string;
  /** Statuses for which (parts of) this card are mandatory. Empty = always optional. */
  requiredFor: Status[] | "always";
  guidance?: Guidance;
}

export const SECTIONS: SectionInfo[] = [
  {
    key: "dataset",
    title: "Dataset",
    fields: ["dataset"],
    summary: "What the dataset is and where its authoritative copy lives.",
    requiredFor: "always",
    guidance: {
      intro:
        "Write for a stranger: a colleague starting in three years who knows the science but not your project, " +
        "and who must decide in ten minutes whether to recall this dataset from tape.",
      points: [
        "Keep the description short but complete. Long prose here is a sign the metadata page is missing (Guidelines §10).",
        "Authoritative copies live in project space, the archive or a database — never only on scratch (REQ-TIER-001).",
        "/net/isilon is legacy storage and is not used for new data (REQ-TIER-002).",
        "Changes to location, format, retention or ownership are reflected here within 10 working days (REQ-CAT-005).",
      ],
      source: "Standard §4–5, Guidelines §8 and §10",
    },
  },
  {
    key: "roles",
    title: "Roles",
    fields: ["roles"],
    summary: "Who decides, who describes, who keeps it safe.",
    requiredFor: ["active", "archived", "deprecated"],
    guidance: {
      intro: "When in doubt, ask: whose problem is this if it goes wrong?",
      points: [
        "Data Owner — usually a project lead, research group head or product owner. Owns the decisions (purpose, retention, sharing), not the files.",
        "Data Steward — usually a senior researcher or dataset maintainer. Owns the description and quality, not the hardware.",
        "Data Custodian — usually someone in IT or HPC. Owns the infrastructure, permissions and integrity, not the science.",
        "One person may wear all three hats for a small dataset — tick the box and record each decision. No role may be left empty: an orphaned dataset is a problem the moment its caretaker leaves.",
        "Every procedure assumes the three roles are named. If they are not, stop and assign them first.",
      ],
      source: "Standard §3, Procedures §1, Guidelines §11",
    },
  },
  {
    key: "decisions",
    title: "Retention & licence",
    fields: ["retention", "license"],
    summary: "How long it is kept and what others may do with it — the Owner's decisions.",
    requiredFor: ["active", "archived", "deprecated"],
    guidance: {
      intro: "Retention is a story, not a number: 'We keep X until Y because Z' beats '5 years'.",
      points: [
        "Ask: if this disappeared tomorrow, what would it cost DMI? Nothing → no retention. A week of work → probably no tape. A publication, product or regulatory gap → full archive treatment.",
        "Rules of thumb: operational output for verification — years, not forever. Climate reanalyses and long baselines — decades or indefinite. One-off experiments — often zero (keep code and configuration). Data under agreements or law — what they say, plus a margin.",
        "Rigsarkivet may decide for you: records under its bevarings- og kassationsbestemmelser follow those rules, and data of lasting value may not be destroyed without its authorisation. Flag such data early.",
        "Pick a licence early — retrofitting licences is hard. When in doubt, CC-BY 4.0. FAIR does not mean open: as open as possible, as closed as necessary.",
      ],
      source: "Standard §6.8 and §4.4, Guidelines §2, §4 and §8.2",
    },
  },
  {
    key: "references",
    title: "Identifiers, links & dates",
    fields: ["identifiers", "links", "dates"],
    summary: "How the dataset is found and cited, and where its documentation lives.",
    requiredFor: ["active", "archived", "deprecated"],
    guidance: {
      intro:
        "Not known yet? Record 'TBD by YYYY-MM-DD' (Procedure A.5) — in the form, the 'Not known yet' switch does this. CI lists open placeholders and flags overdue ones; all must be resolved before archiving.",
      points: [
        "Every entry carries a local persistent identifier (REQ-CAT-008). Published or externally cited datasets also get a DOI via DataCite (REQ-CAT-009) — the DMI DataCite arrangement is being set up; ask the Data Custodian.",
        "Link, don't duplicate: the metadata page explains what the dataset is, how it was produced, what the variables mean and its known limitations.",
        "The archiving guide records the preparation decisions (Procedure B.0–B.7) so the next person does not have to ask.",
        "Review the entry at least yearly and record the date (REQ-CAT-006).",
      ],
      source: "Standard §4.2–4.4, Procedures A.4–A.6, Guidelines §8",
    },
  },
  {
    key: "storage",
    title: "Storage",
    fields: ["storage"],
    summary: "Tier, archive folder, format and compression.",
    requiredFor: ["archived"],
    guidance: {
      points: [
        "Archive folders follow the WIS2 level-8 disciplines: atmospheric-composition, climate, cryosphere, hydrology, ocean, space-weather, weather. One discipline per folder (REQ-NAME-004/005).",
        "Formats: open and documented — netCDF, GRIB, Zarr, or squashfs containing those (REQ-FMT-001).",
        "Compression: default to lossless. netCDF — zstandard, or zlib level 1. squashfs — zstd (-b 1M); xz may win for few, large GRIB files. Never rely on a tool's gzip default (REQ-CMP-001–003).",
        "Lossy compression or bit-rounding only with the Owner's explicit approval and documented settings (REQ-FMT-003).",
        "Archive files are 5 GiB–5 TiB, preferably 10 GiB–2 TiB: smaller files make tape spend its time positioning, larger ones block recalls (REQ-SIZE-001/002).",
        "Names use letters, digits and underscores; dates in ISO 8601; periods as start--end (REQ-NAME-001–003).",
      ],
      source: "Standard §5–6, Guidelines §3 and §5–7",
    },
  },
  {
    key: "appraisal",
    title: "Appraisal",
    fields: ["appraisal"],
    summary: "Does this belong in the archive at all? Decide before preparing it.",
    requiredFor: ["archived"],
    guidance: {
      intro:
        "Appraisal answers 'at all?'; retention answers 'how long?'. The worst datasets on tape are the ones nobody appraised.",
      points: [
        "Why does it matter? In one or two sentences, what would be lost if it disappeared.",
        "Who will use it? Name the part of the Designated Community. 'Someone, eventually' is not an answer.",
        "Could we regenerate it? If cheaply, keep the code and configuration instead.",
        "Are we required to keep it? Arkivloven, GDPR, contracts or regulation can force the answer — check first.",
        "The Steward writes the appraisal; the Owner approves it before archiving proceeds (REQ-APP-001–003).",
      ],
      source: "Standard §6.1, Procedure B.0, Guidelines §4.1",
    },
  },
  {
    key: "archiving",
    title: "Archiving process",
    fields: ["archiving"],
    summary: "Quality check, aggregation and automation.",
    requiredFor: ["archived"],
    guidance: {
      points: [
        "Before archiving: decide scope (only data of lasting relevance), verify quality, decide filtering, aggregation period, tooling and compression — and record them in the archiving guide (Procedure B).",
        "Clean the source first, then pick an aggregation window (daily, monthly, yearly) that lands files in the target size. If that fails, split by domain or variable group instead of time.",
        "Scheduled production data is archived automatically with the DMI archive tool (gitlab.dmi.dk/hpc/dmi-data-archive) — don't build your own. Keep raw source on disk for at least one aggregation period, and alert on empty output or oversized files (Procedure D).",
        "Custodian steps not recorded here: write-protection applied and tested (REQ-PRT-001), checksums stored (C.5), source copy removed only after all checks pass (C.8).",
      ],
      source: "Standard §6–7, Procedures B–D, Guidelines §6 and §9",
    },
  },
  {
    key: "deletion",
    title: "Deletion record",
    fields: ["deletion"],
    summary: "Deletion is a decision, not a command.",
    requiredFor: ["deleted"],
    guidance: {
      points: [
        "Confirm the retention has expired, or that the Owner has asked to shorten it.",
        "The Owner approves in writing (ticket, e-mail or note); the Custodian deletes. Without approval, nothing is deleted (REQ-RET-002).",
        "Data of lasting value may only be destroyed with Rigsarkivet's prior authorisation (REQ-RIG-002).",
        "Mark the entry deleted with date and approver — never remove it (REQ-CAT-007).",
      ],
      source: "Standard §6.8 and §10.1, Procedure G",
    },
  },
  {
    key: "products",
    title: "Products",
    fields: ["products"],
    summary: "The sub-directories that make up the dataset, for the scanner and the catalogue.",
    requiredFor: "always",
    guidance: {
      points: [
        "Each product is a sub-directory of the dataset path (dir), or a family of directories matched by a shell glob (dir_pattern).",
        "Archive only data of lasting relevance: intermediate, temporary and cheaply reproducible outputs are filtered out first (REQ-ARC-005).",
        "Directory and file names should be informative on their own: type, period, domain, version (REQ-FND-002).",
        "Sizes, file counts, formats and variables are collected by the scanner — no need to type them in.",
      ],
      source: "Standard §6.2 and §6.9",
    },
  },
  {
    key: "other",
    title: "Notes & exceptions",
    fields: ["designated_community_notes", "exceptions"],
    summary: "Anything a future user needs to know, and registered deviations.",
    requiredFor: [],
    guidance: {
      points: [
        "The Designated Community is DMI staff, WMO members, Copernicus and its users, Danish researchers and the Danish public. Note anything they would need to interpret the data.",
        "A deviation from a SHALL requirement needs a registered exception: owner, reason, compensating control and an expiry at most 12 months ahead, approved by the Steering Group. An undocumented deviation is a finding.",
        "Legacy datasets that are in use but cannot be re-archived yet are accepted under a time-limited exception (Policy §7).",
      ],
      source: "Standard §9–10, Policy §6.2 and §7",
    },
  },
  {
    key: "stac",
    title: "STAC metadata",
    fields: ["stac"],
    summary: "Optional extras for the generated STAC catalogue.",
    requiredFor: [],
  },
];

/** Keys of top-level schema objects rendered as card sections. */
export const SECTION_OBJECT_KEYS = new Set([
  "dataset",
  "roles",
  "retention",
  "license",
  "identifiers",
  "links",
  "dates",
  "storage",
  "appraisal",
  "archiving",
  "deletion",
  "stac",
]);

/** Sub-headings used when a card holds more than one schema object. */
export const SUBSECTION_TITLES: Record<string, string> = {
  retention: "Retention",
  license: "Licence",
  identifiers: "Persistent identifiers",
  links: "Supporting pages",
  dates: "Dates",
  designated_community_notes: "",
  exceptions: "",
};
