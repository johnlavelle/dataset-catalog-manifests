import type { UiSchema } from "@rjsf/utils";

const uiSchema: UiSchema = {
  "ui:order": ["dataset", "products", "stac"],
  dataset: {
    "ui:order": ["name", "path", "model", "domain", "contact", "description"],
    name: {
      "ui:placeholder": "e.g. BALMFC MYP2022",
    },
    path: {
      "ui:placeholder": "e.g. /net/isilon/ifs/arch/home/...",
    },
    model: {
      "ui:placeholder": "e.g. NEMO, WAM, EC-Earth3",
    },
    domain: {
      "ui:placeholder": "e.g. North Sea - Baltic Sea",
    },
    contact: {
      "ui:placeholder": "e.g. Jane Doe <jd@dmi.dk>",
    },
    description: {
      "ui:widget": "textarea",
      "ui:options": { rows: 3 },
      "ui:placeholder": "Brief description of the dataset...",
    },
  },
  products: {
    "ui:field": "ProductsField",
  },
  stac: {
    "ui:title": "STAC Metadata (optional)",
    "ui:order": [
      "institution",
      "purpose",
      "model_system",
      "cmems_product_code",
      "period",
      "dois",
    ],
    institution: {
      "ui:placeholder": "e.g. Danish Meteorological Institute (DMI)",
    },
    purpose: {
      "ui:placeholder": "e.g. Copernicus Marine Service - Baltic Sea Reanalysis",
    },
    model_system: {
      "ui:placeholder": "e.g. NEMO 4.0 + ERGOM + SI3 + PDAF",
    },
    cmems_product_code: {
      "ui:placeholder": "e.g. BALTICSEA_MULTIYEAR_PHY_003_011",
    },
    period: {
      "ui:placeholder": "e.g. 1993-01-01 to 2024-05-22",
    },
    dois: {
      "ui:field": "DoisField",
    },
  },
};

export default uiSchema;
