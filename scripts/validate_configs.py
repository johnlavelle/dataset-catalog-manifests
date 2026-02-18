#!/usr/bin/env python3
"""Validate all dataset config YAML files against the JSON Schema.

Runs as part of GitLab CI to catch errors before merge.
Can also be run locally: python scripts/validate_configs.py
"""

import glob
import json
import re
import sys
from pathlib import Path

import jsonschema
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "schemas" / "dataset_config.schema.json"
CONFIGS_GLOB = str(REPO_ROOT / "configs" / "*.yaml")


def load_schema():
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def validate_config(path, schema):
    """Validate a single config file. Returns list of error strings."""
    errors = []
    name = Path(path).name

    # Load YAML
    try:
        with open(path) as f:
            config = yaml.safe_load(f)
    except yaml.YAMLError as e:
        return [f"YAML parse error: {e}"]

    if config is None:
        return ["File is empty"]

    # JSON Schema validation
    try:
        jsonschema.validate(instance=config, schema=schema)
    except jsonschema.ValidationError as e:
        errors.append(f"Schema: {e.message} (at {'.'.join(str(p) for p in e.absolute_path)})" if e.absolute_path else f"Schema: {e.message}")

    # Extra checks on file_patterns
    patterns = config.get("file_patterns", [])
    labels = []
    for i, pat in enumerate(patterns):
        label = pat.get("label", f"<index {i}>")
        regex = pat.get("regex")

        # Check regex compiles
        if regex:
            try:
                re.compile(regex)
            except re.error as e:
                errors.append(f"Pattern '{label}': invalid regex: {e}")

        # Collect labels for duplicate check
        if "label" in pat:
            labels.append(pat["label"])

    # Check for duplicate labels
    seen = set()
    for label in labels:
        if label in seen:
            errors.append(f"Duplicate label: '{label}'")
        seen.add(label)

    # Check stac.products keys reference existing labels
    stac_products = config.get("stac", {}).get("products", {})
    if stac_products:
        label_set = set(labels)
        for key in stac_products:
            if key not in label_set:
                errors.append(f"stac.products key '{key}' is not a file_patterns label")

    return errors


def main():
    schema = load_schema()
    config_files = sorted(glob.glob(CONFIGS_GLOB))

    if not config_files:
        print("No config files found in configs/")
        sys.exit(1)

    all_ok = True
    for path in config_files:
        name = Path(path).name
        errors = validate_config(path, schema)
        if errors:
            print(f"FAIL  {name}")
            for err in errors:
                print(f"      {err}")
            all_ok = False
        else:
            print(f"OK    {name}")

    if not all_ok:
        sys.exit(1)

    print(f"\nAll {len(config_files)} config(s) valid.")


if __name__ == "__main__":
    main()
