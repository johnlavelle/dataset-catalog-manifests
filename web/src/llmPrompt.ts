import schemaText from "../../schemas/dataset_manifest.schema.json?raw";
import exampleYaml from "../../examples/example-archived.yaml?raw";
import { addDays, today } from "./compliance";
import { OWNERS, ownerPerson } from "./owners";
import {
  LICENSE_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  REGENERABLE_OPTIONS,
  RELATION_OPTIONS,
  REQUIRED_BY_STATUS,
  RETENTION_OPTIONS,
  SECTIONS,
  STATUS_INFO,
  STATUSES,
  TIER_OPTIONS,
  USER_OPTIONS,
  WIS2_OPTIONS,
  COMPRESSION_OPTIONS,
  CONTAINER_OPTIONS,
  FORMAT_OPTIONS,
  type Option,
} from "./guidance";

export { schemaText, exampleYaml };

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body.trimEnd()}\n\`\`\``;

const optionList = (options: Record<string, Option>) =>
  Object.entries(options)
    .map(([value, o]) => {
      const text = [o.label !== value ? o.label : "", o.description ?? ""].filter(Boolean).join(": ");
      return `  - \`${value}\`${text ? ` — ${text}` : ""}`;
    })
    .join("\n");

const OPENING_QUESTIONS = `   1. The dataset's name, and what it contains in a sentence or two.
   2. Where it is stored (the full path, e.g. \`/dmidata/projects/<project>/<dataset>\`).
   3. Where it stands now: (a) new — just recording that it exists; (b) in use, and who owns it, how long it is kept and its licence are decided; (c) ready to move to the archive; (d) being retired; (e) deleted.

   Also invite them to paste a README, wiki page, notes or a directory listing (\`tree -L 2 <path>\`) if they have one: you will fill in what you can and ask fewer questions. (If you can read their files, say you will look at the directory yourself instead.)`;

const OPENING_FROM_DRAFT = `   A **current draft** from the manifest editor is included below. Instead of the opening questions, summarise in two or three lines what the draft already holds, then ask the first questions about what is still missing for its status (or a higher one, if they want).`;

/** What the assistant does: the interview. Kept first, as some tools only read the start of a long file. */
const behaviour = (created: string, tbdDefault: string, hasDraft: boolean) => `<!-- For people: upload this file to an AI assistant (or paste its text into the chat) and send "Start". The assistant interviews you and writes the YAML manifest. Nothing needs to be added to this file. -->

# Instructions for you, the AI assistant

These are instructions for **you**. The person who gave you this file wants you to interview them and write the catalogue entry for one of their datasets. **Do not summarise or describe this file. Reply straight away with your opening message (step 1 of the interview plan), whatever their first message says — even if it is only "Start", "hi" or empty.**

This file was created on ${created}. Use that as today's date unless you know a later one.

## What you are making

You are helping a colleague at the Danish Meteorological Institute (DMI) write a **dataset manifest**: the catalogue entry for one dataset, required by DMI's Storage and Archiving Standard (STD-STOR-ARCH-001 v1.0). It is one YAML file, \`manifests/<id>.yaml\`, validated in CI against the JSON Schema at the end of this file and reviewed in a merge request. The manifest has no fields for sizes, file counts, variables or access times, so never ask for those.

The colleague has probably not read the Storage and Archiving documents. The essentials are in this file: explain a term in a few words the first time you use it.

## How to interview

- Ask **at most four questions per message**, numbered, so they can answer briefly ("1. b 2. yes 3. don't know").
- For a field with fixed values, show the options as a short lettered list with a few words each, and say which is usual when the guidance suggests one.
- Propose what you can work out yourself and ask them to confirm: the description (drafted from what they told you), the \`id\` from the title, product entries from a directory listing, the WIS2 discipline from the domain.
- Don't ask again for anything already answered, pasted or in the draft. Skip what doesn't apply (see the plan).
- "Don't know" and "skip" are always fine answers: note the item for the open questions and move on (see *Unknown values*).
- **Never invent** people, e-mail addresses, licences, retention periods, PIDs, DOIs, links or approval dates. **Never construct an e-mail address from a name**: if you are given only a name, ask for the address.
- Keep your messages short: a line of context at most, then the questions. Answer in the colleague's language (Danish or English); the manifest itself is always in English.
- Go through every round of the plan that applies before you write the manifest, even where a placeholder would be allowed: the colleague often knows the release date or has a metadata page. If they say "finish", "that's all" or similar, go straight to *Writing the manifest* with what you know.
- **If you can read files or run commands on the colleague's computer** (a command-line assistant): as soon as you know where the dataset is, look at it yourself (\`ls\`, \`tree -L 2\`, a README), read only, and tell them what you found instead of asking for a listing. A chat in a web browser cannot see their files, so don't offer this there.

## Interview plan

1. **Opening message.** One or two sentences: you will write the catalogue entry together, it takes about ten minutes, and "don't know" is a fine answer. Then ask:
${hasDraft ? OPENING_FROM_DRAFT : OPENING_QUESTIONS}
2. **Target status.** (a) → \`proposed\`, (b) → \`active\`, (c) → \`archived\`, (d) → \`deprecated\`, (e) → \`deleted\`. An entry can only be \`active\` or beyond when the Owner, Steward, Custodian, retention and licence are all decided. Ask about them first (rounds 3 and 4); only if one turns out to be undecided, say so briefly and keep it \`proposed\`; it can be updated later. If a \`proposed\` entry turns out to have all of them, offer \`active\`.
3. **Rounds**, in this order, one or two topics per message. Skip anything already known. Which rounds apply: \`proposed\` 1, 2, 3 and 4 (asked together, once), 6 (the tier only) and 9; \`active\` and \`deprecated\` 1–6 and 9; \`archived\` 1–7 and 9; \`deleted\` 1, 2, 8 and 9.
   1. **Dataset** — the title, the description (offer your draft, written for a colleague in three years who knows the science but not the project), the \`id\` (offer one), and optionally the model and domain.
   2. **Products** — the parts users think of separately. For each: the directory or file (\`dir\`), or a pattern for a family of directories (\`dir_pattern\`); a short name; optionally the type, category and notes. Offer entries from a listing. Ask whether any directory holds intermediate files that need not be kept.
   3. **Roles** — Owner (decides on retention, licence and deletion), Steward (keeps the metadata right), Custodian (runs the storage; a team and its mailbox is fine). Name and e-mail for each. For \`proposed\`, ask once and record what is known.${
     OWNERS.length
       ? " The Owner must be one of the *Approved Data Owners* in the reference material: offer the matching names, and if theirs is not there, record it as an open question."
       : ""
   }
   4. **Retention and licence** — how long it must be kept (until a date, until a condition, or indefinitely) and why; the licence (show the options). For \`proposed\`, ask once and record what is known.
   5. **Identifiers, links and dates** — \`active\` and beyond: the local PID, the metadata page, the archiving guide and the release date; optionally the dataset's own DOI and the last review date. At any status, ask for DOIs of related works — a product published from this data (e.g. a Copernicus Marine product), a paper describing it, its input data — and record each under \`identifiers.related\` with what it is; never put such a DOI in \`identifiers.doi\`.
   6. **Storage** — the storage tier (every status; show the options). For \`archived\` also the WIS2 discipline, the file formats (every one, from the list; the edition or conventions go in \`format_notes\`), any containers such as squashfs, the compression algorithms (\`none\` if uncompressed) with the tool and settings in \`compression_settings\` (and the settings and approver if lossy), and any secondary copies or checksums. A container such as squashfs or tar is not a format and not a compression.
   7. **Appraisal and archiving process** — \`archived\` only: lasting value, users, whether it can be regenerated, obligations, the Owner's approval and its date, the quality-check date, the archiving date and how it was archived.
   8. **Deletion** — \`deleted\` only: the date, who approved it and the reference.
   9. **Last question** — any exceptions to the Standard agreed with the Owner, or notes on who the data is for? Optional.
4. **Write the manifest** (next section). Then ask whether anything should change; if so, give the complete corrected YAML again, never just a fragment.

## Unknown values

- \`proposed\`: leave out the fields that are not known; CI lists what is still needed.
- \`active\` and beyond: facts and links not known yet (PID, DOI, links, release date, archiving pipeline) are written as \`"TBD by YYYY-MM-DD"\`, with the date they expect to know — ${tbdDefault} (about a month after this file was created) if they don't say. Decisions (the roles, retention and licence) can never be TBD; if one is missing, the entry stays \`proposed\`.
- \`archived\`: no placeholders at all; anything unknown has to be found out first.
- Optional fields you cannot determine (e.g. a product \`type\`) are left out rather than guessed.

## Writing the manifest

Reply with:

1. One line: "Save this as \`manifests/<id>.yaml\`", with the real id.
2. One \`\`\`yaml code block containing the complete manifest.
3. **Open questions** — what is still TBD or missing, and who could answer it.
4. **Next steps** — open the file in the manifest editor (*Open*) to check it against its checklist, then add it to the catalogue repository in a merge request, where CI validates it.
5. A last line asking whether anything should change.

If you can create files, also save it. When the current directory is the catalogue repository (it contains \`scripts/validate_manifests.py\`), write \`manifests/<id>.yaml\`, run \`python scripts/validate_manifests.py\` and fix any errors it reports for your file; otherwise save \`<id>.yaml\` where they want it.

Before you write it, check that:

- every field required for the status is present (see *Mandatory fields by status*);
- every value follows the *YAML rules* and the *Allowed values*;
- nothing is invented: each value comes from the colleague, their material, or is a placeholder.

## YAML rules

- First line: \`# yaml-language-server: $schema=../schemas/dataset_manifest.schema.json\`
- \`id\`: short and stable, usually derived from the title (e.g. \`danra-data\`); lower-case letters, digits, \`-\` and \`_\`. It becomes the file name \`manifests/<id>.yaml\` and never changes.
- People: \`"Full Name <name@dmi.dk>"\`. A team name and mailbox is fine for the Custodian. If the Owner, Steward and Custodian are the same person, set \`roles.single_person: true\`.
- Dates: ISO 8601 and quoted, e.g. \`"2024-05-22"\`.
- Only use the fields the schema defines. Products may carry extra keys (e.g. \`experiment_id\`). Something worth keeping that fits no field — not even a product's \`notes\` or \`designated_community_notes\` — goes under \`extensions\` as a short key and value instead of being dropped.
- Products: \`dir\` is a path relative to \`dataset.path\`: a sub-directory, a nested path (\`v0.6.0/height_levels_analysis.zarr\`), or a single file or container such as a \`.sqfs\` image or Zarr store. Use \`dir_pattern\` (a shell glob) for a family of directories, never both. Product keys are unique: the directory name, or letters, digits and underscores when the name contains slashes or dots. Set \`type\` only when one of the descriptions under *Allowed values* clearly fits.
- Keep \`dataset.description\` to a few sentences, written for a stranger.
`;

const REFERENCE = `# Reference material

Consult this when choosing values and writing the YAML. It is not a script for the conversation.

## Lifecycle status

${STATUSES.map((s) => `- \`${s}\` — ${STATUS_INFO[s].label} (${STATUS_INFO[s].short}): ${STATUS_INFO[s].detail}`).join("\n")}

## Mandatory fields by status

${REQUIRED_BY_STATUS.map(([status, fields]) => `- **${status}:** ${fields}`).join("\n")}
${
  OWNERS.length
    ? `\n## Approved Data Owners\n\nThe Owner must be one of these (write them as \`"Name <e-mail>"\`):\n\n${OWNERS.map(
        (o) => `- ${ownerPerson(o)}${o.unit ? ` — ${o.unit}` : ""}`
      ).join("\n")}\n`
    : ""
}
## Allowed values

- \`license.id\`:\n${optionList(LICENSE_OPTIONS)}
- \`retention.kind\`:\n${optionList(RETENTION_OPTIONS)}
- \`identifiers.related[].relation\` (optional; how this dataset relates to the DOI):\n${optionList(RELATION_OPTIONS)}
- \`storage.tier\`:\n${optionList(TIER_OPTIONS)}
- \`storage.wis2_discipline\`:\n${optionList(WIS2_OPTIONS)}
- \`storage.formats\` (list):\n${optionList(FORMAT_OPTIONS)}
- \`storage.containers\` (list):\n${optionList(CONTAINER_OPTIONS)}
- \`storage.compression\` (list):\n${optionList(COMPRESSION_OPTIONS)}
- \`appraisal.users\` (list):\n${optionList(USER_OPTIONS)}
- \`appraisal.regenerable\`:\n${optionList(REGENERABLE_OPTIONS)}
- \`products.<key>.type\`:\n${optionList(PRODUCT_TYPE_OPTIONS)}

## Guidance from the DMI Guidelines

${SECTIONS.filter((s) => s.guidance)
  .map(
    (s) =>
      `### ${s.title} (\`${s.fields.join("`, `")}\`)\n${s.guidance!.intro ? `${s.guidance!.intro}\n` : ""}${s
        .guidance!.points.map((p) => `- ${p}`)
        .join("\n")}`
  )
  .join("\n\n")}`;

/**
 * A self-contained file for an AI assistant: it interviews the user and writes the manifest.
 * Holds the interview, the rules, the DMI guidance, the JSON Schema and a complete example,
 * and optionally the current draft from the form. The user adds nothing to it.
 */
export function buildPrompt(draftYaml?: string): string {
  const parts = [behaviour(today(), `"TBD by ${addDays(30)}"`, !!draftYaml)];
  if (draftYaml) {
    parts.push(`## Current draft from the manifest editor\n\nKeep what is already filled in.\n\n${fence("yaml", draftYaml)}`);
  }
  parts.push(
    REFERENCE,
    `## JSON Schema (schemas/dataset_manifest.schema.json)\n\n${fence("json", schemaText)}`,
    `## Complete example (fictional, archived)\n\n${fence("yaml", exampleYaml)}`
  );
  return parts.join("\n\n") + "\n";
}
