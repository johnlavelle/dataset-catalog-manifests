import {
  createErrorHandler,
  getDefaultFormState,
  unwrapErrorHandler,
  validationDataMerge,
  type ErrorSchema,
  type RJSFSchema,
  type ValidatorType,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { schema as rootSchema } from "./compliance";

/** The data makes few different schemas (one per combination of status, licence and the like). This is only a limit. */
const MAX_SCHEMAS = 32;

/**
 * The schema the form is built from. Its products are shown by ProductsField, which needs nothing
 * of their schema, while rjsf would walk a copy of it for every product on every change. Only
 * validation needs it: formValidator puts it back.
 */
const products = (rootSchema.properties as Record<string, RJSFSchema>).products;
export const formSchema: RJSFSchema = {
  ...rootSchema,
  properties: { ...rootSchema.properties, products: { type: "object", title: products.title } },
};

const known = new Map<string, RJSFSchema>();

/** The one object with this content. */
function intern(schema: RJSFSchema): RJSFSchema {
  const text = JSON.stringify(schema);
  const found = known.get(text);
  if (found) return found;
  if (known.size >= MAX_SCHEMAS) known.clear();
  known.set(text, schema);
  return schema;
}

/** The errors alone: nothing for a field without any, so that "no errors" always looks the same. */
export function onlyErrors(node: ErrorSchema): ErrorSchema | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "__errors") {
      if ((value as string[]).length) out[key] = value;
    } else {
      const child = onlyErrors(value as ErrorSchema);
      if (child) out[key] = child;
    }
  }
  return Object.keys(out).length ? (out as ErrorSchema) : undefined;
}

/**
 * The validator for the form. It reports what rjsf's reports, which check-robustness holds it to,
 * but rjsf's costs seconds per keystroke on a manifest with many products, in three ways:
 *
 * - rjsf validates against the schema resolved for the data, a new object on every change. Ajv
 *   caches what it compiles by object, so it would compile anew and keep every copy. The same
 *   content is now the same object. (A $id would not do: the result depends on the data, e.g. the
 *   status.)
 * - Before custom validation rjsf fills in the data with the resolved schema as the root schema.
 *   Ajv holds one root, so that replaces the real one, which the next check of a condition puts
 *   back: each swap compiles the schema again, and drops the resolved one from the cache above.
 *   So custom validation runs here, with the real root.
 * - Validation uses the full products schema, which the form does not have (see formSchema).
 * - Without errors, the error tree is sometimes {} and sometimes empty entries for every field.
 *   rjsf redraws a field when anything it is given differs, so that redrew the whole form.
 */
const formValidator: ValidatorType = Object.create(validator);
formValidator.validateFormData = (formData, schema, customValidate, transformErrors, uiSchema) => {
  const full = intern({ ...schema, properties: { ...schema.properties, products } });
  let result = validator.validateFormData(formData, full, undefined, transformErrors, uiSchema);
  if (customValidate) {
    const data = getDefaultFormState(validator, formSchema, formData, formSchema, true);
    const handler = customValidate(data, createErrorHandler(data), uiSchema);
    result = validationDataMerge(result, unwrapErrorHandler(handler));
  }
  return { errors: result.errors, errorSchema: onlyErrors(result.errorSchema) ?? {} };
};

export default formValidator;
