# Dataset Catalog Manifests

Dataset manifest files for the [DMI data archiving tools](https://gitlab.dmi.dk/jola/data-archiving-info). Each YAML manifest describes a dataset and its products — what data exists and where it lives.

Dataset owners submit manifests here via merge requests — no need to modify the tooling repo.

## Adding a New Dataset

1. Copy an existing manifest (e.g. `manifests/balmfc.yaml`) or start from the minimal example below
2. Edit the fields for your dataset
3. Run validation locally (see below)
4. Submit a merge request

### Minimal Example

```yaml
dataset:
  name: "My Dataset"
  path: "/path/to/dataset"
  contact: "Name <email@dmi.dk>"

products:
  daily_temperature:
    name: "Daily Temperature"
    dir: "daily_temperature"
    category: "Physics"
    type: "final product"
```

## Manifest Format

See [`schemas/dataset_manifest.schema.json`](schemas/dataset_manifest.schema.json) for the full specification.

### Required Fields

| Field | Description |
|-------|-------------|
| `dataset.name` | Human-readable dataset name |
| `dataset.path` | Absolute path to the dataset on the filesystem |
| `products` | Map of product key to metadata — each product has a `name` and either `dir` or `dir_pattern` |

### Optional Fields

| Field | Description |
|-------|-------------|
| `dataset.model` | Model system name (e.g. "NEMO", "WAM") |
| `dataset.domain` | Geographic domain (e.g. "North Sea - Baltic Sea") |
| `dataset.contact` | Person responsible (e.g. "Name \<email@dmi.dk\>") |
| `dataset.description` | Brief description of the dataset contents and purpose |
| `stac` | STAC catalog metadata: `institution`, `purpose`, `dois`, etc. |

### Products

Each entry in `products` has:
- **`name`** (required) — Human-readable product name.
- **`dir`** (required\*) — Literal subdirectory name under `dataset.path` containing this product's files.
- **`dir_pattern`** (required\*) — Shell glob pattern matching multiple subdirectories (e.g. `n[0-9][0-9][0-4]`). Use instead of `dir` when a product spans many directories with a naming convention.
- **`category`** — Grouping category. Common values: `Physics`, `Biogeochemistry`, `Ice`, `Observations`, `Assimilation`, `Waves`, `Atmospheric`. Climate datasets may use activity names (`DECK`, `CMIP`, `ScenarioMIP`, `DCPP`).
- **`model_component`** — Model component (e.g. "NEMO", "ERGOM", "SI3").
- **`domain`** — Geographic domain for this product.
- **`type`** — Product type. Must be one of: `final product`, `original output`, `raw output`, `intermediate file`, `production file`, `project file`, `project archive`, `restart file`, `diagnostic`.
- **`notes`** — Additional notes.

\* Each product must have exactly one of `dir` or `dir_pattern`, not both.

Additional fields are allowed — different datasets may need domain-specific metadata (e.g. CMIP6 manifests use `experiment_id`, `realization`, `modules`).

## Local Validation

```bash
pip install -r requirements.txt
python scripts/validate_manifests.py
```

This runs the same checks as the CI pipeline: schema validation and duplicate directory detection.
