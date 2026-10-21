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
  [rawSchema.properties.id.pattern]: "Lower-case letters, digits, '-' and '_' only, starting with a letter or digit",
  [rawSchema.properties.identifiers.properties.doi.pattern]: "A bare DOI such as 10.48670/moi-00013, or 'Not known yet'",
};

export default function transformErrors(errors: RJSFValidationError[]): RJSFValidationError[] {
  return errors
    .map((error) => {
      // Suppress cryptic combinator errors: the concrete error is reported separately
      if (error.name === "if" || error.name === "allOf") return null;
      if (
        error.property?.includes("products") &&
        (error.name === "anyOf" || error.name === "not" || error.name === "oneOf")
      ) {
        return null;
      }

      if (error.name === "required" || error.name === "minLength") {
        const field = error.params?.missingProperty;
        error.message = field === "dir" || field === "dir_pattern" ? "Either dir or dir_pattern is required" : "Required";
      }

      if (error.name === "pattern") {
        error.message = PATTERN_HINTS[error.params?.pattern] ?? error.message;
      }

      if (error.name === "not") {
        error.message = "Placeholders are not allowed once a dataset is archived (REQ-ARC-001)";
      }

      if (error.name === "enum" && error.property === ".storage.tier") {
        error.message = "An archived dataset lives in the archive tier";
      }

      if (error.name === "minItems" && error.property === ".appraisal.users") {
        error.message = "Select at least one group";
      }

      if (error.name === "minProperties" && error.property === ".products") {
        error.message = "Add at least one product";
      }

      return error;
    })
    .filter((e): e is RJSFValidationError => e !== null);
}
