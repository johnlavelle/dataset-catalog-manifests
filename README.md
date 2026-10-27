# Dataset Catalog Manifests

This repository is DMI's dataset catalogue. Each dataset has one YAML manifest, `manifests/<id>.yaml`: its catalogue entry as required by the DMI Storage and Archiving Standard (STD-STOR-ARCH-001 v1.0, §4) — what the dataset is, who is responsible for it, how long it is kept, under which licence, and, once archived, how it was appraised and prepared.

Dataset stewards add and update manifests through merge requests. `examples/` holds only a fictional example; real entries always go in `manifests/`.

## Adding a New Dataset

1. Write the manifest in one of three ways:
   - **Web editor** — fill in the [form](https://johnlavelle.github.io/dataset-catalog-manifests/). It shows what is mandatory for the chosen status, explains each section, keeps a checklist, and lists the steps for the chosen stage (e.g. packaging data as squashfs for the archive).
   - **AI assistant** — the editor's **AI prompt** button downloads `dataset-manifest-prompt.md`. Upload it unchanged to an AI assistant and send "Start"; it interviews you a few questions at a time and ends with the YAML, and can explain the work behind each status (the same steps as the editor's Steps tab). In a command-line assistant (e.g. Claude Code), copy the downloaded file into your clone of this repository (it is git-ignored) and run `claude "Follow the instructions in dataset-manifest-prompt.md"` there; it can then look at the dataset directory itself, write `manifests/<id>.yaml` and run the validator. Tick *Include the current form* to have it complete a half-filled form.
   - **By hand** — copy an existing manifest or [`examples/example-archived.yaml`](examples/example-archived.yaml).
2. Save it as `manifests/<id>.yaml` — the file name must equal the manifest's `id`. (In the editor, *Open* loads a file and the YAML tab shows and downloads the result.)
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
| `archived` | additionally `appraisal` (`lasting_value`, `users`, `regenerable`, `approved_by`, `approved_on`), `storage.wis2_discipline`, `storage.formats`, `storage.compression` (each at least one value; `none` for uncompressed data), `archiving.quality_verified_on`, `dates.archived`; `storage.tier`, if set, must be `archive`; **no `TBD` placeholders** (REQ-ARC-001) |
| `deleted` | `deletion.date`, `deletion.approved_by` — the entry is kept, never removed (REQ-CAT-007) |

Conditional rules that apply at any status:

| When | Then also required |
|------|--------------------|
| `retention.kind: date` / `condition` / `indefinite` | `retention.until` / `retention.condition` / `retention.rationale` |
| `license.id: restricted` | `license.reason`, `license.decided_by` (REQ-LIC-002) |
| `storage.lossy: true` | `storage.lossy_settings`, `storage.lossy_approved_by` (REQ-FMT-003) |
| `other` among `storage.formats` / `storage.compression` | `storage.format_notes` / `storage.compression_settings` naming it |
| `archiving.automated: true` | `archiving.pipeline`, `archiving.owning_team` (REQ-OPS-002) |
| `storage.tier: third_party` | `links.contract` (REQ-TPY-003) |
| Owner, Steward and Custodian are the same person | `roles.single_person: true` (Standard §3) |
| `registry/owners.yaml` lists approved Data Owners | `roles.owner` is one of them (not checked for deleted entries) |

### Placeholders

Facts and links that are not known yet (`identifiers.pid`, `identifiers.doi`, `links.*`, `dates.released`, `archiving.pipeline`) may be written as `"TBD by YYYY-MM-DD"` (Procedure A.5). The validator lists them and flags overdue ones. Decisions — roles, retention, licence — cannot be postponed, and no placeholder may remain once a dataset is archived.

### Conventions

- **People**: `"Full Name <name@dmi.dk>"` (a team name and mailbox is fine for the Custodian). The Data Owner must be on the approved list once it has entries (below).
- **Dates**: ISO 8601, quoted — `"2024-05-22"`.
- **Locations**: `dataset.path` and `storage.secondary_locations` are an absolute path without a trailing slash (`/dmidata/archive/ocean/nemo`), `host:/path` on another server (`skyr.dmi.dk:/automount/ymerdata`), or a URL (`scheme://…`) for a database or external store. A product's `dir` and `dir_pattern` are relative to `dataset.path`, without a slash at either end, so a scan of the file system (e.g. for a STAC catalogue) can join them as written.
- **Clean values**: no spaces or line breaks at the start or end of any value, and DOIs bare (`10.48670/moi-00013`, not a `https://doi.org/` link). The editor trims a field when you leave it and removes a pasted DOI link prefix.
- **Only what applies**: a field that belongs to another choice is not stored, and CI refuses it — `retention.until` only with kind `date`, `retention.condition` only with `condition`, `license.reason` only with `restricted` or `DMI-internal`, `license.decided_by` only with `restricted`, the `lossy_*` fields only with `lossy: true`, `archiving.pipeline` and `owning_team` only with `automated: true`, and `roles.single_person` only when the three roles name the same person. In the editor, changing the choice hides such fields; changing it back in the same session brings back what was typed.
- **Formats, containers, compression** are separate lists: yearly squashfs images of zstd-compressed netCDF and PNG files are `formats: [netCDF, image]`, `containers: [squashfs]`, `compression: [zstd]`. A GRIB edition, conventions or a format the list lacks go in `format_notes`; tool options in `compression_settings`. Files and editor drafts from before these lists (free-text `format` and `compression`, and `dataset.contact`) still open in the editor: the old text moves to `format_notes`, `compression_settings` and `extensions.contact`.
- **DOIs**: `identifiers.doi` is this dataset's own DOI (DataCite, REQ-CAT-009). DOIs of other things — a Copernicus Marine product published from the data, a paper describing it, its input data — go in `identifiers.related` as `doi`, `title` (what it is) and optionally `relation`. Files and drafts with the former `stac` section still open in the editor: its `dois` become related DOIs titled with their product codes, `model_system` fills an empty `dataset.model`, and anything else moves to `extensions.stac`.
- **No comments**: the web editor does not keep YAML comments, so put notes in fields — `designated_community_notes`, a product's `notes`, or `extensions`.
- **Enumerations**: `license.id` — `CC-BY-4.0`, `CC0-1.0`, `WMO-UDP-core`, `WMO-UDP-recommended`, `DMI-internal`, `restricted`; `identifiers.related[].relation` (DataCite relation types) — `IsSourceOf`, `IsVariantFormOf`, `IsDescribedBy`, `IsDerivedFrom`, `IsCitedBy`; `storage.tier` — `project_space`, `archive`, `database`, `third_party`, `legacy`; `storage.wis2_discipline` — `atmospheric-composition`, `climate`, `cryosphere`, `hydrology`, `ocean`, `space-weather`, `weather`; `storage.formats` (list) — `netCDF`, `GRIB`, `BUFR`, `Zarr`, `HDF5`, `GeoTIFF`, `Parquet`, `CSV`, `text`, `shapefile`, `image`, `scripts`, `binary`, `other`; `storage.containers` (list) — `squashfs`, `tar`, `zip`; `storage.compression` (list) — `none`, `zstd`, `xz`, `zlib`, `gzip`, `ccsds`, `other`; `appraisal.users` — `dmi_staff`, `wmo_nmhs`, `copernicus`, `danish_researchers`, `public`; `appraisal.regenerable` — `impossible`, `expensive`, `cheap`.

### Sections

| Section | Contents |
|---------|----------|
| `dataset` | Title, primary location, description; optional model and domain |
| `roles` | Data Owner, Data Steward, Data Custodian (Standard §3) |
| `retention` | Retain until a date, a condition, or indefinitely — with rationale (REQ-RET-001) |
| `license` | Licence and, for restricted data, the reason and decision-maker (REQ-LIC-001/002) |
| `identifiers` | Local PID (REQ-CAT-008), the dataset's own DOI (REQ-CAT-009), DOIs of related works |
| `links` | Metadata page, archiving guide, supplier contract |
| `dates` | Release, archiving, planned deletion, last review, last update |
| `storage` | Tier, WIS2 discipline (one per archive folder, REQ-NAME-005), file formats, containers, compression and its settings, lossy settings, secondary locations, checksums |
| `appraisal` | Why it has lasting value, who will use it, whether it can be regenerated, obligations, Owner's approval (REQ-APP-001–004) |
| `archiving` | Quality check date, aggregation, automated archiving job and owning team |
| `deletion` | Deletion date, approver, reference, Rigsarkivet authorisation |
| `designated_community_notes` | Anything a future user needs to interpret the data |
| `exceptions` | Registered exceptions (`id`, `requirement`, `expires`, `note`) |
| `extensions` | Free-form information with no field of its own — any keys and values (text, lists, mappings). Not checked; use the defined fields, product `notes` or `designated_community_notes` where they fit |
| `products` | Map of product key to metadata (below) |

Apart from `extensions` and product entries, only the fields defined in the schema are allowed.

### Products

Each entry in `products` has:
- **`name`** (required) — Human-readable product name.
- **`dir`** (required\*) — Path relative to `dataset.path` holding the product: usually a sub-directory, but a nested path (`v0.6.0/analysis.zarr`) or a single file or container (`.sqfs` image, Zarr store) also works.
- **`dir_pattern`** (required\*) — Shell glob pattern matching multiple subdirectories (e.g. `n[0-9][0-9][0-4]`). Use instead of `dir` when a product spans many directories with a naming convention.
- **`category`** — Grouping category. Common values: `Physics`, `Biogeochemistry`, `Ice`, `Observations`, `Assimilation`, `Waves`, `Atmospheric`. Climate datasets may use activity names (`DECK`, `CMIP`, `ScenarioMIP`, `DCPP`).
- **`model_component`** — Model component (e.g. "NEMO", "ERGOM", "SI3").
- **`domain`** — Geographic domain for this product.
- **`type`** — Product type. Must be one of: `final product`, `original output`, `raw output`, `intermediate file`, `production file`, `project file`, `project archive`, `restart file`, `diagnostic`. Intermediate files should be filtered out before archiving (REQ-ARC-005).
- **`notes`** — Additional notes.

\* Each product must have exactly one of `dir` or `dir_pattern`, not both.

Additional product fields are allowed — different datasets may need domain-specific metadata (e.g. CMIP6 manifests use `experiment_id`, `realization`, `modules`).

### STAC catalogue

A manifest holds what only people know. A STAC catalogue is generated from it plus a scan of the files, so there is nothing STAC-specific to fill in by hand. The mapping a generator follows:

| STAC Collection | From |
|-----------------|------|
| `id`, `title`, `description` | `id`, `dataset.name`, `dataset.description` |
| `license` | `license.id` — `CC-BY-4.0` and `CC0-1.0` are SPDX ids; anything else is `other`, with a link to the metadata page |
| `providers` | DMI as producer and host |
| `keywords` | `storage.wis2_discipline`, `dataset.model`, `dataset.domain` |
| `sci:doi`, `sci:citation`, `cite-as` link | `identifiers.doi` |
| `sci:publications`, `related` links | `identifiers.related` |
| `describedby` link | `links.metadata` |
| Items, one per product | `products` — `dir` / `dir_pattern` say which files to scan; `name`, `category`, `type` describe them |
| `extent` (bounding box, time span), variables, file counts and sizes | the scan |

Only if a scan cannot find something a catalogue needs (a dataset in binary files, say) does the manifest need a new field for it.

## Approved Data Owners

[`registry/owners.yaml`](registry/owners.yaml) lists the people who may be Data Owner (`name`, `email`, optional `unit`). While it is empty the check is off. Once it has entries:

- CI fails a manifest whose `roles.owner` is not on the list (matched by e-mail, ignoring case). Deleted entries and `examples/` are exempt.
- The web editor offers the list as a dropdown for the Owner, and the AI prompt includes it.
- Removing someone fails CI until their datasets have a new Owner, so reassign them in the same merge request.

Who may be Owner is the project group's decision: the Guidelines (§11) say "usually a project lead, research group head or product owner"; a stricter rule, such as office managers only, is set by whom you list. Changing the list redeploys the editor.

**Note:** the GitHub mirror and its Pages site are public, so names and addresses on the list are published there. Host the editor on internal GitLab Pages before filling it in if that matters.

## Local Validation

```bash
pip install -r requirements.txt
python scripts/validate_manifests.py           # errors fail, warnings are listed
python scripts/validate_manifests.py --strict  # warnings fail too
```

This runs the same checks as the CI pipeline on `manifests/` and `examples/`:

- **Errors** (SHALL requirements): the JSON Schema (including fields that belong to another choice and the form of locations); `id` equals the file name and is unique; the single-person flag, set exactly when the three roles name the same person; spaces at the start or end of a value; duplicate product directories; the Owner is an approved Data Owner (when `registry/owners.yaml` has entries); a malformed owners list.
- **Warnings** (SHOULD requirements and housekeeping): open and overdue `TBD` placeholders, expired exceptions, legacy `/net/isilon` locations, archived data outside `/dmidata/archive/<discipline>/`, missing checksums, intermediate products in an archive, gzip compression, `binary` or `other` formats in the archive (check they are open and documented), missing retention rationale, entries not reviewed for a year.
- **Info**: for `proposed` entries, the fields still needed to register.

### Web editor compatibility

Every manifest must also open in the web editor and save back without losing data. CI checks this with the editor's own code (the `editor-compat` job); run it locally with:

```bash
cd web && npm ci
npm run check:manifests              # fails on data loss or errors the editor would show
npm run check:manifests -- --write   # also rewrite files in the editor's exact format
```

It also reports comments (which the editor drops) and formatting that differs from what the editor writes. Those only produce notes, so hand-written files pass, but files in the editor's format give clean diffs when someone later edits them in the editor. The manifests in this repository are kept in that format.

## Repository Layout

| Path | Contents |
|------|----------|
| `manifests/` | The catalogue: one entry per dataset, `<id>.yaml` |
| `examples/` | A complete, fictional archived entry, loaded by the editor's *Example* button (validated by CI, exempt from the Owner check) |
| `schemas/` | The JSON Schema for manifests |
| `registry/` | `owners.yaml` — the approved Data Owners |
| `scripts/` | `validate_manifests.py` — the CI validator |
| `web/` | The web editor (React, TypeScript, [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/)); `web/scripts/check-manifests.ts` is the editor compatibility check |

## Web Editor

The editor renders the form from the JSON Schema and adds the DMI guidance, status-dependent requirements, a checklist, the steps for each lifecycle stage (from the Procedures, with commands filled in from the manifest; practical tips from Confluence are marked as such), YAML import and export, and the AI prompt. It runs entirely in the browser; nothing is sent anywhere. Every manifest edited is kept in the browser's local storage as you type and listed under *Recent*, so opening another one loses nothing; the list belongs to that browser and address only, and browsers may clear it, so a manifest is kept for good by downloading it and submitting it.

```bash
cd web
npm ci
npm run dev      # http://localhost:5173
npm run build    # type-check and build to web/dist
npm run check:robustness   # malformed manifests must not crash the editor
```

Bad input never leaves a blank page:
- **Import:** a file or pasted YAML whose sections have the wrong shape (a list where `dataset:` should be key–value lines, a product that is plain text) is refused with a message naming the fields.
- **Field values:** wrong values, such as an unknown status or a number where text belongs, load and are listed as errors in the checklist.
- **Recovery:** if the form still cannot show a draft, it offers to download the draft or start a new one; the draft stays under *Recent*.

`check:robustness` (CI job `editor-robustness`) replaces each field of the example with values of the wrong type and renders the editor with every variant.

It is deployed from `main`: to GitHub Pages by [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), and to GitLab Pages by the `pages` job in [`.gitlab-ci.yml`](.gitlab-ci.yml) (default branch only). Both rebuild when `web/`, `schemas/`, `examples/` or `registry/` change.
