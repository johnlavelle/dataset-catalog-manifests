# Dataset Catalog Manifests

A dataset catalogue as YAML files, with a schema, a validator and a web editor. Each dataset has one YAML manifest, `manifests/<id>.yaml`: its catalogue entry as required by a Storage and Archiving Standard (v1.0, §4) — what the dataset is, who is responsible for it, how long it is kept, under which licence, and, once it is on tape, how it was appraised and prepared. References such as `REQ-CAT-004`, `Policy §7` or `Procedure C.7` point into that Policy, Standard, Procedures and Guidelines document set.

Dataset stewards add and update manifests through pull or merge requests. `examples/` holds only a fictional example; real entries go in `manifests/`.

## Adding a New Dataset

1. Write the manifest in one of three ways:
   - **Web editor** — fill in the [form](https://johnlavelle.github.io/dataset-catalog-manifests/). It shows what is mandatory for the chosen status, explains each section, keeps a checklist, and lists the steps for the chosen stage (e.g. packaging data as squashfs for the archive).
   - **AI assistant** — the editor's **AI prompt** button downloads `dataset-manifest-prompt.md`. Upload it unchanged to an AI assistant and send "Start"; it interviews you a few questions at a time and ends with the YAML, and can explain the work behind each status (the same steps as the editor's Steps tab). In a command-line assistant (e.g. Claude Code), copy the downloaded file into your clone of this repository (it is git-ignored) and run `claude "Follow the instructions in dataset-manifest-prompt.md"` there; it can then look at the dataset directory itself, write `manifests/<id>.yaml` and run the validator. Tick *Include the current form* to have it complete a half-filled form.
   - **By hand** — copy [`examples/example-archived.yaml`](examples/example-archived.yaml).
2. Save it as `manifests/<id>.yaml` — the file name must equal the manifest's `id`. (In the editor, *Open* loads a file and the YAML tab shows and downloads the result.)
3. Run validation locally (see below).
4. Submit a pull request; the Data Owner approves it (Procedure A.7).

### Minimal Example

A new entry starts as `proposed` and only needs the basics:

```yaml
id: my-dataset
status: proposed

dataset:
  name: "My Dataset"
  path: "/data/projects/my_project/my_dataset"
  description: "What the dataset contains and why it exists."

parts:
  daily_temperature:
    name: "Daily Temperature"
    dir: "daily_temperature"
    category: "Physics"
    type: "final product"
```

While an entry is `proposed`, `dataset.path` is the proposed path: where the dataset will live once registered. If the data is somewhere else now, give that as `dataset.legacy_path`.

To register it, set `status: active` and add the roles, retention, licence, identifiers, links and release date. See [`examples/example-archived.yaml`](examples/example-archived.yaml) for a complete entry.

## Manifest Format

See [`schemas/dataset_manifest.schema.json`](schemas/dataset_manifest.schema.json) for the full specification. Add `# yaml-language-server: $schema=../schemas/dataset_manifest.schema.json` as the first line to get validation and completion in VS Code.

### What is mandatory depends on the status and on tape

The `status` follows the dataset lifecycle in Standard §4: `proposed → active → deprecated → deleted`, plus `withdraw` (proposed → deleted) and `restore` (deprecated → active).

Being on tape is not a status but a switch, `dataset.on_tape`, read with the status: while `proposed` the data **will go to** tape, while `active` or `deprecated` it **is on** tape, and once `deleted` it **was on** tape. The editor labels the switch accordingly. The Standard's Figure 1 has an `archived` state ("on tape") between active and deprecated, and Procedure C.7 sets it together with the final location; here that is an `active` (or `deprecated`) entry with `on_tape: true`, whose `dataset.path` is the archive directory. Until the data has been written there, the location stays where the data is; C.7 then makes the archive directory the location, the old path `dataset.legacy_path`, and turns the switch on.

Legacy storage is never a proposed path: data there is to be kept elsewhere or deleted (Policy §7), so while an entry is `proposed` its location is where the data is to go and the legacy area is its `dataset.legacy_path`. Until it is decided where the data goes, a `proposed` (or withdrawn, `deleted`) entry may have only `dataset.legacy_path`: `dataset.path` is required to register.

| Status | Mandatory fields |
|--------|------------------|
| any | `id`, `status`, `dataset.name`, `dataset.path` (while `proposed` or `deleted`, `dataset.legacy_path` may stand in for it), `dataset.description`, `parts` (at least one) |
| `active`, `deprecated` | `dataset.path`, `roles.owner`, `roles.steward`, `roles.custodian`, `retention.kind` (+ `until` / `condition` / `rationale`), `license.id`, `identifiers.pid`, `links.metadata`, `links.archiving_guide`, `dates.released` |
| `active`, `deprecated` with `dataset.on_tape: true` | additionally `appraisal` (`lasting_value`, `users`, `regenerable`, `approved_by`, `approved_on`), `storage.formats`, `storage.compression` (each at least one value; `none` for uncompressed data), `archiving.quality_verified_on`, `dates.archived`; **no `TBD` placeholders** (REQ-ARC-001) |
| `deleted` | `deletion.date`, `deletion.approved_by` — the entry is kept, never removed (REQ-CAT-007) |

Conditional rules that apply at any status:

| When | Then also required |
|------|--------------------|
| `dataset.on_tape: true` | `storage.tier`, if set, is `archive` |
| `retention.kind: date` / `condition` / `indefinite` | `retention.until` / `retention.condition` / `retention.rationale` |
| `license.id: restricted` | `license.reason`, `license.decided_by` (REQ-LIC-002) |
| `storage.lossy: true` | `storage.lossy_settings`, `storage.lossy_approved_by` (REQ-FMT-003) |
| `other` among `storage.formats` / `storage.compression` | `storage.format_notes` / `storage.compression_settings` naming it |
| `archiving.automated: true` | `archiving.pipeline`, `archiving.owning_team` (REQ-OPS-002) |
| `storage.tier: third_party` | `links.contract` (REQ-TPY-003) |
| Owner, Steward and Custodian are the same person | `roles.single_person: true` (Standard §3) |
| `registry/owners.yaml` lists approved Data Owners | `roles.owner` is one of them (not checked for deleted entries) |

### Placeholders

Facts and links that are not known yet (`identifiers.pid`, `identifiers.doi`, `links.*`, `dates.released`, `archiving.pipeline`) may be written as `"TBD by YYYY-MM-DD"` (Procedure A.5). The validator lists them and flags overdue ones. Decisions — roles, retention, licence — cannot be postponed, and no placeholder may remain once a registered dataset is on tape.

### Conventions

- **People**: `"Full Name <name@example.com>"` (a team name and mailbox is fine for the Custodian). The Data Owner must be on the approved list once it has entries (below).
- **Dates**: ISO 8601, quoted — `"2024-05-22"`.
- **Locations**: `dataset.path`, `dataset.legacy_path` and `storage.secondary_locations` are a directory, typed in full: an absolute path without a trailing slash and without empty, `.` or `..` parts (`/data/archive/ocean/my_model`), `host:/path` on another server, or a URL (`scheme://…`) for a database or external store. The schema (`definitions.location`) checks the form; whether the directory exists is not checked. A part's `dir` and `dir_pattern` are relative to `dataset.path` (or, while an entry has none, to `dataset.legacy_path`), without a slash at either end, so a scan of the file system (e.g. for a STAC catalogue) can join them as written. The editor labels `dataset.path` *Location (proposed path)* and `legacy_path` *Existing location* while the entry is proposed, and *Location (primary path)* and *Legacy location* once registered: the legacy location keeps the trail from the old path to the new one (Guidelines §9.3).
- **Clean values**: no spaces or line breaks at the start or end of any value — write multi-line text as `>-` (or `|-`), not `>`, which keeps a final line break — and DOIs bare (`10.48670/moi-00013`, not a `https://doi.org/` link). The editor trims a field when you leave it and removes a pasted DOI link prefix.
- **Only what applies**: a field that belongs to another choice is not stored, and CI refuses it — `retention.until` only with kind `date`, `retention.condition` only with `condition`, `license.reason` only with `restricted` or `internal`, `license.decided_by` only with `restricted`, the `lossy_*` fields only with `lossy: true`, `archiving.pipeline` and `owning_team` only with `automated: true`, and `roles.single_person` only when the three roles name the same person. In the editor, changing the choice hides such fields; changing it back in the same session brings back what was typed.
- **Formats, containers, compression** are separate lists: yearly squashfs images of zstd-compressed netCDF and PNG files are `formats: [netCDF, image]`, `containers: [squashfs]`, `compression: [zstd]`. A GRIB edition, conventions or a format the list lacks go in `format_notes`; tool options in `compression_settings`. Files and editor drafts from before these lists (free-text `format` and `compression`, and `dataset.contact`) still open in the editor: the old text moves to `format_notes`, `compression_settings` and `extensions.contact`.
- **Older manifests** with a status `archived`, a `tape` section or a `products` section still open in the editor: `status: archived` becomes `status: active` with `dataset.on_tape: true`, a `tape` section with `archived: true` becomes the switch, and `products` becomes `parts`. CI refuses the old forms and says what to change.
- **DOIs**: `identifiers.doi` is this dataset's own DOI (DataCite, REQ-CAT-009). DOIs of other things — a Copernicus Marine product published from the data, a paper describing it, its input data — go in `identifiers.related` as `doi`, `title` (what it is) and optionally `relation`. Files and drafts with the former `stac` section still open in the editor: its `dois` become related DOIs titled with their product codes, `model_system` fills an empty `dataset.model`, and anything else moves to `extensions.stac`.
- **No comments**: the web editor does not keep YAML comments, so put notes in fields — `designated_community_notes`, a part's `notes`, or `extensions`.
- **Enumerations**: `license.id` — `CC-BY-4.0`, `CC0-1.0`, `WMO-UDP-core`, `WMO-UDP-recommended`, `internal`, `restricted`; `identifiers.related[].relation` (DataCite relation types) — `IsSourceOf`, `IsVariantFormOf`, `IsDescribedBy`, `IsDerivedFrom`, `IsCitedBy`; `storage.tier` — `project_space`, `archive`, `database`, `third_party`, `legacy`; `storage.formats` (list) — `netCDF`, `GRIB`, `BUFR`, `Zarr`, `HDF5`, `GeoTIFF`, `Parquet`, `CSV`, `text`, `shapefile`, `image`, `scripts`, `binary`, `other`; `storage.containers` (list) — `squashfs`, `tar`, `zip`; `storage.compression` (list) — `none`, `zstd`, `xz`, `zlib`, `gzip`, `ccsds`, `other`; `appraisal.users` — `staff`, `wmo_nmhs`, `copernicus`, `national_researchers`, `public`; `appraisal.regenerable` — `impossible`, `expensive`, `cheap`.

### Sections

| Section | Contents |
|---------|----------|
| `dataset` | Title, primary location (the proposed path while proposed), legacy location, the tape switch, description; optional model and domain |
| `roles` | Data Owner, Data Steward, Data Custodian (Standard §3) |
| `retention` | Retain until a date, a condition, or indefinitely — with rationale (REQ-RET-001) |
| `license` | Licence and, for restricted data, the reason and decision-maker (REQ-LIC-001/002) |
| `identifiers` | Local PID (REQ-CAT-008), the dataset's own DOI (REQ-CAT-009), DOIs of related works |
| `links` | Metadata page, archiving guide, supplier contract |
| `dates` | Release, archiving, planned deletion, last review, last update |
| `storage` | Tier, file formats, containers, compression and its settings, lossy settings, secondary locations, checksums |
| `appraisal` | Why it has lasting value, who will use it, whether it can be regenerated, obligations, Owner's approval (REQ-APP-001–004) |
| `archiving` | Quality check date, aggregation, automated archiving job and owning team |
| `deletion` | Deletion date, approver, reference, national archives authorisation |
| `designated_community_notes` | Anything a future user needs to interpret the data |
| `exceptions` | Registered exceptions (`id`, `requirement`, `expires`, `note`) |
| `extensions` | Free-form information with no field of its own — any keys and values (text, lists, mappings). Not checked; use the defined fields, a part's `notes` or `designated_community_notes` where they fit |
| `parts` | Map of part key to metadata (below) |

Apart from `extensions` and part entries, only the fields defined in the schema are allowed.

### Parts

The parts of a dataset are the directories, files or families of directories users think of separately. Each entry in `parts` has:
- **`name`** (required) — Human-readable name of the part.
- **`dir`** (required\*) — Path relative to `dataset.path` (or, while an entry has none, to `dataset.legacy_path`) holding the part: usually a sub-directory, but a nested path (`v0.6.0/analysis.zarr`) or a single file or container (`.sqfs` image, Zarr store) also works.
- **`dir_pattern`** (required\*) — Shell glob pattern matching multiple subdirectories (e.g. `n[0-9][0-9][0-4]`). Use instead of `dir` when a part spans many directories with a naming convention.
- **`category`** — Grouping category. Common values: `Physics`, `Biogeochemistry`, `Ice`, `Observations`, `Assimilation`, `Waves`, `Atmospheric`. Climate datasets may use activity names (`DECK`, `CMIP`, `ScenarioMIP`, `DCPP`).
- **`model_component`** — Model component (e.g. "NEMO", "ERGOM", "SI3").
- **`domain`** — Geographic domain for this part.
- **`type`** — Role of the part in the processing chain. Must be one of: `final product`, `original output`, `raw output`, `intermediate file`, `production file`, `project file`, `project archive`, `restart file`, `diagnostic`. Intermediate files should be filtered out before archiving (REQ-ARC-005).
- **`notes`** — Additional notes.

\* Each part must have exactly one of `dir` or `dir_pattern`, not both.

Additional part fields are allowed — different datasets may need domain-specific metadata (e.g. CMIP6 manifests use `experiment_id`, `realization`, `modules`).

### STAC catalogue

A manifest holds what only people know. A STAC catalogue can be generated from it plus a scan of the files, so there is nothing STAC-specific to fill in by hand. The mapping a generator follows:

| STAC Collection | From |
|-----------------|------|
| `id`, `title`, `description` | `id`, `dataset.name`, `dataset.description` |
| `license` | `license.id` — `CC-BY-4.0` and `CC0-1.0` are SPDX ids; anything else is `other`, with a link to the metadata page |
| `providers` | your organisation as producer and host |
| `keywords` | `dataset.model`, `dataset.domain` |
| `sci:doi`, `sci:citation`, `cite-as` link | `identifiers.doi` |
| `sci:publications`, `related` links | `identifiers.related` |
| `describedby` link | `links.metadata` |
| Items, one per part | `parts` — `dir` / `dir_pattern` say which files to scan; `name`, `category`, `type` describe them |
| `extent` (bounding box, time span), variables, file counts and sizes | the scan |

A scan reads `dataset.path`; for a proposed or deleted entry without one, it falls back to `dataset.legacy_path`. Only if a scan cannot find something a catalogue needs (a dataset in binary files, say) does the manifest need a new field for it.

## Approved Data Owners

[`registry/owners.yaml`](registry/owners.yaml) lists the people who may be Data Owner (`name`, `email`, optional `unit`). While it is empty the check is off. Once it has entries:

- CI fails a manifest whose `roles.owner` is not on the list (matched by e-mail, ignoring case). Deleted entries and `examples/` are exempt.
- The web editor offers the list as a dropdown for the Owner, and the AI prompt includes it.
- Removing someone fails CI until their datasets have a new Owner, so reassign them in the same pull request.

Who may be Owner is the project group's decision: the Guidelines (§11) say "usually a project lead, research group head or product owner"; a stricter rule is set by whom you list. Changing the list redeploys the editor.

**Note:** the Pages site is public, so names and addresses on the list are published there.

## Local Validation

```bash
pip install -r requirements.txt
python scripts/validate_manifests.py           # errors fail, warnings are listed
python scripts/validate_manifests.py --strict  # warnings fail too
```

This runs the same checks as CI on `manifests/` and `examples/`:

- **Errors** (SHALL requirements): the JSON Schema (including fields that belong to another choice and the form of locations; old manifests with `status: archived` or `products` are told what to change); `id` equals the file name and is unique; the single-person flag, set exactly when the three roles name the same person; spaces at the start or end of a value; duplicate part directories; the Owner is an approved Data Owner (when `registry/owners.yaml` has entries); a malformed owners list.
- **Warnings** (SHOULD requirements and housekeeping): open and overdue `TBD` placeholders, expired exceptions, missing checksums and intermediate parts once a registered entry is on tape, tier `archive` without the tape switch, a part's leftover `archive_path`, gzip compression, `binary` or `other` formats on tape (check they are open and documented), missing retention rationale, entries not reviewed for a year.
- **Info**: for `proposed` entries, the fields still needed to register.

### Web editor compatibility

Every manifest must also open in the web editor and save back without losing data. CI checks this with the editor's own code; run it locally with:

```bash
cd web && npm ci
npm run check:manifests              # fails on data loss or errors the editor would show
npm run check:manifests -- --write   # also rewrite files in the editor's exact format
```

It also reports comments (which the editor drops) and formatting that differs from what the editor writes. Those only produce notes, so hand-written files pass, but files in the editor's format give clean diffs when someone later edits them in the editor.

## Repository Layout

| Path | Contents |
|------|----------|
| `manifests/` | The catalogue: one entry per dataset, `<id>.yaml` (create it with your first entry) |
| `examples/` | A complete, fictional entry on tape, loaded by the editor's *Example* button (validated by CI, exempt from the Owner check) |
| `schemas/` | The JSON Schema for manifests |
| `registry/` | `owners.yaml` — the approved Data Owners |
| `scripts/` | `validate_manifests.py` — the CI validator |
| `web/` | The web editor (React, TypeScript, [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/)); `web/scripts/check-manifests.ts` is the editor compatibility check |

## Web Editor

The editor renders the form from the JSON Schema and adds the guidance from the document set, requirements that depend on the status and on the tape switch, a checklist, the steps for each lifecycle stage (from the Procedures, with commands filled in from the manifest; practical tips are marked as such), YAML import and export, and the AI prompt. A guided tour of the screen starts by itself the first time the editor is opened in a browser with nothing saved, and again from the flag button in the toolbar or the About page. It runs entirely in the browser; nothing is sent anywhere. Every manifest edited is kept in the browser's local storage as you type and listed under *Recent*, so opening another one loses nothing; the list belongs to that browser and address only, and browsers may clear it, so a manifest is kept for good by downloading it and submitting it.

```bash
cd web
npm ci
npm run dev      # http://localhost:5173
npm run build    # type-check and build to web/dist
npm run check:robustness   # malformed manifests must not crash the editor
```

Bad input never leaves a blank page:
- **Import:** a file or pasted YAML whose sections have the wrong shape (a list where `dataset:` should be key–value lines, a part that is plain text) is refused with a message naming the fields.
- **Field values:** wrong values, such as an unknown status or a number where text belongs, load and are listed as errors in the checklist.
- **Recovery:** if the form still cannot show a draft, it offers to download the draft or start a new one; the draft stays under *Recent*.

Fields that parts share need not be filled in one card at a time. With two or more parts, a bar above the list sets Type, Category, Model component or Domain on the parts ticked in the list: *All* ticks every part, or unticks them all, and *Only empty values* leaves the parts that already have a value as they are. Replacing values says how many and can be undone until the next edit. The value is written to each part, so the YAML stays the same as if it had been typed in each card. A new part starts with the Category, Model component and Domain all the others share; Type is left to choose.

`check:robustness` replaces each field of the example with values of the wrong type and renders the editor with every variant, and checks the rules of the bulk change above, the conversion of older manifests and drafts, that the editor, the schema and the steps agree on when the archive rules apply (the tape switch with the status), and which locations the schema accepts as a directory.

A manifest can have many parts, and an edit must stay quick whatever their number. So that an edit redraws only the field it changes, nothing that does not change may reach a field as a new value: a widget gets the single values it needs from elsewhere in the manifest through `ui:options` (`uiSchema.ts`), and never the manifest itself. A closed part card holds no fields, and the form validates through `formValidator.ts`, which explains how rjsf's own validator would otherwise recompile the schema on every keystroke. `check:robustness` compares what `formValidator.ts` reports with rjsf's validator, on every variant above and every manifest.

## CI and deployment

[`.github/workflows/validate.yml`](.github/workflows/validate.yml) runs the validator, the editor compatibility check and the build on every push and pull request. The editor is deployed from `main` to GitHub Pages by [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) whenever `web/`, `schemas/`, `examples/` or `registry/` change.
