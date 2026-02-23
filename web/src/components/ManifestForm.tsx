import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import type { IChangeEvent } from "@rjsf/core";
import type { FieldProps, ObjectFieldTemplateProps } from "@rjsf/utils";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import schema from "../../../schemas/dataset_manifest.schema.json";
import uiSchema from "../uiSchema";
import transformErrors from "../transformErrors";
import ProductsField from "./ProductsField";
import DoisField from "./DoisField";

const fields: Record<string, React.ComponentType<FieldProps>> = {
  ProductsField,
  DoisField,
};

/** Wrap the optional `stac` section in an accordion. */
function RootObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const stacProp = props.properties.find((p) => p.name === "stac");
  const otherProps = props.properties.filter((p) => p.name !== "stac");

  return (
    <div>
      {otherProps.map((p) => p.content)}
      {stacProp && (
        <Accordion defaultExpanded={false} sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">STAC Metadata (optional)</Typography>
          </AccordionSummary>
          <AccordionDetails>{stacProp.content}</AccordionDetails>
        </Accordion>
      )}
    </div>
  );
}

interface ManifestFormProps {
  formData: Record<string, unknown>;
  onChange: (e: IChangeEvent) => void;
}

export default function ManifestForm({ formData, onChange }: ManifestFormProps) {
  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={formData}
      onChange={onChange}
      validator={validator}
      fields={fields}
      templates={{ ObjectFieldTemplate: RootObjectFieldTemplate }}
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
