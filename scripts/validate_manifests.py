#!/usr/bin/env python3
"""Validate all dataset manifest YAML files against the JSON Schema.

Runs as part of GitLab CI to catch errors before merge.
Can also be run locally: python scripts/validate_manifests.py
"""

import glob
import json
import sys
from pathlib import Path

import jsonschema
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "schemas" / "dataset_manifest.schema.json"
MANIFESTS_GLOB = str(REPO_ROOT / "manifests" / "*.yaml")


def load_schema():
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def validate_manifest(path, schema):
    """Validate a single manifest file. Returns list of error strings."""
    errors = []

    # Load YAML
    try:
        with open(path) as f:
            manifest = yaml.safe_load(f)
    except yaml.YAMLError as e:
        return [f"YAML parse error: {e}"]

    if manifest is None:
        return ["File is empty"]

    # JSON Schema validation
    try:
        jsonschema.validate(instance=manifest, schema=schema)
    except jsonschema.ValidationError as e:
        errors.append(f"Schema: {e.message} (at {'.'.join(str(p) for p in e.absolute_path)})" if e.absolute_path else f"Schema: {e.message}")

    # Extra checks on products
    products = manifest.get("products", {})

    # Check for duplicate dir values
    dirs = []
    for key, product in products.items():
        d = product.get("dir")
        if d:
            dirs.append((key, d))

    seen_dirs = {}
    for key, d in dirs:
        if d in seen_dirs:
            errors.append(f"Duplicate dir '{d}' in products '{seen_dirs[d]}' and '{key}'")
        seen_dirs[d] = key

    return errors


def main():
    schema = load_schema()
    manifest_files = sorted(glob.glob(MANIFESTS_GLOB))

    if not manifest_files:
        print("No manifest files found in manifests/")
        sys.exit(1)

    all_ok = True
    for path in manifest_files:
        name = Path(path).name
        errors = validate_manifest(path, schema)
        if errors:
            print(f"FAIL  {name}")
            for err in errors:
                print(f"      {err}")
            all_ok = False
        else:
            print(f"OK    {name}")

    if not all_ok:
        sys.exit(1)

    print(f"\nAll {len(manifest_files)} manifest(s) valid.")


if __name__ == "__main__":
    main()
