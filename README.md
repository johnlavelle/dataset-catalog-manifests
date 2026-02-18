# Dataset Catalog Configs

Dataset configuration files for the [DMI data archiving tools](https://gitlab.dmi.dk/jola/data-archiving-info). Each YAML config describes a dataset's file patterns, metadata, and catalog settings.

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

file_patterns:
  - regex: 'output_(\d{8})\.nc$'
    label: "output_YYYYMMDD.nc"
    category: "Physics"
```

## Config Format

See [`schemas/dataset_config.schema.json`](schemas/dataset_config.schema.json) for the full specification.

### Required Fields

| Field | Description |
|-------|-------------|
| `dataset.name` | Human-readable dataset name |
| `dataset.path` | Absolute path to the dataset on the filesystem |
| `file_patterns` | List of `{regex, label, category}` dicts defining file groups |

### Optional Sections

| Section | Description |
|---------|-------------|
| `dataset.model` | Model system name (e.g. "NEMO", "WAM") |
| `dataset.domain` | Geographic domain (e.g. "North Sea - Baltic Sea") |
| `stac` | STAC catalog metadata: `institution`, `purpose`, `products`, `dois`, etc. |

### File Patterns

Each entry in `file_patterns` has:
- **`regex`** — Python regex matching filenames. Date groups use `(\d{8})` for YYYYMMDD.
- **`label`** — Human-readable label with dates replaced by `YYYYMMDD`.
- **`category`** — Grouping category (e.g. "Physics", "Biogeochemistry", "Ice").

Order matters: more specific patterns must come before generic catch-alls.

## Local Validation

```bash
pip install -r requirements.txt
python scripts/validate_configs.py
```

This runs the same checks as the CI pipeline: schema validation, regex compilation, duplicate detection, and cross-reference checks.
