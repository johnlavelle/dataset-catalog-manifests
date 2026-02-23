import type { RJSFValidationError } from "@rjsf/utils";

export default function transformErrors(
  errors: RJSFValidationError[]
): RJSFValidationError[] {
  return errors
    .map((error) => {
      // Suppress cryptic anyOf / not errors on products — handled by ProductsField
      if (
        error.property?.includes("products") &&
        (error.name === "anyOf" || error.name === "not" || error.name === "oneOf")
      ) {
        return null;
      }

      // Rewrite required field errors
      if (error.name === "required") {
        const field = error.params?.missingProperty;
        if (field === "name") error.message = "Name is required";
        if (field === "path") error.message = "Path is required";
        if (field === "dir" || field === "dir_pattern")
          error.message = "Either dir or dir_pattern is required";
      }

      // Rewrite minProperties on products
      if (
        error.name === "minProperties" &&
        error.property === ".products"
      ) {
        error.message = "Add at least one product";
      }

      return error;
    })
    .filter((e): e is RJSFValidationError => e !== null);
}
