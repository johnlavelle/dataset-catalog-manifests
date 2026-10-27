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
  WIS2_OPTIONS,
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
const tbd = (inputType: "text" | "url" | "date", placeholder?: string) => ({
  "ui:widget": "TbdWidget",
  "ui:options": { inputType },
  ...(placeholder ? { "ui:placeholder": placeholder } : {}),
});
const showIf = (condition: boolean, ui: UiSchema) => (condition ? ui : hidden);

/** The uiSchema depends on the data: fields that only apply to another choice are hidden. */
export default function buildUiSchema(data: Manifest): UiSchema {
  const roles = data.roles ?? {};
  const retentionKind = data.retention?.kind;
  const licence = data.license?.id;
  const storage = data.storage ?? {};
  const automated = data.archiving?.automated === true;
  const status = data.status;

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
      "products",
      "designated_community_notes",
      "exceptions",
      "extensions",
    ],
    id: { "ui:widget": "IdWidget" },
    status: { "ui:widget": "StatusWidget" },
    dataset: {
      "ui:order": ["name", "path", "description", "model", "domain"],
      name: { "ui:placeholder": "e.g. DANRA Reanalysis — Zarr Data Collection" },
      path: { "ui:placeholder": "e.g. /dmidata/projects/<project>/… or /dmidata/archive/<discipline>/…" },
      description: textarea(3, "What it contains, what it is for, period and resolution, how to interpret it…"),
      model: { "ui:placeholder": "e.g. NEMO, WAM, EC-Earth3" },
      domain: { "ui:placeholder": "e.g. North Sea - Baltic Sea" },
    },
    roles: {
      "ui:order": ["owner", "steward", "custodian", "single_person"],
      owner: OWNERS.length ? { ...person, "ui:options": { choices: OWNERS.map(ownerPerson) } } : person,
      steward: { ...person, "ui:options": { copyFrom: "owner" } },
      custodian: { ...person, "ui:options": { copyFrom: "owner" } },
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
      reason: showIf(licence === "restricted" || licence === "DMI-internal", textarea(2)),
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
      metadata: tbd("url", "https://confluence.dmi.dk/…"),
      archiving_guide: tbd("url", "https://confluence.dmi.dk/…"),
      contract: showIf(storage.tier === "third_party" || !!data.links?.contract, tbd("url")),
    },
    dates: {
      "ui:order": ["released", "archived", "deletion_planned", "reviewed", "updated"],
      released: tbd("date"),
      archived: showIf(status === "archived" || status === "deprecated" || !!data.dates?.archived, date),
      deletion_planned: date,
      reviewed: date,
      updated: date,
    },
    storage: {
      "ui:order": [
        "tier",
        "wis2_discipline",
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
      wis2_discipline: select(WIS2_OPTIONS),
      formats: multiSelect(FORMAT_OPTIONS),
      format_notes: { "ui:placeholder": "e.g. GRIB2; CF-1.8; mostly netCDF" },
      containers: multiSelect(CONTAINER_OPTIONS),
      compression: multiSelect(COMPRESSION_OPTIONS),
      compression_settings: { "ui:placeholder": "e.g. mksquashfs -comp zstd -b 1M; netCDF zlib level 1" },
      lossy_settings: showIf(storage.lossy === true, {}),
      lossy_approved_by: showIf(storage.lossy === true, person),
      secondary_locations: { "ui:options": { orderable: false } },
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
        "ui:widget": "checkboxes",
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
      pipeline: showIf(automated, tbd("url", "https://gitlab.dmi.dk/hpc/dmi-data-archive/…")),
      owning_team: showIf(automated, {}),
    },
    deletion: {
      "ui:order": ["date", "approved_by", "reference", "rigsarkivet_authorisation"],
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
    products: {
      "ui:field": "ProductsField",
    },
    extensions: {
      "ui:field": "ExtensionsField",
    },
  };
}
