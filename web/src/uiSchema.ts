import type { UiSchema } from "@rjsf/utils";
import type { Manifest } from "./compliance";
import { sameRoleHolder } from "./compliance";
import {
  COMPRESSION_OPTIONS,
  CONTAINER_OPTIONS,
  FORMAT_OPTIONS,
  LICENSE_OPTIONS,
  REGENERABLE_OPTIONS,
  RELATION_OPTIONS,
  RETENTION_OPTIONS,
  TIER_OPTIONS,
  USER_OPTIONS,
  archiveRulesApply,
  inArchive,
  locationLabels,
  statusOf,
  tapeLabels,
} from "./guidance";
import { OWNERS, ownerPerson } from "./owners";

const hidden = { "ui:widget": "hidden" };
const person = { "ui:widget": "PersonWidget" };
const date = { "ui:widget": "date" };
const textarea = (rows: number, placeholder?: string) => ({
  "ui:widget": "textarea",
  "ui:options": { rows },
  ...(placeholder ? { "ui:placeholder": placeholder } : {}),
});
const select = (choices: Record<string, unknown>) => ({
  "ui:widget": "DescribedSelectWidget",
  "ui:options": { choices },
});
const multiSelect = (choices: Record<string, unknown>) => ({
  "ui:widget": "MultiSelectWidget",
  "ui:options": { choices },
});
const showIf = (condition: boolean, ui: UiSchema) => (condition ? ui : hidden);
/** A location: a directory, typed in full; the schema checks its form (definitions.location). */
const path = (placeholder?: string, extra: UiSchema = {}) => ({
  ...(placeholder ? { "ui:placeholder": placeholder } : {}),
  ...extra,
});

/**
 * The uiSchema depends on the data: fields that only apply to another choice are hidden. A widget
 * that needs a value from elsewhere in the manifest gets just that value here, in ui:options. rjsf
 * compares a field's props to skip fields that did not change, so the whole manifest must not
 * reach them (not through formContext either): any edit would then redraw the entire form.
 */
export default function buildUiSchema(data: Manifest): UiSchema {
  const roles = data.roles ?? {};
  const retentionKind = data.retention?.kind;
  const licence = data.license?.id;
  const storage = data.storage ?? {};
  const automated = data.archiving?.automated === true;
  const status = data.status;
  const labels = locationLabels(statusOf(status));
  const tape = tapeLabels(statusOf(status));
  const noTbd = archiveRulesApply(data);
  const tbd = (inputType: "text" | "url" | "date", placeholder?: string) => ({
    "ui:widget": "TbdWidget",
    "ui:options": { inputType, noTbd },
    ...(placeholder ? { "ui:placeholder": placeholder } : {}),
  });
  const copyOwner = { ...person, "ui:options": { copyFrom: "owner", copySource: roles.owner } };

  return {
    "ui:order": [
      "id",
      "status",
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
      "parts",
      "designated_community_notes",
      "exceptions",
      "extensions",
    ],
    id: { "ui:widget": "IdWidget", "ui:options": { suggestFrom: data.dataset?.name } },
    status: { "ui:widget": "StatusWidget" },
    dataset: {
      "ui:order": ["name", "path", "legacy_path", "on_tape", "description", "model", "domain"],
      name: { "ui:placeholder": "e.g. Ocean Reanalysis — Zarr Data Collection" },
      path: path("e.g. /data/projects/<project>/<dataset> or /data/archive/<discipline>/<dataset>", {
        "ui:title": labels.path,
        "ui:description": labels.pathHelp,
      }),
      legacy_path: path("e.g. /data/old/<user>/<dataset> or host:/path", {
        "ui:title": labels.legacy,
        "ui:description": labels.legacyHelp,
      }),
      // Will go to / is on / was on tape, with the status
      on_tape: { "ui:title": tape.label, "ui:description": tape.help },
      description: textarea(3, "What it contains, what it is for, period and resolution, how to interpret it…"),
      model: { "ui:placeholder": "e.g. NEMO, WAM, EC-Earth3" },
      domain: { "ui:placeholder": "e.g. North Sea - Baltic Sea" },
    },
    roles: {
      "ui:order": ["owner", "steward", "custodian", "single_person"],
      owner: OWNERS.length ? { ...person, "ui:options": { choices: OWNERS.map(ownerPerson) } } : person,
      steward: copyOwner,
      custodian: copyOwner,
      single_person: showIf(sameRoleHolder(roles) || roles.single_person === true, {}),
    },
    retention: {
      "ui:order": ["kind", "until", "condition", "rationale"],
      kind: select(RETENTION_OPTIONS),
      until: showIf(retentionKind === "date", date),
      condition: showIf(retentionKind === "condition", { "ui:placeholder": "e.g. until superseded by v1.0, plus 2 years" }),
      rationale: textarea(2, "We keep X until Y because Z."),
    },
    license: {
      "ui:order": ["id", "reason", "decided_by"],
      id: select(LICENSE_OPTIONS),
      reason: showIf(licence === "restricted" || licence === "internal", textarea(2)),
      decided_by: showIf(licence === "restricted", person),
    },
    identifiers: {
      "ui:order": ["pid", "doi", "related"],
      pid: tbd("text"),
      doi: tbd("text", "Only this dataset's own DOI, e.g. 10.xxxx/…"),
      related: {
        "ui:options": { orderable: false },
        items: {
          "ui:order": ["doi", "title", "relation"],
          doi: { "ui:placeholder": "e.g. 10.48670/moi-00013" },
          title: { "ui:placeholder": "e.g. BALTICSEA_MULTIYEAR_PHY_003_011" },
          relation: select(RELATION_OPTIONS),
        },
      },
    },
    links: {
      "ui:order": ["metadata", "archiving_guide", "contract"],
      metadata: tbd("url", "https://wiki.example.com/…"),
      archiving_guide: tbd("url", "https://wiki.example.com/…"),
      contract: showIf(storage.tier === "third_party" || !!data.links?.contract, tbd("url")),
    },
    dates: {
      "ui:order": ["released", "archived", "deletion_planned", "reviewed", "updated"],
      released: tbd("date"),
      archived: showIf(inArchive(data) || !!data.dates?.archived, date),
      deletion_planned: date,
      reviewed: date,
      updated: date,
    },
    storage: {
      "ui:order": [
        "tier",
        "formats",
        "format_notes",
        "containers",
        "compression",
        "compression_settings",
        "lossy",
        "lossy_settings",
        "lossy_approved_by",
        "secondary_locations",
        "checksums",
      ],
      tier: select(TIER_OPTIONS),
      formats: multiSelect(FORMAT_OPTIONS),
      format_notes: { "ui:placeholder": "e.g. GRIB2; CF-1.8; mostly netCDF" },
      containers: multiSelect(CONTAINER_OPTIONS),
      compression: multiSelect(COMPRESSION_OPTIONS),
      compression_settings: { "ui:placeholder": "e.g. mksquashfs -comp zstd -b 1M; netCDF zlib level 1" },
      lossy_settings: showIf(storage.lossy === true, {}),
      lossy_approved_by: showIf(storage.lossy === true, person),
      secondary_locations: { "ui:options": { orderable: false }, items: path(undefined, { "ui:title": "Secondary location" }) },
      checksums: { "ui:placeholder": "e.g. sha256 file next to each archive file" },
    },
    appraisal: {
      "ui:order": [
        "lasting_value",
        "users",
        "regenerable",
        "regeneration_notes",
        "obligations",
        "approved_by",
        "approved_on",
      ],
      lasting_value: textarea(2, "What would be lost if this dataset disappeared?"),
      users: {
        "ui:widget": "ChecklistWidget",
        "ui:enumNames": Object.values(USER_OPTIONS).map((o) => o.label),
      },
      regenerable: select(REGENERABLE_OPTIONS),
      regeneration_notes: textarea(2),
      obligations: textarea(2),
      approved_by: person,
      approved_on: date,
    },
    archiving: {
      "ui:order": ["quality_verified_on", "aggregation", "automated", "pipeline", "owning_team"],
      quality_verified_on: date,
      aggregation: { "ui:placeholder": "e.g. monthly netCDF files of ~100 GiB" },
      pipeline: showIf(automated, tbd("url", "https://git.example.com/archive-jobs/…")),
      owning_team: showIf(automated, {}),
    },
    deletion: {
      "ui:order": ["date", "approved_by", "reference", "archives_authorisation"],
      date,
      approved_by: person,
    },
    designated_community_notes: textarea(3),
    exceptions: {
      "ui:options": { orderable: false },
      items: {
        "ui:order": ["id", "requirement", "expires", "note"],
        expires: date,
      },
    },
    parts: {
      "ui:field": "PartsField",
      // Single values, not the manifest: see above
      "ui:options": { status, manifestId: data.id },
    },
    extensions: {
      "ui:field": "ExtensionsField",
    },
  };
}
