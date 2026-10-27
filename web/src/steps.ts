/**
 * What to do at each lifecycle stage, in order and by role, condensed from the DMI Storage and
 * Archiving Procedures (A–G), Standard and Guidelines v1.0. Steps whose result is recorded in the
 * manifest name those fields, so the panel can tick them off and jump to them. Commands are filled
 * in from the manifest; anything not in the DMI documents is marked as a tip.
 */

import { asText, checklist, has, isMapping, isTbd, type Manifest } from "./compliance";
import { STATUSES, WIS2_OPTIONS, statusOf, type Status } from "./guidance";
import { pathParts } from "./navigation";

export type Role = "Owner" | "Steward" | "Custodian";

export interface Command {
  label?: string;
  code: string;
}

export interface Step {
  title: string;
  who?: Role[];
  text?: string;
  /** Set when the step is practical advice that the DMI documents do not give. */
  tip?: string;
  commands?: Command[];
  /** Where the step comes from. */
  ref: string;
  link?: { href: string; label: string };
  /** Manifest fields that record the step; it counts as done when all are filled and valid. */
  fields?: string[];
  /** Sections or fields beyond `fields` that must be valid too, e.g. the retention date that goes with its kind. */
  covers?: string[];
  /** The field to fill in next, while something beyond `fields` is still missing. */
  next?: (data: Manifest) => string | undefined;
}

/** A validation error; rjsf names its field ".retention.until". */
export type FieldError = { property?: string };

export interface Stage {
  key: string;
  title: string;
  intro?: string;
  steps: Step[];
  /** A preview of a later stage, shown collapsed. */
  later?: boolean;
}

const ARCHIVE = "/dmidata/archive/";
export const ARCHIVE_TOOL = "https://gitlab.dmi.dk/hpc/dmi-data-archive";
export const CONFLUENCE_PROCESS = "https://confluence.dmi.dk/pages/viewpage.action?pageId=247772730";
export const CONFLUENCE_FAQ = "https://confluence.dmi.dk/pages/viewpage.action?pageId=280937053";
export const CONFLUENCE_STORAGE = "https://confluence.dmi.dk/pages/viewpage.action?pageId=186692195";
export const CONFLUENCE_QMS_ARCHIVING = "https://confluence.dmi.dk/pages/viewpage.action?pageId=149489205";
const NOT_IN_DOCS = "Practical tip, not in the DMI Procedures.";
const TARBALL = "archive.tar.gz";

function valueAt(data: Manifest, path: string): unknown {
  let node: unknown = data;
  for (const part of pathParts(path)) node = isMapping(node) || Array.isArray(node) ? (node as Manifest)[part] : undefined;
  return node;
}

/** The errors in the step's fields and in what it covers, as paths ("retention.until"). */
function stepErrors(step: Step, errors: FieldError[]): string[] {
  const paths = [...(step.fields ?? []), ...(step.covers ?? [])];
  return errors
    .map((e) => pathParts(e.property ?? "").join("."))
    .filter((p) => paths.some((f) => p === f || p.startsWith(`${f}.`)));
}

/**
 * Every field the step records is filled and valid, and nothing else it needs is missing;
 * placeholders do not count once archived.
 */
export function stepDone(data: Manifest, step: Step, errors: FieldError[] = []): boolean {
  if (!step.fields?.length) return false;
  const archived = statusOf(data.status) === "archived";
  const filled = step.fields.every((f) => {
    const v = valueAt(data, f);
    return has(v) && !(archived && isTbd(v));
  });
  return filled && !stepErrors(step, errors).length && !step.next?.(data);
}

/** Where "Fill in" goes: the first empty field, else the first error, else what is still missing. */
export function stepTarget(data: Manifest, step: Step, errors: FieldError[] = []): string | undefined {
  const fields = step.fields ?? [];
  return fields.find((f) => !has(valueAt(data, f))) ?? stepErrors(step, errors)[0] ?? step.next?.(data) ?? fields[0];
}

/** Single-quoted for the shell, so spaces and $ in a path are taken literally. */
const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * Paths and names for the commands, from the manifest where it has them. A location under a
 * WIS2 discipline folder is the archive destination; anywhere else, the legacy
 * /dmidata/archive/arch1 included, it is the source to package.
 */
function packaging(data: Manifest) {
  const path = asText(data.dataset?.path).replace(/\/+$/, "");
  const discipline = asText(data.storage?.wis2_discipline);
  const inArchive = Object.keys(WIS2_OPTIONS).some((d) => path.startsWith(`${ARCHIVE}${d}/`));
  // REQ-NAME-001: letters, digits and underscores; REQ-NAME-003: a period as start--end
  const stem = (asText(data.id) || "dataset").replace(/[^A-Za-z0-9]+/g, "_");
  return {
    legacy: !inArchive && path.startsWith(ARCHIVE),
    source: !inArchive && path ? path : "/dmidata/projects/<project>/<source folder>",
    folder: inArchive ? path : `${ARCHIVE}${discipline || "<discipline>"}/<folder from the Custodian>`,
    image: `${stem}_<YYYY-MM-DD>--<YYYY-MM-DD>.sqfs`,
    unpacked: `/dmidata/scratch/<your folder>/${stem}_unpacked`,
  };
}

function registerStage(): Stage {
  return {
    key: "register",
    title: "Register the dataset (Procedure A)",
    intro: "Registration makes the dataset Active. It must happen before any data is moved to archive folders (REQ-CAT-002).",
    steps: [
      {
        title: "Check where it belongs",
        who: ["Steward"],
        text:
          "Kept only a few weeks: /dmidata/scratch, no entry needed. In active use: /dmidata/projects. Queried by applications: a database. " +
          "Otherwise: /dmidata/archive. Scratch is never the only copy, and /net/isilon takes no new data.",
        ref: "Guidelines §3, REQ-TIER-001/002",
        fields: ["storage.tier"],
      },
      {
        title: "Agree the three roles",
        who: ["Owner", "Steward", "Custodian"],
        text: "A named Owner, Steward and Custodian with reachable contacts. One person may hold all three — then say so.",
        ref: "Procedure A.1, Standard §3",
        fields: ["roles.owner", "roles.steward", "roles.custodian"],
        covers: ["roles"],
      },
      {
        title: "Decide purpose and retention",
        who: ["Owner"],
        text: "Until a date, a condition, or indefinitely with a written reason: 'We keep X until Y because Z'.",
        ref: "Procedure A.2, REQ-RET-001",
        fields: ["retention.kind"],
        covers: ["retention"],
      },
      {
        title: "Choose the licence",
        who: ["Owner"],
        text: "When in doubt, CC-BY 4.0. A restricted licence needs the reason and who decided it.",
        ref: "Procedure A.3, REQ-LIC-001/002",
        fields: ["license.id"],
        covers: ["license"],
      },
      {
        title: "Get a persistent identifier",
        who: ["Steward", "Custodian"],
        text:
          "Every entry gets a local PID; a dataset that will be published or cited also gets a DOI via DataCite. Both arrangements are " +
          "still being confirmed — ask the Data Custodian, and meanwhile switch on 'Not known yet' with the date by which it will be known.",
        ref: "Procedure A.4, REQ-CAT-008/009",
        fields: ["identifiers.pid"],
      },
      {
        title: "Write the metadata page and the archiving guide",
        who: ["Steward"],
        text:
          "Metadata page: what the dataset is, how it was produced (configuration, code version, processing), what the variables mean " +
          "(units, ranges, encoding) and its known limitations. The archiving guide follows once the archiving decisions are made; " +
          "until then switch on 'Not known yet'.",
        ref: "Procedure A.6, Guidelines §8, REQ-STW-001",
        fields: ["links.metadata", "links.archiving_guide"],
      },
      {
        title: "Fill in the remaining fields",
        who: ["Steward"],
        text: "Every field the Checklist marks as required for Active. Facts not known yet may be marked 'Not known yet'; decisions may not.",
        ref: "Procedure A.5, REQ-CAT-004",
        fields: ["dates.released"],
        next: (data) =>
          checklist({ ...data, status: "active" })
            .filter((g) => g.relation === "now")
            .flatMap((g) => g.items)
            .find((i) => i.state === "missing" && i.target)?.target,
      },
      {
        title: "Get the Owner's approval, then register",
        who: ["Owner"],
        text:
          "A short note or a ticket reference — no approval, not registered. Then set the status to Active and submit the manifest in a " +
          "merge request; CI validates it.",
        ref: "Procedure A.7",
      },
    ],
  };
}

function activeStage(data: Manifest): Stage {
  const automated = data.archiving?.automated === true;
  return {
    key: "active",
    title: "Keep the entry current",
    steps: [
      {
        title: "Record changes within 10 working days",
        who: ["Steward"],
        text: "A new location, format, retention or Owner goes into the catalogue within 10 working days; a move, the same day.",
        ref: "REQ-CAT-005, Guidelines §10",
      },
      {
        title: "Review the entry every year",
        who: ["Steward"],
        text: "Check it still describes the data and record the date.",
        ref: "REQ-CAT-006, REQ-STW-004",
        fields: ["dates.reviewed"],
      },
      {
        title: "Watch size and retention",
        who: ["Custodian"],
        text:
          "Project space has an owning project, a quota and a plan for the end of the dataset's life. The Custodian flags datasets that " +
          "drift from their declared size or retention.",
        ref: "Standard §5, REQ-CUS-003",
      },
      {
        title: automated ? "Scheduled production: archive it automatically" : "Scheduled production data",
        who: ["Steward"],
        text:
          "Production kept long-term is archived by the DMI archive tool, not a home-made script: set source, destination, aggregation " +
          "period, compression and schedule; keep the raw source on disk for at least one aggregation period; alert a named contact on " +
          "zero output, oversized files or repeated skips; review sizes, naming and retention yearly.",
        ref: "Procedure D, REQ-OPS-001–004",
        link: { href: ARCHIVE_TOOL, label: "dmi-data-archive" },
        fields: automated ? ["archiving.pipeline", "archiving.owning_team"] : undefined,
      },
    ],
  };
}

function prepareStage(later: boolean): Stage {
  return {
    key: "prepare",
    title: "Decide and prepare (Procedure B)",
    later,
    intro: "The Steward prepares, often with the Custodian; nothing is packaged before the Owner has approved the appraisal.",
    steps: [
      {
        title: "Appraise: is it worth keeping?",
        who: ["Steward", "Owner"],
        text:
          "Why it has lasting value, who will use it, whether it could be regenerated, and the proposed retention. The Owner approves " +
          "before preparation starts.",
        ref: "Procedure B.0, REQ-APP-001–004",
        fields: ["appraisal.lasting_value", "appraisal.users", "appraisal.regenerable", "appraisal.approved_by", "appraisal.approved_on"],
      },
      {
        title: "Complete the registration",
        who: ["Steward"],
        text: "Every catalogue field filled, PID and licence included. No 'TBD' may remain once archived.",
        ref: "Procedure B.1, REQ-ARC-001",
        fields: ["identifiers.pid", "license.id", "links.metadata", "dates.released"],
      },
      {
        title: "Leave out what need not be kept",
        who: ["Steward"],
        text: "Intermediate files, logs and anything cheaply reproducible stay out. Document what was removed.",
        ref: "Procedure B.2, B.4, REQ-ARC-005",
      },
      {
        title: "Check quality",
        who: ["Steward"],
        text: "Expected files present, none truncated, values in range, metadata accurate. Record the date.",
        ref: "Procedure B.3, REQ-STW-003, REQ-ARC-004",
        fields: ["archiving.quality_verified_on"],
      },
      {
        title: "Choose the aggregation",
        who: ["Steward"],
        text:
          "Every archive file must be 5 GiB–5 TiB, preferably 10 GiB–2 TiB: clean first, pick a time window, then the compression. " +
          "If sizes are still off, split by something other than time.",
        ref: "Procedure B.5, REQ-SIZE-001–003, Guidelines §6",
        fields: ["archiving.aggregation"],
      },
      {
        title: "Choose format and compression",
        who: ["Steward"],
        text:
          "netCDF or Zarr with their own compression for scientific arrays; squashfs for mixed files or to keep names and structure. " +
          "zstd by default; xz where it is clearly better, typically a few large files or GRIB. Set it explicitly, as mksquashfs " +
          "defaults to gzip. Try it on a sample before a large run. Lossy only with the Owner's approval.",
        ref: "Procedure B.6–B.7, REQ-CMP-001–003, Guidelines §7, archiving process",
        fields: ["storage.formats", "storage.compression"],
      },
      {
        title: "Write the decisions down",
        who: ["Steward"],
        text: "Scope, filtering, aggregation, format and compression on the archiving guide page. The next person should not have to ask.",
        ref: "Procedure B.8, REQ-STW-002, REQ-ARC-002",
        fields: ["links.archiving_guide"],
      },
    ],
  };
}

function folderStage(data: Manifest, later: boolean): Stage {
  return {
    key: "folder",
    title: "Get an archive folder (Procedure F)",
    later,
    steps: [
      {
        title: "Pick the WIS2 discipline",
        who: ["Steward"],
        text: "The top-level folder under /dmidata/archive. One discipline per folder.",
        ref: "Procedure F.1, REQ-NAME-004/005",
        fields: ["storage.wis2_discipline"],
      },
      {
        title: "Request the folder",
        who: ["Steward"],
        text:
          "Ask the Custodian, with a link to this entry" +
          (asText(data.id) ? ` (${asText(data.id)})` : "") +
          ", the path you want, the expected volume and file count, and who needs write access.",
        ref: "Procedure F.2, C.1",
      },
      {
        title: "Folder created",
        who: ["Custodian"],
        text: "The Custodian creates the folder, sets the quota and grants write access.",
        ref: "Procedure F.3, REQ-CUS-001",
      },
      {
        title: "Test it",
        who: ["Steward"],
        text: "Write a small test file, read it back, and after write-protection confirm that deleting it is refused.",
        ref: "Procedure F.4",
      },
    ],
  };
}

function writeStage(data: Manifest, later: boolean): Stage {
  const { legacy, source, folder, image, unpacked } = packaging(data);
  const target = `${folder}/${image}`;
  const squash = (from: string) => `mksquashfs ${sh(`${from}/`)} \\\n    ${sh(target)} \\\n    -comp zstd -b 1M -no-xattrs -noappend`;
  return {
    key: "write",
    title: "Package and write to the archive (Procedure C)",
    later,
    intro: data.archiving?.automated === true ? "This dataset is archived by an automated job; these are the manual steps." : undefined,
    steps: [
      {
        title: "Clean the source first",
        who: ["Steward"],
        text: "Remove intermediate and temporary files from the source folder itself, rather than filtering them out while packaging.",
        ref: "Procedure C.2, DMI archiving process (Confluence)",
        link: { href: CONFLUENCE_PROCESS, label: "Archiving process" },
      },
      {
        title: "Package a folder as squashfs",
        who: ["Steward"],
        text:
          "One image per aggregation period, written straight into the archive folder. Names use letters, digits and underscores, with " +
          "ISO 8601 dates and the period as start--end. mksquashfs uses every CPU: run one at a time per server, and on HPC batch " +
          "nodes add -mem to match the job's memory (e.g. -mem 20G)." +
          (legacy
            ? " The source is in the old archive and may already be on tape: for 1 TiB or more, or many thousands of files, ask " +
              "the Custodian before reading it (Procedure E.4)."
            : ""),
        commands: [
          { label: "zstd — the default, and best for many files", code: squash(source) },
          {
            label: "xz — may compress a few large files or GRIB better, but is slow to read when there are many files",
            code: `mksquashfs ${sh(`${source}/`)} \\\n    ${sh(target)} \\\n    -comp xz -b 1M -no-xattrs -noappend`,
          },
        ],
        ref: "Procedure C.3, Appendix A.1, REQ-NAME-001–003, archiving FAQ",
        link: { href: CONFLUENCE_FAQ, label: "Archiving FAQ" },
      },
      {
        title: "Starting from a .tar or .tar.gz file",
        who: ["Steward"],
        text:
          "Unpack it into a working folder on scratch with room for the unpacked data, check nothing is missing, then package that " +
          "folder as above. The image replaces the tar file, so record zstd (not gzip) as the compression. Where squashfs-tools-ng is " +
          "installed (newer servers only), tar2sqfs converts a tar file without unpacking it.",
        tip: `${NOT_IN_DOCS} tar2sqfs is from the Data Custodian's notes; the rest is standard tar usage.`,
        commands: [
          {
            label: "Unpack, compare the number of files, then package",
            code:
              `mkdir -p ${sh(unpacked)}\n` +
              `tar -xf ${sh(TARBALL)} -C ${sh(unpacked)}\n` +
              `tar -tvf ${sh(TARBALL)} | grep -c '^-'     # files in the tar file\n` +
              `find ${sh(unpacked)} -type f | wc -l     # files unpacked\n` +
              squash(unpacked),
          },
          {
            label: "Or convert without unpacking (tar2sqfs)",
            code:
              `tar2sqfs -f -c zstd -b 1M ${sh(target)} < ${sh("archive.tar")}\n` +
              `gzip -dc ${sh(TARBALL)} | tar2sqfs -f -c zstd -b 1M ${sh(target)}     # a .tar.gz`,
          },
        ],
        ref: "Procedure C.3, Data Custodian's archiving notes",
      },
      {
        title: "Or compress netCDF files themselves",
        who: ["Steward"],
        text: "For netCDF files written to the archive as they are, aggregated to the right size. Exact options depend on the dataset.",
        commands: [{ label: "zlib level 1 (or zstd with a netCDF build that supports it)", code: "nccopy -d 1 -s input.nc output.nc" }],
        ref: "Appendix A.2",
      },
      {
        title: "Check size, names and contents",
        who: ["Steward"],
        text:
          "Each file 5 GiB–5 TiB and named with ISO 8601 dates; the image is complete (a transfer that had not finished has produced " +
          "a broken image before); a random sample of files opens correctly. Mount the image with squashfuse on a server or laptop " +
          "that has it — not on the HPC.",
        tip: `${NOT_IN_DOCS} The file-count comparison is ours; the other commands are from the storage support page.`,
        commands: [
          {
            label: "Size, compression and number of files",
            code:
              `ls -lh ${sh(target)}\n` +
              `unsquashfs -s ${sh(target)}     # compression zstd, block size 1048576\n` +
              `find ${sh(`${source}/`)} -type f | wc -l     # files in the source …\n` +
              `unsquashfs -lls ${sh(target)} | grep -c '^-'     # … and in the image`,
          },
          {
            label: "Open a sample of files (mount on an empty folder)",
            code:
              `mkdir -p ~/sqfs-check\n` +
              `squashfuse ${sh(target)} ~/sqfs-check\n` +
              `ncdump -h ~/sqfs-check/path/to/a/file.nc\n` +
              `fusermount -u ~/sqfs-check     # or: umount ~/sqfs-check`,
          },
        ],
        ref: "Procedure C.4, REQ-SIZE-001, REQ-NAME-002, storage support page §4.6",
        link: { href: CONFLUENCE_STORAGE, label: "Storage support" },
      },
      {
        title: "Store checksums",
        who: ["Steward"],
        text:
          "A sha256 checksum per archive file, next to it or in the catalogue, so it can be re-verified on recall. Then say where they " +
          "are in this entry.",
        commands: [
          {
            code:
              `cd ${sh(folder)}\n` +
              `sha256sum ${sh(image)} >> sha256sums.txt\n` +
              `sha256sum -c sha256sums.txt     # verify, e.g. after a recall`,
          },
        ],
        ref: "Procedure C.5, REQ-PRT-003, QMS 4.4",
        link: { href: CONFLUENCE_QMS_ARCHIVING, label: "QMS 4.4" },
        fields: ["storage.checksums"],
      },
      {
        title: "Write-protect",
        who: ["Custodian", "Steward"],
        text: "The Custodian applies write-protection; the Steward confirms writing is refused and reading works.",
        ref: "Procedure C.6, REQ-PRT-001",
      },
      {
        title: "Update this entry",
        who: ["Steward"],
        text: "Archiving date, final location, formats, compression and its settings, and status Archived.",
        ref: "Procedure C.7, REQ-CAT-005",
        fields: ["dates.archived", "dataset.path", "storage.formats", "storage.compression", "storage.compression_settings"],
      },
      {
        title: "Remove the source copy — last",
        who: ["Custodian"],
        text:
          "Only after every check above has passed. A documented grace period on project space is fine. " +
          `Make sure it is the source (${source}) that goes, not the archive copy.`,
        ref: "Procedure C.8",
      },
    ],
  };
}

function archivedStage(): Stage {
  return {
    key: "recall",
    title: "Once archived",
    steps: [
      {
        title: "Revisions are new versions",
        who: ["Steward"],
        text: "Archived files are not edited, renamed or overwritten; a correction is archived as a new version with its own entry.",
        ref: "REQ-PRT-001/002",
      },
      {
        title: "Reading it back",
        text:
          "Find it through the catalogue, not by browsing the filesystem. For 1 TiB or more, or many thousands of files, contact the " +
          "Custodian first. Do not re-archive recalled data.",
        ref: "Procedure E",
      },
    ],
  };
}

function deprecatedStage(): Stage {
  return {
    key: "deprecated",
    title: "Deprecated: restore or delete",
    intro:
      "Deprecated is a flag, not a deletion: the data stays where it is and can still be found. The documents give no procedure for " +
      "it; from here the dataset is either restored to Active or deleted.",
    steps: [
      {
        title: "Note why",
        who: ["Steward"],
        text: "Say in the entry why the dataset is being retired and what replaces it, if anything.",
        ref: "Standard §4",
        fields: ["designated_community_notes"],
      },
      {
        title: "Review together before deleting",
        who: ["Steward", "Owner"],
        text: "Steward and Owner review a dataset flagged for deletion together. To keep it after all, set the status back to Active.",
        ref: "REQ-RET-003, Standard §4 Figure 1",
      },
    ],
  };
}

function deleteStage(later: boolean): Stage {
  return {
    key: "delete",
    title: "Delete (Procedure G)",
    later,
    steps: [
      {
        title: "Confirm retention has ended",
        who: ["Steward"],
        text: "Retention has expired, or the Owner has asked to shorten it.",
        ref: "Procedure G.1",
      },
      {
        title: "Rigsarkivet, for data of lasting value",
        who: ["Owner"],
        text:
          "Destroying data of lasting value needs Rigsarkivet's authorisation in advance; personal data that GDPR would delete but " +
          "that has lasting value is transferred to Rigsarkivet first.",
        ref: "REQ-RIG-002/003",
        fields: ["deletion.rigsarkivet_authorisation"],
      },
      {
        title: "Owner approves in writing",
        who: ["Owner"],
        text: "A ticket, an e-mail or a note on the entry. Without approval, nothing is deleted.",
        ref: "Procedure G.2, REQ-RET-002",
        fields: ["deletion.approved_by", "deletion.reference"],
      },
      {
        title: "Custodian deletes",
        who: ["Custodian"],
        text: "Scripted deletion based on catalogue dates is allowed if it is logged and supervised.",
        ref: "Procedure G.3",
      },
      {
        title: "Mark the entry deleted",
        who: ["Steward"],
        text: "Status Deleted, with the date and the approver. The entry is never removed.",
        ref: "Procedure G.4, REQ-CAT-007",
        fields: ["deletion.date"],
      },
    ],
  };
}

/** Every stage once, with the statuses it is shown for (for the AI prompt). */
export function allStages(data: Manifest): { stage: Stage; statuses: Status[] }[] {
  const found = new Map<string, { stage: Stage; statuses: Status[] }>();
  for (const status of STATUSES) {
    for (const stage of stagesFor({ ...data, status })) {
      const entry = found.get(stage.key) ?? { stage, statuses: [] };
      entry.statuses.push(status);
      found.set(stage.key, entry);
    }
  }
  return [...found.values()];
}

/** The stages to show for the manifest's status: the current work first, then a preview of what follows. */
export function stagesFor(data: Manifest): Stage[] {
  switch (statusOf(data.status)) {
    case "proposed":
      return [registerStage()];
    case "active":
      return [activeStage(data), prepareStage(true), folderStage(data, true), writeStage(data, true)];
    case "archived":
      return [prepareStage(false), folderStage(data, false), writeStage(data, false), archivedStage()];
    case "deprecated":
      return [deprecatedStage(), deleteStage(true)];
    case "deleted":
      return [deleteStage(false)];
  }
}
