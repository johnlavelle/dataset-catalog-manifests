# Dataset Catalog Manifests

Dataset manifest files for the [DMI data archiving tools](https://gitlab.dmi.dk/jola/data-archiving-info). Each YAML manifest is the catalogue entry for one dataset, as required by the DMI Storage and Archiving Standard (STD-STOR-ARCH-001 v1.0, §4): what the dataset is, who is responsible for it, how long it is kept, under which licence, and — once archived — how it was appraised and prepared. The scanner adds everything it can read from the filesystem (sizes, file counts, formats, variables, access times).

Dataset stewards submit manifests here via merge requests — no need to modify the tooling repo.

## Adding a New Dataset

1. Fill in the [web editor](web/) (or copy an existing manifest / [`examples/example-archived.yaml`](examples/example-archived.yaml))
2. Save it as `manifests/<id>.yaml` — the file name must equal the manifest's `id`
3. Run validation locally (see below)
4. Submit a merge request; the Data Owner approves it (Procedure A.7)

### Minimal Example

A new entry starts as `proposed` and only needs the basics:

```yaml
id: my-dataset
status: proposed

dataset:
  name: "My Dataset"
  path: "/dmidata/projects/my_project/my_dataset"
  description: "What the dataset contains and why it exists."

products:
  daily_temperature:
    name: "Daily Temperature"
    dir: "daily_temperature"
    category: "Physics"
    type: "final product"
```

To register it, set `status: active` and add the roles, retention, licence, identifiers, links and release date. See [`examples/example-archived.yaml`](examples/example-archived.yaml) for a complete entry.

## Manifest Format

See [`schemas/dataset_manifest.schema.json`](schemas/dataset_manifest.schema.json) for the full specification. Add `# yaml-language-server: $schema=../schemas/dataset_manifest.schema.json` as the first line to get validation and completion in VS Code.

### What is mandatory depends on the status

The `status` follows the dataset lifecycle in Standard §4 (Figure 1):
`proposed → active → archived → deprecated → deleted`, plus `withdraw` (proposed → deleted) and `restore` (deprecated → active).

| Status | Mandatory fields |
|--------|------------------|
| any | `id`, `status`, `dataset.name`, `dataset.path`, `dataset.description`, `products` (at least one) |
| `active`, `archived`, `deprecated` | `roles.owner`, `roles.steward`, `roles.custodian`, `retention.kind` (+ `until` / `condition` / `rationale`), `license.id`, `identifiers.pid`, `links.metadata`, `links.archiving_guide`, `dates.released` |
| `archived` | additionally `appraisal` (`lasting_value`, `users`, `regenerable`, `approved_by`, `approved_on`), `storage.wis2_discipline`, `storage.format`, `storage.compression`, `archiving.quality_verified_on`, `dates.archived`; `storage.tier`, if set, must be `archive`; **no `TBD` placeholders** (REQ-ARC-001) |
| `deleted` | `deletion.date`, `deletion.approved_by` — the entry is kept, never removed (REQ-CAT-007) |

Conditional rules that apply at any status:

| When | Then also required |
|------|--------------------|
| `retention.kind: date` / `condition` / `indefinite` | `retention.until` / `retention.condition` / `retention.rationale` |
| `license.id: restricted` | `license.reason`, `license.decided_by` (REQ-LIC-002) |
| `storage.lossy: true` | `storage.lossy_settings`, `storage.lossy_approved_by` (REQ-FMT-003) |
| `archiving.automated: true` | `archiving.pipeline`, `archiving.owning_team` (REQ-OPS-002) |
| `storage.tier: third_party` | `links.contract` (REQ-TPY-003) |
| Owner, Steward and Custodian are the same person | `roles.single_person: true` (Standard §3) |

### Placeholders

Facts and links that are not known yet (`identifiers.pid`, `identifiers.doi`, `links.*`, `dates.released`, `archiving.pipeline`) may be written as `"TBD by YYYY-MM-DD"` (Procedure A.5). The validator lists them and flags overdue ones. Decisions — roles, retention, licence — cannot be postponed, and no placeholder may remain once a dataset is archived.

### Conventions

- **People**: `"Full Name <name@dmi.dk>"` (a team name and mailbox is fine for the Custodian).
- **Dates**: ISO 8601, quoted — `"2024-05-22"`.
- **Enumerations**: `license.id` — `CC-BY-4.0`, `CC0-1.0`, `WMO-UDP-core`, `WMO-UDP-recommended`, `DMI-internal`, `restricted`; `storage.tier` — `project_space`, `archive`, `database`, `third_party`, `legacy`; `storage.wis2_discipline` — `atmospheric-composition`, `climate`, `cryosphere`, `hydrology`, `ocean`, `space-weather`, `weather`; `appraisal.users` — `dmi_staff`, `wmo_nmhs`, `copernicus`, `danish_researchers`, `public`; `appraisal.regenerable` — `impossible`, `expensive`, `cheap`.

### Sections

| Section | Contents |
|---------|----------|
| `dataset` | Title, primary location, description; optional model, domain, general contact |
| `roles` | Data Owner, Data Steward, Data Custodian (Standard §3) |
| `retention` | Retain until a date, a condition, or indefinitely — with rationale (REQ-RET-001) |
| `license` | Licence and, for restricted data, the reason and decision-maker (REQ-LIC-001/002) |
| `identifiers` | Local PID (REQ-CAT-008) and DOI (REQ-CAT-009) |
| `links` | Metadata page, archiving guide, supplier contract |
| `dates` | Release, archiving, planned deletion, last review, last update (optional override — otherwise derived from Git and the scan) |
| `storage` | Tier, WIS2 discipline, format, compression, lossy settings, secondary locations, checksums |
| `appraisal` | Why it has lasting value, who will use it, whether it can be regenerated, obligations, Owner's approval (REQ-APP-001–004) |
| `archiving` | Quality check date, aggregation, automated archiving job and owning team |
| `deletion` | Deletion date, approver, reference, Rigsarkivet authorisation |
| `designated_community_notes` | Anything a future user needs to interpret the data |
| `exceptions` | Registered exceptions (`id`, `requirement`, `expires`, `note`) |
| `stac` | STAC catalog metadata: `institution`, `purpose`, `dois`, etc. |
| `products` | Map of product key to metadata (below) |

### Products

Each entry in `products` has:
- **`name`** (required) — Human-readable product name.
- **`dir`** (required\*) — Literal subdirectory name under `dataset.path` containing this product's files.
- **`dir_pattern`** (required\*) — Shell glob pattern matching multiple subdirectories (e.g. `n[0-9][0-9][0-4]`). Use instead of `dir` when a product spans many directories with a naming convention.
- **`category`** — Grouping category. Common values: `Physics`, `Biogeochemistry`, `Ice`, `Observations`, `Assimilation`, `Waves`, `Atmospheric`. Climate datasets may use activity names (`DECK`, `CMIP`, `ScenarioMIP`, `DCPP`).
- **`model_component`** — Model component (e.g. "NEMO", "ERGOM", "SI3").
- **`domain`** — Geographic domain for this product.
- **`type`** — Product type. Must be one of: `final product`, `original output`, `raw output`, `intermediate file`, `production file`, `project file`, `project archive`, `restart file`, `diagnostic`. Intermediate files should be filtered out before archiving (REQ-ARC-005).
- **`notes`** — Additional notes.

\* Each product must have exactly one of `dir` or `dir_pattern`, not both.

Additional product fields are allowed — different datasets may need domain-specific metadata (e.g. CMIP6 manifests use `experiment_id`, `realization`, `modules`).

## Local Validation

```bash
pip install -r requirements.txt
python scripts/validate_manifests.py           # errors fail, warnings are listed
python scripts/validate_manifests.py --strict  # warnings fail too
```

This runs the same checks as the CI pipeline on `manifests/` and `examples/`:

- **Errors** (SHALL requirements): the JSON Schema; `id` equals the file name and is unique; the single-person flag; duplicate product directories.
- **Warnings** (SHOULD requirements and housekeeping): open and overdue `TBD` placeholders, expired exceptions, legacy `/net/isilon` locations, archived data outside `/dmidata/archive/<discipline>/`, missing checksums, intermediate products in an archive, gzip compression, missing retention rationale, entries not reviewed for a year.
- **Info**: for `proposed` entries, the fields still needed to register.
