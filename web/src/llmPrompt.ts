import schemaText from "../../schemas/dataset_manifest.schema.json?raw";
import exampleYaml from "../../examples/example-archived.yaml?raw";
import {
  LICENSE_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  REGENERABLE_OPTIONS,
  REQUIRED_BY_STATUS,
  RETENTION_OPTIONS,
  SECTIONS,
  STATUS_INFO,
  STATUSES,
  TIER_OPTIONS,
  USER_OPTIONS,
  WIS2_OPTIONS,
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

const INSTRUCTIONS = `# Task: write a DMI dataset manifest

You are helping a colleague at the Danish Meteorological Institute (DMI) write a **dataset manifest**: the catalogue entry for one dataset, as required by DMI's Storage and Archiving Standard (STD-STOR-ARCH-001 v1.0). The manifest is a YAML file that is validated in CI against the JSON Schema below and reviewed in a merge request. A scanner later adds sizes, file counts, formats, variables and access times from the filesystem, so those are not typed into the manifest.

## How to work

1. Read the information about the dataset at the end of this prompt (notes, README, directory listing, an existing wiki page, …).
2. If mandatory information for the intended status is missing, ask for it first — one round of short, specific questions. If the user asks you to go ahead anyway, write the manifest with what is known.
3. **Never invent** people, e-mail addresses, licences, retention periods, PIDs, DOIs, links or approval dates. Leave unknown fields out and list them as open questions. Leave out optional fields you cannot determine (e.g. a product \`type\`) rather than guessing.
4. Use the lowest status the information supports. A dataset whose Owner, Steward, Custodian, retention and licence are not all known stays \`proposed\`. For a \`proposed\` entry, simply omit the registration fields that are unknown — CI reports what is still needed.
5. From \`active\` upwards, facts and links that are not known yet (identifiers, links, release date, archiving pipeline) are written as \`"TBD by YYYY-MM-DD"\`, with the date the user expects to know them — about one month ahead if they don't say. Placeholders are not allowed for an \`archived\` entry.
6. Answer with exactly one \`\`\`yaml code block containing the complete manifest, followed by a short list **Open questions and assumptions**.

## Rules

- First line of the YAML: \`# yaml-language-server: $schema=../schemas/dataset_manifest.schema.json\`
- \`id\`: short and stable, usually derived from the title (e.g. \`danra-data\`); lower-case letters, digits, \`-\` and \`_\`. It becomes the file name \`manifests/<id>.yaml\` and never changes.
- People: \`"Full Name <name@dmi.dk>"\`. A team name and mailbox is fine for the Custodian. If Owner, Steward and Custodian are the same person, set \`roles.single_person: true\`.
- Dates: ISO 8601 and quoted, e.g. \`"2024-05-22"\`.
- Only use the fields the schema defines. Products may carry extra keys (e.g. \`experiment_id\`).
- Products: one entry per product as users would think of it. \`dir\` is a path relative to \`dataset.path\`: a sub-directory, a nested path (\`v0.6.0/height_levels_analysis.zarr\`), or a single file or container such as a \`.sqfs\` image or Zarr store. Use \`dir_pattern\` (a shell glob) for a family of directories — never both. Product keys are unique: the directory name, or letters, digits and underscores when the name contains slashes or dots. Set \`type\` only when one of the descriptions below clearly fits.
- Keep \`dataset.description\` to a few sentences, written for a stranger: a colleague in three years who knows the science but not the project.

## Lifecycle status

${STATUSES.map((s) => `- \`${s}\` — ${STATUS_INFO[s].label} (${STATUS_INFO[s].short}): ${STATUS_INFO[s].detail}`).join("\n")}

## Mandatory fields by status

${REQUIRED_BY_STATUS.map(([status, fields]) => `- **${status}:** ${fields}`).join("\n")}

## Allowed values

- \`license.id\`:\n${optionList(LICENSE_OPTIONS)}
- \`retention.kind\`:\n${optionList(RETENTION_OPTIONS)}
- \`storage.tier\`:\n${optionList(TIER_OPTIONS)}
- \`storage.wis2_discipline\`:\n${optionList(WIS2_OPTIONS)}
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
  .join("\n\n")}
`;

/**
 * A self-contained prompt for an LLM: instructions, rules, guidance, the JSON Schema and a
 * complete example, optionally the current draft, and a slot for the user's own notes.
 */
export function buildPrompt(draftYaml?: string): string {
  const parts = [
    INSTRUCTIONS,
    `## JSON Schema (schemas/dataset_manifest.schema.json)\n\n${fence("json", schemaText)}`,
    `## Complete example (fictional, archived)\n\n${fence("yaml", exampleYaml)}`,
  ];
  if (draftYaml) {
    parts.push(`## Current draft — start from this and keep what is already filled in\n\n${fence("yaml", draftYaml)}`);
  }
  parts.push(
    "## Information about the dataset\n\n" +
      "<!-- Paste below everything you know: purpose, path, directory listing (e.g. `ls -l` or `tree -L 2`), " +
      "who owns and maintains it, how long it must be kept and why, licence, links to documentation. -->\n"
  );
  return parts.join("\n\n");
}
