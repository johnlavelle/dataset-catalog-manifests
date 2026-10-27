import { useMemo } from "react";
import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import type { IChangeEvent } from "@rjsf/core";
import type { FieldProps } from "@rjsf/utils";
import buildUiSchema from "../uiSchema";
import transformErrors from "../transformErrors";
import { customValidate, schema, type Manifest } from "../compliance";
import ProductsField from "./ProductsField";
import ExtensionsField from "./ExtensionsField";
import ObjectFieldTemplate from "./FormLayout";
import { widgets, type EditorContext } from "./widgets";

const fields: Record<string, React.ComponentType<FieldProps>> = {
  ProductsField,
  ExtensionsField,
};

interface ManifestFormProps {
  formData: Manifest;
  onChange: (e: IChangeEvent) => void;
}

export default function ManifestForm({ formData, onChange }: ManifestFormProps) {
  const uiSchema = useMemo(() => buildUiSchema(formData), [formData]);
  const formContext: EditorContext = { formData };

  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={formData}
      formContext={formContext}
      onChange={onChange}
      validator={validator}
      fields={fields}
      widgets={widgets}
      templates={{ ObjectFieldTemplate }}
      customValidate={customValidate}
      transformErrors={transformErrors}
      liveValidate
      showErrorList={false}
      noHtml5Validate
    >
      {/* Hide the default submit button */}
      <div />
    </Form>
  );
}
