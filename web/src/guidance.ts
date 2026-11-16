/**
 * Help texts for the editor, condensed from a Storage and Archiving document set (Policy, Standard,
 * Procedures and Guidelines v1.0). References such as REQ-CAT-004 or Policy §7 point into that set.
 */

import { OWNERS } from "./owners";

export type Status = "proposed" | "active" | "deprecated" | "deleted";

export const STATUSES: Status[] = ["proposed", "active", "deprecated", "deleted"];

/** The status to work with: an unknown value (e.g. typed in the YAML) counts as proposed; the schema still flags it. */
export const statusOf = (value: unknown): Status => (STATUSES.includes(value as Status) ? (value as Status) : "proposed");

/** Statuses for which the dataset counts as registered in the catalogue. */
export const REGISTERED: Status[] = ["active", "deprecated"];

type Data = Record<string, any>;

/**
 * The dataset is on tape (in the archive): dataset.on_tape. Read with the status: while proposed it will go to tape,
 * while active or deprecated it is there, and once deleted it was.
 */
export const inArchive = (data: Data | undefined): boolean => data?.dataset?.on_tape === true;

/**
 * The archive requirements apply: the dataset is on tape, and the entry is registered (active or deprecated).
 * A proposed entry may already plan for tape without them.
 */
export const archiveRulesApply = (data: Data | undefined): boolean =>
  inArchive(data) && REGISTERED.includes(statusOf(data?.status));

/** The status as shown, with tape: "Active, on tape"; while proposed it is still a plan. */
export const stageLabel = (data: Data | undefined): string => {
  const status = statusOf(data?.status);
  return STATUS_INFO[status].label + (inArchive(data) ? `, ${tapeLabels(status).short}` : "");
};

/** The tape switch reads with the lifecycle: the data will go to, is on, or was on tape. */
export function tapeLabels(status: Status): { label: string; short: string; help: string } {
  switch (status) {
    case "proposed":
      return {
        label: "Will go to tape",
        short: "for tape",
        help: "Tick if the dataset is to be archived to tape. Once it is active, the archiving fields become mandatory.",
      };
    case "deleted":
      return { label: "Was on tape", short: "was on tape", help: "Tick if the data was on tape before it was deleted." };
    default:
      return {
        label: "On tape",
        short: "on tape",
        help: "Tick if the dataset is in the archive (on tape). The appraisal, storage and archiving fields are then mandatory.",
      };
  }
}

/** Labels of the two dataset locations: while proposed, the path is where the dataset will go. */
export function locationLabels(status: Status): { path: string; pathHelp: string; legacy: string; legacyHelp: string } {
  const forms =
    "The directory as an absolute path without a trailing slash (/data/projects/my_dataset), host:/path on another server, " +
    "or a URL (scheme://…) for a database or third-party store.";
  return status === "proposed"
    ? {
        path: "Location (proposed path)",
        pathHelp:
          `Where the dataset will live once registered (REQ-CAT-004): never legacy storage, which data is to leave (Policy §7). ` +
          `Not decided yet? Leave it empty and fill in the existing location; it is needed to register. ${forms}`,
        legacy: "Existing location",
        legacyHelp:
          "Where the data is now, if it is to move (e.g. out of a legacy area) or where it goes is not decided yet. Leave empty if it stays where it is.",
      }
    : {
        path: "Location (primary path)",
        pathHelp: `Where the authoritative copy lives (REQ-CAT-004). ${forms}`,
        legacy: "Legacy location",
        legacyHelp: "Where the data was before it moved to the primary path, so the trail from old to new path stays visible (Guidelines §9.3).",
      };
}

/**
 * For someone with a pile of data and no idea where to begin: the order to work in, from the Policy, Standard,
 * Procedures and Guidelines (none of which has such a list). Shown on the About page and in the AI prompt.
 */
export const GETTING_STARTED: { intro: string; steps: { title: string; text: string; ref: string }[]; outro: string } = {
  intro:
    "A lot of data and no idea where to begin? Work through it in this order. The first steps need no form at all: " +
    "the cheapest time to decide whether something is worth keeping is before you catalogue or move it.",
  steps: [
    {
      title: "Take stock of what you have",
      text:
        "List the directories you created or look after: in project space, on scratch, in old legacy areas " +
        "and on other servers. For each, note what it is, who made it and whether " +
        "anyone still uses it. The Data Custodians are sorting every existing storage area into keep, move or delete, and " +
        "this list is what they need from you.",
      ref: "Policy §7.1",
    },
    {
      title: "Clear out what is no longer needed",
      text:
        "Ask of each: if this disappeared tomorrow, what would it cost us? Nothing: it can go. A week of work: keep it " +
        "on disk while it is used; it probably does not need tape. A publication, a product or a legal or contractual " +
        "duty: catalogue it and plan to archive it. Scratch copies, logs, failed and test runs, duplicates and " +
        "intermediate files go first, and so does output that can be regenerated cheaply from code and configuration " +
        "you keep. What you clear now is not catalogued, moved and stored later.",
      ref: "Guidelines §2.1, §4.1; Procedures B.2, C.2",
    },
    {
      title: "Ask before deleting what others rely on",
      text:
        "Your own temporary files are yours to remove. Data that is catalogued, shared or used by others is deleted " +
        "only with the Data Owner's written approval, and its entry stays, marked Deleted. Destroying data of lasting " +
        "value may also need the national archives' authorisation first.",
      ref: "Procedure G, REQ-RET-002, REQ-CAT-007, REQ-RIG-002",
    },
    {
      title: "Decide which datasets need an entry",
      text:
        "Every dataset that outlives a short-lived project is catalogued; scratch and temporary work are not. A " +
        "dataset is a collection with one purpose, one Owner and one retention: the directories inside it are its " +
        "parts, not entries of their own, and data spanning two WIS2 disciplines is split into two entries. Data " +
        "nobody claims is a candidate for deletion: an entry proposing it, for the Owner to sign off, is how that is " +
        "decided.",
      ref: "REQ-CAT-001, Standard §2, REQ-NAME-005, Policy §7.2, Guidelines §9.3",
    },
    {
      title: "Name the three roles",
      text:
        "The Owner decides what the data is for, who may use it and how long it is kept (usually a project lead, " +
        "group head or product owner); the Steward keeps the entry right; the Custodian runs the storage (a team is " +
        "fine). One person may hold all three for a small dataset. Every procedure assumes they are named: if they " +
        "are not, settle that first.",
      ref: "Policy §4.6, Procedures §1, Guidelines §11",
    },
    {
      title: "Start with one entry",
      text:
        "Pick the dataset you know best, or the one whose value is clearest. Choose New, fill in the title, location, " +
        "description and parts, and keep it Proposed: what is not known yet can wait. For data in a legacy area, the " +
        "current path is its existing location, and the proposed path is where it is to go, left empty until that is " +
        "decided. Or let an AI assistant " +
        "interview you (AI prompt), with a README or a directory listing to hand.",
      ref: "Procedure A.5, Policy §7",
    },
    {
      title: "Agree retention and licence, then register",
      text:
        "Decide with the Owner how long it is kept and why (“we keep X until Y because Z” beats “5 years”), and " +
        "the licence. Then make the entry Active and submit it in a merge request for the Owner to approve. Data is " +
        "moved to the archive only after that.",
      ref: "Guidelines §4.2, Procedure A, REQ-CAT-002",
    },
  ],
  outro:
    "Many datasets? One at a time, starting with what is at risk: an only copy on scratch, which is cleaned " +
    "without notice, or data in a legacy area that nobody has claimed.",
};

export const STATUS_INFO: Record<Status, { label: string; short: string; detail: string }> = {
  proposed: {
    label: "Proposed",
    short: "not yet registered",
    detail:
      "Draft entry: the dataset is planned, or is legacy data under triage. Only the dataset basics and parts are mandatory, " +
      "plus what a choice already made needs (e.g. the date for retention until a date). The location is the proposed path; " +
      "where the data is now goes under Existing location, which is enough until the proposed path is decided. " +
      "To register it, name the three roles, decide retention and licence, and add the identifiers, links and release date.",
  },
  active: {
    label: "Active",
    short: "registered",
    detail:
      "Registered. Every catalogue field in Standard §4.2 is mandatory. Facts and links not known yet may be " +
      "written as 'TBD by YYYY-MM-DD' (Procedure A.5); roles, retention and licence are decisions and must be made. " +
      "Once it is on tape, it also needs an Owner-approved appraisal, " +
      "WIS2 discipline, format, compression, quality check and archiving date, and no 'TBD' may remain (REQ-ARC-001).",
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
  [
    "Always",
    "Catalogue ID, status, dataset title and description, location (while proposed or deleted, the existing location " +
      "will do), at least one part",
  ],
  [
    "Active, Deprecated",
    "Location; Owner, Steward and Custodian (name + e-mail); retention; licence; local PID; metadata page; archiving guide; release date. " +
      "Facts and links may be 'TBD by YYYY-MM-DD' until known.",
  ],
  [
    "Active or Deprecated, on tape",
    "Appraisal approved by the Owner; WIS2 discipline; file formats; compression; quality check date; archiving date. No TBD placeholders.",
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
    description: "No attribution required. Use sparingly when you want to be credited.",
  },
  "WMO-UDP-core": {
    label: "WMO Unified Data Policy — core",
    description: "Data exchanged under the WMO framework as core data.",
  },
  "WMO-UDP-recommended": {
    label: "WMO Unified Data Policy — recommended",
    description: "Data exchanged under the WMO framework as recommended data.",
  },
  internal: {
    label: "Internal use only",
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
    label: "Archive (on tape)",
    description: "Tape-backed, write-protected long-term preservation of data with lasting value.",
  },
  database: {
    label: "Database storage",
    description: "Structured data served through databases. Same catalogue requirements apply.",
  },
  third_party: {
    label: "Third party / supplier",
    description: "Hosted by a supplier under a written agreement that must be linked (REQ-TPY-001–003).",
  },
  legacy: {
    label: "Legacy storage",
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

/** File formats (storage.formats); the archive takes only open, documented ones (REQ-FMT-001). */
export const FORMAT_OPTIONS: Record<string, Option> = {
  netCDF: { label: "netCDF", description: "netCDF classic or netCDF-4. Name the conventions (CF, GHRSST) in the details." },
  GRIB: { label: "GRIB", description: "GRIB edition 1 or 2. Give the edition in the details." },
  BUFR: { label: "BUFR", description: "WMO BUFR, e.g. observations." },
  Zarr: { label: "Zarr", description: "Zarr stores (directories or zipped)." },
  HDF5: { label: "HDF5", description: "HDF5 that is not netCDF-4." },
  GeoTIFF: { label: "GeoTIFF", description: "GeoTIFF and Cloud-Optimised GeoTIFF rasters." },
  Parquet: { label: "Parquet", description: "Apache Parquet tables." },
  CSV: { label: "CSV", description: "CSV and other delimited text tables." },
  text: { label: "Text", description: "Plain text and ASCII: logs, namelists, READMEs, ASCII model output." },
  shapefile: { label: "Shapefile", description: "Esri shapefiles." },
  image: { label: "Images", description: "PNG, JPEG and other images, e.g. plots." },
  scripts: { label: "Scripts and code", description: "Scripts and source code, e.g. sh, py, F90." },
  binary: {
    label: "Model-specific binary",
    description: "e.g. HYCOM .a/.b or Fortran unformatted files. Only in the archive if documented well enough to read back (REQ-FMT-001).",
  },
  other: { label: "Other", description: "Name it in the details, and check it is open and documented (REQ-FMT-001)." },
};

/** Containers that pack files together (storage.containers). */
export const CONTAINER_OPTIONS: Record<string, Option> = {
  squashfs: {
    label: "squashfs",
    description: "Compressed read-only image (.sqfs); the container for mixed file types and kept structure (REQ-CMP-002).",
  },
  tar: { label: "tar", description: "tar archives, including .tar.gz / .tgz (give gzip under compression)." },
  zip: { label: "zip", description: "zip archives." },
};

/** Compression algorithms (storage.compression), inside files or containers (REQ-CMP-001–003). */
export const COMPRESSION_OPTIONS: Record<string, Option> = {
  none: { label: "None", description: "Uncompressed." },
  zstd: { label: "zstd", description: "Zstandard. The default for squashfs, and for netCDF where supported (REQ-CMP-001)." },
  xz: { label: "xz", description: "xz / LZMA. Can win on few large files, e.g. GRIB archives (REQ-CMP-003)." },
  zlib: { label: "zlib", description: "Deflate inside netCDF-4 or HDF5, e.g. level 1." },
  gzip: { label: "gzip", description: "gzip files (.gz, .tgz). Avoid when a better algorithm is available (REQ-CMP-001)." },
  ccsds: { label: "CCSDS (GRIB2)", description: "Lossless CCSDS/AEC packing inside GRIB2 (packingType grid_ccsds)." },
  other: { label: "Other", description: "Name it in the compression settings." },
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

/** DataCite relation types (this dataset → the related DOI) that fit most datasets. */
export const RELATION_OPTIONS: Record<string, Option> = {
  IsSourceOf: {
    label: "Was used to make it",
    description: "The DOI is a product made from this data, e.g. a Copernicus Marine product published from these model runs.",
  },
  IsVariantFormOf: {
    label: "Same data in another form",
    description: "The DOI is the same data published elsewhere or in another format.",
  },
  IsDescribedBy: {
    label: "Is described by it",
    description: "The DOI is a paper or report describing this dataset or how it was produced.",
  },
  IsDerivedFrom: {
    label: "Was made from it",
    description: "The DOI is input data this dataset was made from, e.g. forcing or observations.",
  },
  IsCitedBy: { label: "Is cited by it", description: "The DOI is a publication that uses this data." },
};

export const USER_OPTIONS: Record<string, Option> = {
  staff: { label: "Our own scientists, forecasters and operational staff" },
  wmo_nmhs: { label: "Other WMO member meteorological and hydrological services" },
  copernicus: { label: "Copernicus Services and their users" },
  national_researchers: { label: "National climate, atmospheric, ocean and cryosphere researchers" },
  public: { label: "The public (open data)" },
};

export const PART_TYPE_OPTIONS: Record<string, Option> = {
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

export const PART_CATEGORIES = [
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
  /**
   * Statuses for which (parts of) this card are mandatory. Empty = always optional. "archive" = once an active or
   * deprecated dataset is on tape.
   */
  requiredFor: Status[] | "always" | "archive";
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
        "While the entry is proposed, the location is the proposed path: where the dataset will live once registered. If the data is somewhere else now, give that as the existing location: while where it goes is not decided, that alone will do. Once registered it is kept as the legacy location, so the trail from old to new path stays visible (Guidelines §9.3).",
        "A location is a directory: an absolute path such as /data/projects/my_dataset, without a trailing slash, host:/path on another server, or a URL.",
        "Tick the tape switch if the data will go to, is on, or was on tape (it reads with the status). Once the entry is active and on tape, the appraisal, storage and archiving fields become mandatory.",
        "Legacy storage is not used for new data (REQ-TIER-002).",
        "Changes to location, format, retention or ownership are reflected here within 10 working days (REQ-CAT-005).",
      ],
      source: "Standard §4–5, Guidelines §8–10",
    },
  },
  {
    key: "parts",
    title: "Parts",
    fields: ["parts"],
    summary: "The directories, files or families of directories that make up the dataset.",
    requiredFor: "always",
    guidance: {
      points: [
        "Each part is a sub-directory or file of the dataset path (dir), or a family of directories matched by a shell glob (dir_pattern).",
        "Archive only data of lasting relevance: intermediate, temporary and cheaply reproducible outputs are filtered out first (REQ-ARC-005).",
        "Directory and file names should be informative on their own: type, period, domain, version (REQ-FND-002).",
      ],
      source: "Standard §6.2 and §6.9",
    },
  },
  {
    key: "roles",
    title: "Roles",
    fields: ["roles"],
    summary: "Who decides, who describes, who keeps it safe.",
    requiredFor: ["active", "deprecated"],
    guidance: {
      intro: "When in doubt, ask: whose problem is this if it goes wrong?",
      points: [
        "Data Owner — usually a project lead, research group head or product owner. Owns the decisions (purpose, retention, sharing), not the files.",
        "Data Steward — usually a senior researcher or dataset maintainer. Owns the description and quality, not the hardware.",
        "Data Custodian — usually someone in IT or HPC. Owns the infrastructure, permissions and integrity, not the science.",
        "One person may wear all three hats for a small dataset — tick the box and record each decision. No role may be left empty: an orphaned dataset is a problem the moment its caretaker leaves.",
        "Every procedure assumes the three roles are named. If they are not, stop and assign them first.",
        ...(OWNERS.length
          ? ["The Data Owner is chosen from the approved Data Owners (registry/owners.yaml). If the right person is missing, ask for them to be added."]
          : []),
      ],
      source: "Standard §3, Procedures §1, Guidelines §11",
    },
  },
  {
    key: "decisions",
    title: "Retention & licence",
    fields: ["retention", "license"],
    summary: "How long it is kept and what others may do with it — the Owner's decisions.",
    requiredFor: ["active", "deprecated"],
    guidance: {
      intro: "Retention is a story, not a number: 'We keep X until Y because Z' beats '5 years'.",
      points: [
        "Ask: if this disappeared tomorrow, what would it cost us? Nothing → no retention. A week of work → probably no tape. A publication, product or regulatory gap → full archive treatment.",
        "Rules of thumb: operational output for verification — years, not forever. Climate reanalyses and long baselines — decades or indefinite. One-off experiments — often zero (keep code and configuration). Data under agreements or law — what they say, plus a margin.",
        "The national archives may decide for you: records under their retention and disposal rules follow those rules, and data of lasting value may not be destroyed without their authorisation. Flag such data early.",
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
    requiredFor: ["active", "deprecated"],
    guidance: {
      intro:
        "Not known yet? Record 'TBD by YYYY-MM-DD' (Procedure A.5) — in the form, the 'Not known yet' switch does this. CI lists open placeholders and flags overdue ones; all must be resolved before the data is archived to tape.",
      points: [
        "Every entry carries a local persistent identifier (REQ-CAT-008). Published or externally cited datasets also get a DOI via DataCite (REQ-CAT-009) — ask the Data Custodian how your organisation registers them.",
        "The DOI field holds only this dataset's own DOI. DOIs of other things — a Copernicus Marine product published from this data, a paper describing it, its input data — go under Related DOIs, with what each one is.",
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
    requiredFor: "archive",
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
    requiredFor: "archive",
    guidance: {
      intro:
        "Appraisal answers 'at all?'; retention answers 'how long?'. The worst datasets on tape are the ones nobody appraised.",
      points: [
        "Why does it matter? In one or two sentences, what would be lost if it disappeared.",
        "Who will use it? Name the part of the Designated Community. 'Someone, eventually' is not an answer.",
        "Could we regenerate it? If cheaply, keep the code and configuration instead.",
        "Are we required to keep it? Archive law, GDPR, contracts or regulation can force the answer — check first.",
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
    requiredFor: "archive",
    guidance: {
      points: [
        "Before archiving: decide scope (only data of lasting relevance), verify quality, decide filtering, aggregation period, tooling and compression — and record them in the archiving guide (Procedure B).",
        "Clean the source first, then pick an aggregation window (daily, monthly, yearly) that lands files in the target size. If that fails, split by domain or variable group instead of time.",
        "Scheduled production data is archived automatically with the organisation's archive tool — don't build your own. Keep raw source on disk for at least one aggregation period, and alert on empty output or oversized files (Procedure D).",
        "Custodian steps not recorded here: write-protection applied and tested (REQ-PRT-001), source copy removed only after all checks pass (C.8). Where the checksums are kept (C.5) is recorded under Storage.",
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
        "Data of lasting value may only be destroyed with the national archives' prior authorisation where the law requires it (REQ-RIG-002).",
        "Mark the entry deleted with date and approver — never remove it (REQ-CAT-007).",
      ],
      source: "Standard §6.8 and §10.1, Procedure G",
    },
  },
  {
    key: "other",
    title: "Notes, exceptions & other information",
    fields: ["designated_community_notes", "exceptions", "extensions"],
    summary: "Anything a future user needs to know, registered deviations, and information with no field of its own.",
    requiredFor: [],
    guidance: {
      points: [
        "The Designated Community is who the data is kept for: e.g. your own staff, WMO members, Copernicus and its users, national researchers and the public. Note anything they would need to interpret the data.",
        "A deviation from a SHALL requirement needs a registered exception: owner, reason, compensating control and an expiry at most 12 months ahead, approved by the Steering Group. An undocumented deviation is a finding.",
        "Legacy datasets that are in use but cannot be re-archived yet are accepted under a time-limited exception (Policy §7).",
        "Other information: anything worth keeping that has no field of its own — add a key and a value. It is stored in the manifest but not checked.",
      ],
      source: "Standard §9–10, Policy §6.2 and §7",
    },
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
  extensions: "",
};
