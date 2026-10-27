import type { RJSFValidationError } from "@rjsf/utils";
import rawSchema from "../../schemas/dataset_manifest.schema.json";

const defs = rawSchema.definitions;

/** Friendly messages for the patterns used in the schema. */
const PATTERN_HINTS: Record<string, string> = {
  [defs.person.pattern]: "Enter a name and an e-mail address",
  [defs.date.pattern]: "Use a date (YYYY-MM-DD)",
  [defs.dateOrTbd.pattern]: "Use a date, or 'Not known yet'",
  [defs.urlOrTbd.pattern]: "Use a full link starting with https://, or 'Not known yet'",
  [defs.textOrTbd.pattern]: "Placeholders must read 'TBD by YYYY-MM-DD' — use 'Not known yet'",
  [defs.location.pattern]: "An absolute path without a trailing slash (/dmidata/…), host:/path, or a URL (scheme://…)",
  [defs.relativePath.pattern]: "A path relative to the dataset location, without a slash at the start or end",
  [rawSchema.properties.id.pattern]: "Lower-case letters, digits, '-' and '_' only, starting with a letter or digit",
  [rawSchema.properties.identifiers.properties.doi.pattern]:
    "A bare DOI such as 10.48670/moi-00013 (without https://doi.org/), or 'Not known yet'",
  [rawSchema.properties.identifiers.properties.related.items.properties.doi.pattern]:
    "A bare DOI such as 10.48670/moi-00013, without https://doi.org/",
  [rawSchema.properties.exceptions.items.properties.id.pattern]: "Starts with EXC-, e.g. EXC-2026-001",
  [rawSchema.properties.exceptions.items.properties.requirement.pattern]: "A requirement ID such as REQ-CMP-001",
};

export default function transformErrors(errors: RJSFValidationError[]): RJSFValidationError[] {
  return errors
    .map((error) => {
      // Suppress cryptic combinator errors: the concrete error is reported separately
      if (error.name === "if" || error.name === "allOf") return null;
      if (error.property?.includes("products")) {
        // A product has dir or dir_pattern: neither is reported as a missing field; both, here
        if (error.name === "not") {
          error.message = "Use either dir or dir_pattern, not both";
          return error;
        }
        if (error.name === "anyOf" || error.name === "oneOf") return null;
      }

      if (error.name === "required" || error.name === "minLength") {
        const field = error.params?.missingProperty;
        error.message = field === "dir" || field === "dir_pattern" ? "Either dir or dir_pattern is required" : "Required";
      }

      // A line just added to a list of texts (e.g. Secondary locations) is empty until filled in
      if (error.name === "type" && error.params?.type === "string" && /\.\d+$/.test(error.property ?? "")) {
        error.message = "Fill this in, or remove the line";
      }

      if (error.name === "pattern") {
        error.message = PATTERN_HINTS[error.params?.pattern] ?? error.message;
      }

      if (error.name === "not") {
        error.message = error.schemaPath?.includes("/else/")
          ? "Only applies to another choice: remove it, or change the choice it depends on"
          : "Placeholders are not allowed once a dataset is archived (REQ-ARC-001)";
      }

      // Only the rule for archived datasets allows just the archive tier
      const allowed = error.params?.allowedValues;
      if (error.name === "enum" && error.property === ".storage.tier" && Array.isArray(allowed) && allowed.join() === "archive") {
        error.message = "An archived dataset lives in the archive tier";
      } else if (error.name === "enum" && error.property === ".storage.tier") {
        error.message = "Choose a tier from the list";
      }

      if (error.name === "minItems" && error.property === ".appraisal.users") {
        error.message = "Select at least one group";
      }

      if (error.name === "minProperties" && error.property === ".products") {
        error.message = "Add at least one product";
      }

      return error;
    })
    .filter((e): e is RJSFValidationError => e !== null)
    // An empty field is "Required"; its format does not matter yet
    .filter((e, _, all) => e.name !== "pattern" || !all.some((o) => o.name === "minLength" && o.property === e.property));
}
