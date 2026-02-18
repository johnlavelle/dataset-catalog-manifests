# Dataset Catalog Configs

Dataset configuration files for the [DMI data archiving tools](https://gitlab.dmi.dk/jola/data-archiving-info). Each YAML config describes a dataset and its products — what data exists and where it lives.

Dataset owners submit configs here via merge requests — no need to modify the tooling repo.

## Adding a New Dataset

1. Copy an existing config (e.g. `configs/balmfc.yaml`) or start from the minimal example below
2. Edit the fields for your dataset
3. Run validation locally (see below)
4. Submit a merge request

### Minimal Example

```yaml
dataset:
  name: "My Dataset"
  path: "/path/to/dataset"

products:
  daily_temperature:
    name: "Daily Temperature"
    dir: "daily_temperature"
    category: "Physics"
```

## Config Format

See [`schemas/dataset_config.schema.json`](schemas/dataset_config.schema.json) for the full specification.

### Required Fields

| Field | Description |
|-------|-------------|
| `dataset.name` | Human-readable dataset name |
| `dataset.path` | Absolute path to the dataset on the filesystem |
| `products` | Map of product key to metadata — each product has a `name` and `dir` |

### Optional Fields

| Field | Description |
|-------|-------------|
| `dataset.model` | Model system name (e.g. "NEMO", "WAM") |
| `dataset.domain` | Geographic domain (e.g. "North Sea - Baltic Sea") |
| `stac` | STAC catalog metadata: `institution`, `purpose`, `dois`, etc. |

### Products

Each entry in `products` has:
- **`name`** (required) — Human-readable product name.
- **`dir`** (required) — Subdirectory under `dataset.path` containing this product's files.
- **`category`** — Grouping category (e.g. "Physics", "Biogeochemistry", "Ice").
- **`model_component`** — Model component (e.g. "NEMO", "ERGOM", "SI3").
- **`domain`** — Geographic domain for this product.
- **`type`** — Product type (e.g. "final product", "original output", "intermediate file").
- **`compression_precision`** — Compression and precision details.
- **`notes`** — Additional notes.

Each product lives in its own subdirectory. The directory is the product identifier — no file patterns or regex needed.

## Local Validation

```bash
pip install -r requirements.txt
python scripts/validate_configs.py
```

This runs the same checks as the CI pipeline: schema validation and duplicate directory detection.
