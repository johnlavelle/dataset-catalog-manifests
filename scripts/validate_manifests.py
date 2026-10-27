#!/usr/bin/env python3
"""Validate all dataset manifest YAML files against the JSON Schema.

Runs as part of GitLab CI to catch errors before merge.
Can also be run locally: python scripts/validate_manifests.py

Errors (exit code 1) are breaches of SHALL requirements in the DMI Storage and
Archiving Standard that the schema or the cross-checks below can detect.
Warnings (printed, exit code 0 unless --strict) cover SHOULD requirements,
open "TBD by YYYY-MM-DD" placeholders and expired exceptions.
"""

import argparse
import copy
import datetime as dt
import glob
import json
import re
import sys
from pathlib import Path

import jsonschema
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "schemas" / "dataset_manifest.schema.json"
MANIFESTS_GLOB = str(REPO_ROOT / "manifests" / "*.yaml")
EXAMPLES_GLOB = str(REPO_ROOT / "examples" / "*.yaml")
OWNERS_PATH = REPO_ROOT / "registry" / "owners.yaml"

TBD_RE = re.compile(r"^TBD by (\d{4}-\d{2}-\d{2})$")
EMAIL_RE = re.compile(r"^[^<>@\s]+@[^<>@\s]+$")
PERSON_EMAIL_RE = re.compile(r"<([^<>@\s]+@[^<>@\s]+)>$")
ROLES = ("owner", "steward", "custodian")
LEGACY_PREFIX = "/net/isilon"
ARCHIVE_PREFIX = "/dmidata/archive/"


class StringDateLoader(yaml.SafeLoader):
    """SafeLoader that keeps unquoted dates (2024-05-22) as strings."""


StringDateLoader.yaml_implicit_resolvers = {
    first: [(tag, regexp) for tag, regexp in resolvers if tag != "tag:yaml.org,2002:timestamp"]
    for first, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def load_schema():
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def load_manifest(path):
    with open(path) as f:
        return yaml.load(f, Loader=StringDateLoader)


def load_owners(path=OWNERS_PATH):
    """E-mail addresses (lower case) of the approved Data Owners, and problems with the list itself.

    A missing file or an empty list switches the Owner check off.
    """
    if not path.exists():
        return set(), []
    try:
        with open(path) as f:
            data = yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        return set(), [f"YAML parse error: {e}"]
    entries = data.get("owners") if isinstance(data, dict) else None
    if entries is None:
        return set(), []
    if not isinstance(entries, list):
        return set(), ["'owners' must be a list"]
    emails, errors = set(), []
    for i, entry in enumerate(entries):
        if not isinstance(entry, dict) or not str(entry.get("name") or "").strip():
            errors.append(f"Entry {i + 1}: needs a name")
        email = entry.get("email") if isinstance(entry, dict) else None
        if not isinstance(email, str) or not EMAIL_RE.match(email):
            errors.append(f"Entry {i + 1}: needs an e-mail address (initials@dmi.dk)")
        else:
            emails.add(email.lower())
    return emails, errors


PATTERN_HINTS = {
    "person": "use 'Full Name <name@dmi.dk>'",
    "date": "use an ISO 8601 date, YYYY-MM-DD",
    "dateOrTbd": "use YYYY-MM-DD, or 'TBD by YYYY-MM-DD' if not yet known",
    "urlOrTbd": "use an http(s) link, or 'TBD by YYYY-MM-DD' if not yet known",
    "textOrTbd": "write 'TBD by YYYY-MM-DD' if not yet known",
    "location": "use an absolute path without a trailing slash (/dmidata/...), host:/path, or a URL (scheme://...)",
    "relativePath": "use a path relative to dataset.path, without a slash at the start or end",
}


def schema_message(error, schema):
    """Turn a jsonschema error into a readable message."""
    if error.validator == "not" and isinstance(error.instance, str) and error.instance.startswith("TBD"):
        return "TBD placeholders are not allowed once a dataset is archived (REQ-ARC-001)"
    if error.validator == "not" and isinstance(error.validator_value, dict):
        fields = error.validator_value.get("required", [])
        if set(fields) == {"dir", "dir_pattern"}:
            return "use either dir or dir_pattern, not both"
        if "else" in error.schema_path:
            return f"{', '.join(fields)} only applies to another choice: remove it, or change the choice it depends on"
    if error.validator == "required":
        return error.message.replace("is a required property", "is required")
    if error.validator == "pattern":
        for name, hint in PATTERN_HINTS.items():
            if schema["definitions"][name]["pattern"] == error.validator_value:
                return f"{error.instance!r}: {hint}"
    return error.message


def schema_errors(manifest, schema):
    validator = jsonschema.Draft7Validator(schema)
    errors = []
    for error in sorted(validator.iter_errors(manifest), key=lambda e: list(e.absolute_path)):
        path_str = ".".join(str(p) for p in error.absolute_path)
        suffix = f" (at {path_str})" if path_str else ""
        errors.append(f"Schema: {schema_message(error, schema)}{suffix}")
    return errors


def missing_for_registration(manifest, schema):
    """Required fields still missing before the entry could become 'active'."""
    candidate = copy.deepcopy(manifest)
    candidate["status"] = "active"
    # Empty sections make the nested required fields show up individually
    for section in ("roles", "retention", "license", "identifiers", "links", "dates"):
        candidate.setdefault(section, {})
    validator = jsonschema.Draft7Validator(schema)
    missing = []
    for error in validator.iter_errors(candidate):
        if error.validator == "required":
            prefix = ".".join(str(p) for p in error.absolute_path)
            for field in error.validator_value:
                if isinstance(error.instance, dict) and field not in error.instance:
                    missing.append(f"{prefix}.{field}" if prefix else field)
    return sorted(set(missing))


def iter_strings(obj, path=()):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from iter_strings(v, path + (str(k),))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from iter_strings(v, path + (str(i),))
    elif isinstance(obj, str):
        yield ".".join(path), obj


def parse_date(value):
    try:
        return dt.date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def cross_checks(path, manifest, today, owners=frozenset()):
    """Checks the JSON Schema cannot express. Returns (errors, warnings).

    owners: e-mail addresses of the approved Data Owners; empty switches that check off.
    """
    errors, warnings = [], []
    status = manifest.get("status")
    dataset = manifest.get("dataset") or {}
    roles = manifest.get("roles") or {}
    storage = manifest.get("storage") or {}
    products = manifest.get("products") or {}

    # REQ-CAT-003: the id is the stable key, and the file is named after it
    if manifest.get("id") and manifest["id"] != Path(path).stem:
        errors.append(f"id '{manifest['id']}' must match the file name ({Path(path).stem}.yaml)")

    # Standard §3: one person holding all three roles must be stated explicitly
    names = [roles.get(r) for r in ROLES]
    if all(names) and len(set(names)) == 1 and not roles.get("single_person"):
        errors.append("Owner, Steward and Custodian are the same person: set roles.single_person: true (Standard §3)")
    if roles.get("single_person") and all(names) and len(set(names)) > 1:
        errors.append("roles.single_person is set, but Owner, Steward and Custodian are not the same person: remove it")

    # Values are stored without surrounding spaces, so that they compare and join as written
    for field, value in iter_strings(manifest):
        if value != value.strip():
            if value.endswith("\n") and value.rstrip("\n") == value.strip():
                errors.append(f"{field}: ends with a line break — write the text as '>-' (or '|-') instead of '>' (or '|')")
            else:
                errors.append(f"{field}: remove the spaces or line breaks at the start or end")

    # Standard §3.1: the Owner is one of the approved Data Owners (the examples are fictional,
    # and a deleted entry keeps the Owner who approved the deletion)
    owner = roles.get("owner")
    is_example = Path(path).resolve().parent.name == "examples"
    if owners and owner and status != "deleted" and not is_example:
        m = PERSON_EMAIL_RE.search(str(owner))
        if not m or m.group(1).lower() not in owners:
            errors.append(f"Data Owner '{owner}' is not on the list of approved Data Owners ({OWNERS_PATH.relative_to(REPO_ROOT)})")

    # Duplicate literal product directories
    seen_dirs = {}
    for key, product in products.items():
        d = product.get("dir") if isinstance(product, dict) else None
        if d:
            if d in seen_dirs:
                errors.append(f"Duplicate dir '{d}' in products '{seen_dirs[d]}' and '{key}'")
            seen_dirs[d] = key

    # Procedure A.5: TBD placeholders carry a due date
    for field, value in iter_strings(manifest):
        m = TBD_RE.match(value)
        if m:
            due = parse_date(m.group(1))
            overdue = " — OVERDUE" if due and due < today else ""
            warnings.append(f"{field} is a placeholder ({value}){overdue}")

    # REQ-EXC-003: expired exceptions are findings
    for exc in manifest.get("exceptions") or []:
        expires = parse_date(exc.get("expires"))
        if expires and expires < today:
            warnings.append(f"Exception {exc.get('id')} for {exc.get('requirement')} expired on {expires} (REQ-EXC-003)")

    # Storage location vs. tier and status
    location = dataset.get("path") or ""
    if location.startswith(LEGACY_PREFIX):
        warnings.append(f"{LEGACY_PREFIX} is legacy storage, not for new data — plan triage/migration (REQ-TIER-002, Policy §7)")
    if status == "archived":
        if not location.startswith(ARCHIVE_PREFIX):
            warnings.append(f"Archived dataset is not under {ARCHIVE_PREFIX} — check dataset.path (Standard §5)")
        discipline = storage.get("wis2_discipline")
        if discipline and location.startswith(ARCHIVE_PREFIX) and not location.startswith(f"{ARCHIVE_PREFIX}{discipline}/"):
            warnings.append(
                f"dataset.path is not under {ARCHIVE_PREFIX}{discipline}/ — deviations need approval (REQ-NAME-004)"
            )
        if not storage.get("checksums"):
            warnings.append("No integrity checksums recorded (REQ-PRT-003, Procedure C.5)")
        for key, product in products.items():
            if isinstance(product, dict) and product.get("type") == "intermediate file":
                warnings.append(f"Product '{key}' is an intermediate file — filter it out before archiving (REQ-ARC-005)")

    compression = storage.get("compression")
    if isinstance(compression, list) and "gzip" in compression:
        warnings.append("gzip compression: prefer zstd (or xz / zlib) (REQ-CMP-001)")
    formats = storage.get("formats")
    named = {f for f in formats if isinstance(f, str)} if isinstance(formats, list) else set()
    unchecked = sorted({"binary", "other"} & named)
    if unchecked and (status == "archived" or storage.get("tier") == "archive"):
        warnings.append(
            f"Format {' and '.join(unchecked)}: check it is open and documented, see format_notes (REQ-FMT-001)"
        )

    lic = manifest.get("license") or {}
    if lic.get("id") == "DMI-internal" and not lic.get("reason"):
        warnings.append("DMI-internal licence: record why the data is not released (Guidelines §8.2)")

    retention = manifest.get("retention") or {}
    if retention.get("kind") in ("date", "condition") and not retention.get("rationale"):
        warnings.append("Retention has no rationale — 'we keep X until Y because Z' (Guidelines §4.2)")

    appraisal = manifest.get("appraisal") or {}
    if appraisal.get("approved_by") and roles.get("owner") and appraisal["approved_by"] != roles["owner"]:
        warnings.append("Appraisal approved by someone other than the Data Owner (REQ-APP-003)")

    reviewed = parse_date((manifest.get("dates") or {}).get("reviewed"))
    if status in ("active", "archived", "deprecated") and reviewed and (today - reviewed).days > 366:
        warnings.append(f"Entry last reviewed {reviewed} — review at least yearly (REQ-CAT-006)")

    return errors, warnings


def validate_file(path, schema, today, owners=frozenset()):
    """Validate a single manifest file. Returns (errors, warnings, info)."""
    try:
        manifest = load_manifest(path)
    except yaml.YAMLError as e:
        return [f"YAML parse error: {e}"], [], []

    if manifest is None:
        return ["File is empty"], [], []
    if not isinstance(manifest, dict):
        return ["Manifest must be a mapping"], [], []

    errors = schema_errors(manifest, schema)
    extra_errors, warnings = cross_checks(path, manifest, today, owners)
    errors += extra_errors

    info = []
    if manifest.get("status") == "proposed":
        missing = missing_for_registration(manifest, schema)
        if missing:
            info.append("Still needed to register (status: active): " + ", ".join(missing))
    return errors, warnings, info


def check_unique_ids(paths):
    seen, errors = {}, []
    for path in paths:
        try:
            manifest_id = (load_manifest(path) or {}).get("id")
        except yaml.YAMLError:
            continue
        if manifest_id in seen:
            errors.append(f"Duplicate id '{manifest_id}' in {Path(seen[manifest_id]).name} and {Path(path).name}")
        elif manifest_id:
            seen[manifest_id] = path
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--strict", action="store_true", help="treat warnings as errors")
    parser.add_argument("--quiet", "-q", action="store_true", help="only print errors and warnings")
    args = parser.parse_args()

    schema = load_schema()
    manifest_files = sorted(glob.glob(MANIFESTS_GLOB))
    example_files = sorted(glob.glob(EXAMPLES_GLOB))

    if not manifest_files:
        print("No manifest files found in manifests/")
        sys.exit(1)

    today = dt.date.today()
    n_errors = n_warnings = 0

    owners, owner_list_errors = load_owners()
    if owner_list_errors:
        print(f"FAIL  {OWNERS_PATH.relative_to(REPO_ROOT)}")
        for err in owner_list_errors:
            print(f"      error: {err}")
        n_errors += len(owner_list_errors)

    for path in manifest_files + example_files:
        name = str(Path(path).relative_to(REPO_ROOT))
        errors, warnings, info = validate_file(path, schema, today, owners)
        n_errors += len(errors)
        n_warnings += len(warnings)
        label = "FAIL" if errors else "WARN" if warnings else "OK"
        print(f"{label:5} {name}")
        for err in errors:
            print(f"      error: {err}")
        for warn in warnings:
            print(f"      warn:  {warn}")
        if not args.quiet:
            for line in info:
                print(f"      info:  {line}")

    for err in check_unique_ids(manifest_files):
        print(f"FAIL  {err}")
        n_errors += 1

    total = len(manifest_files) + len(example_files)
    print(f"\n{total} file(s): {n_errors} error(s), {n_warnings} warning(s).")
    if not owners and not args.quiet:
        print(f"Owner check off: {OWNERS_PATH.relative_to(REPO_ROOT)} lists no approved Data Owners.")
    if n_errors or (args.strict and n_warnings):
        sys.exit(1)


if __name__ == "__main__":
    main()
