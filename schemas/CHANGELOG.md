# Manifest schema changelog

The version is `version` in [`dataset_manifest.schema.json`](dataset_manifest.schema.json), and each release is
tagged `schema-v<version>` in this repository. Manifests carry no version of their own: a catalogue keeps all its
manifests in one repository, migrates them in the same change as the schema and validates them against it in CI.
Older files (downloads, browser drafts, AI-written ones) are recognised by their shape: the editor upgrades them when
they are opened and the validator explains what changed.

- **Major** (`2.0.0`): a manifest that was valid may no longer be, or a field moves or goes away. The editor's
  `upgradeLegacy` learns the old shape.
- **Minor** (`2.1.0`): new optional fields or looser rules. Every valid manifest stays valid.
- **Patch** (`2.0.1`): descriptions, titles and messages only.

## 2.0.0 — 2026-11-20

- `storage.wis2_discipline` is removed: the WIS2 discipline is the top-level archive folder the data goes in, not a
  field of its own.
- Migration: delete the `wis2_discipline` line. The editor drops the field when a file is opened.

## 1.0.0 — 2026-11-16

- First public version.
