import { useEffect, useState } from "react";
import type { ErrorSchema, FieldProps } from "@rjsf/utils";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Collapse,
  IconButton,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  ListItemText,
  MenuItem,
  Tooltip,
  Typography,
  Stack,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { PRODUCT_CATEGORIES, PRODUCT_TYPE_OPTIONS } from "../guidance";
import type { EditorContext } from "./widgets";

interface Product {
  name?: string;
  dir?: string;
  dir_pattern?: string;
  category?: string;
  model_component?: string;
  domain?: string;
  type?: string;
  notes?: string;
  [extra: string]: unknown;
}

type ProductsMap = Record<string, Product>;

const KNOWN_FIELDS = new Set(["name", "dir", "dir_pattern", "category", "model_component", "domain", "type", "notes"]);

function fieldErrors(errorSchema: ErrorSchema | undefined, key: string, field: string): string[] {
  const product = (errorSchema as Record<string, Record<string, { __errors?: string[] }>> | undefined)?.[key];
  return product?.[field]?.__errors ?? [];
}

/** The YAML key is edited locally and only committed on blur, so typing never clobbers another product. */
/** A YAML key that is committed on blur or Enter; empty keys and keys already in use are refused. */
export function KeyInput({
  value,
  taken,
  onCommit,
  label = "Product key (YAML key)",
  helper = "Unique key within this manifest, usually the directory name",
  takenText = "Another product already uses this key",
}: {
  value: string;
  taken: (k: string) => boolean;
  onCommit: (k: string) => void;
  label?: string;
  helper?: string;
  takenText?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const trimmed = draft.trim();
  const problem = !trimmed ? "The key cannot be empty" : trimmed !== value && taken(trimmed) ? takenText : "";
  const commit = () => {
    if (problem) setDraft(value);
    else if (trimmed !== value) onCommit(trimmed);
  };
  return (
    <TextField
      label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      size="small"
      fullWidth
      error={!!problem}
      helperText={problem || helper}
    />
  );
}

export default function ProductsField(props: FieldProps) {
  const products: ProductsMap = (props.formData as ProductsMap) || {};
  const entries = Object.entries(products);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const status = (props.registry.formContext as EditorContext | undefined)?.formData?.status;
  const errorSchema = props.errorSchema as ErrorSchema | undefined;

  const update = (newProducts: ProductsMap) => {
    props.onChange(newProducts);
  };

  const addProduct = () => {
    let n = entries.length + 1;
    while (`product_${n}` in products) n++;
    const key = `product_${n}`;
    update({ ...products, [key]: { name: "", dir: "" } });
    setExpanded((prev) => ({ ...prev, [key]: true }));
  };

  const removeProduct = (key: string) => {
    const { [key]: _, ...rest } = products;
    update(rest);
  };

  const renameKey = (oldKey: string, newKey: string) => {
    // Preserve insertion order
    const result: ProductsMap = {};
    for (const [k, v] of Object.entries(products)) {
      if (k === oldKey) result[newKey] = v;
      else result[k] = v;
    }
    update(result);
    setExpanded((prev) => {
      const { [oldKey]: wasOpen, ...rest } = prev;
      return { ...rest, [newKey]: wasOpen ?? true };
    });
  };

  const updateProduct = (key: string, field: string, value: string) => {
    const product = { ...products[key], [field]: value };
    // Clear empty optional fields
    if (!value) delete (product as Record<string, unknown>)[field];
    update({ ...products, [key]: product });
  };

  const setDirMode = (key: string, mode: "dir" | "dir_pattern") => {
    const product = { ...products[key] };
    if (mode === "dir") {
      product.dir = product.dir_pattern || "";
      delete product.dir_pattern;
    } else {
      product.dir_pattern = product.dir || "";
      delete product.dir;
    }
    update({ ...products, [key]: product });
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Box>
      {entries.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No products yet. Add one per sub-directory (or family of sub-directories) of the dataset path.
        </Typography>
      )}
      <Stack spacing={1.5}>
        {entries.map(([key, product]) => {
          const isOpen = expanded[key] ?? false;
          const dirMode = product.dir_pattern !== undefined ? "dir_pattern" : "dir";
          const errorCount = ["name", "dir", "dir_pattern"].reduce((n, f) => n + fieldErrors(errorSchema, key, f).length, 0);
          const extras = Object.keys(product).filter((k) => !KNOWN_FIELDS.has(k));
          const archiveWarning = product.type === "intermediate file" && (status === "active" || status === "archived");
          const dirErrors = fieldErrors(errorSchema, key, dirMode);
          const nameErrors = fieldErrors(errorSchema, key, "name");
          return (
            <Card key={key} variant="outlined">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 2,
                  py: 1,
                  cursor: "pointer",
                  bgcolor: "grey.50",
                  gap: 1,
                }}
                onClick={() => toggleExpand(key)}
              >
                <IconButton
                  size="small"
                  sx={{
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
                <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 500, minWidth: 0 }} noWrap>
                  {product.name || key}
                </Typography>
                {archiveWarning && (
                  <Tooltip title="Intermediate files should be filtered out before archiving (REQ-ARC-005)">
                    <WarningAmberIcon color="warning" fontSize="small" />
                  </Tooltip>
                )}
                {product.type && <Chip size="small" variant="outlined" label={product.type} />}
                {errorCount > 0 && <Chip size="small" color="error" label={`${errorCount} to fix`} />}
                <Typography variant="caption" color="text.secondary">
                  {key}
                </Typography>
              </Box>
              <Collapse in={isOpen}>
                <CardContent sx={{ pt: 1 }}>
                  <Stack spacing={2}>
                    <KeyInput
                      value={key}
                      taken={(k) => k in products}
                      onCommit={(k) => renameKey(key, k)}
                    />
                    <TextField
                      label="Name"
                      value={product.name || ""}
                      onChange={(e) => updateProduct(key, "name", e.target.value)}
                      size="small"
                      fullWidth
                      required
                      error={nameErrors.length > 0}
                      helperText={nameErrors[0]}
                      placeholder="Human-readable product name"
                    />
                    <FormControl>
                      <FormLabel>Directory type</FormLabel>
                      <RadioGroup
                        row
                        value={dirMode}
                        onChange={(e) =>
                          setDirMode(key, e.target.value as "dir" | "dir_pattern")
                        }
                      >
                        <FormControlLabel
                          value="dir"
                          control={<Radio size="small" />}
                          label="dir (literal subdirectory)"
                        />
                        <FormControlLabel
                          value="dir_pattern"
                          control={<Radio size="small" />}
                          label="dir_pattern (shell glob)"
                        />
                      </RadioGroup>
                    </FormControl>
                    <TextField
                      label={dirMode === "dir" ? "dir" : "dir_pattern"}
                      value={
                        dirMode === "dir"
                          ? product.dir || ""
                          : product.dir_pattern || ""
                      }
                      onChange={(e) => updateProduct(key, dirMode, e.target.value)}
                      size="small"
                      fullWidth
                      required
                      error={dirErrors.length > 0}
                      placeholder={
                        dirMode === "dir"
                          ? "e.g. NORDIC_1d_grid_T"
                          : "e.g. n[0-9][0-9][0-4]"
                      }
                      helperText={
                        dirErrors[0] ??
                        (dirMode === "dir"
                          ? "Literal subdirectory name under the dataset path"
                          : "Shell glob pattern matching multiple subdirectories")
                      }
                    />
                    <Autocomplete
                      freeSolo
                      options={PRODUCT_CATEGORIES}
                      inputValue={product.category || ""}
                      onInputChange={(_, value) => updateProduct(key, "category", value)}
                      renderInput={(params) => (
                        <TextField {...params} label="Category" size="small" placeholder="e.g. Physics, Biogeochemistry, Ice" />
                      )}
                    />
                    <TextField
                      select
                      label="Type"
                      value={product.type || ""}
                      onChange={(e) => updateProduct(key, "type", e.target.value)}
                      size="small"
                      fullWidth
                      helperText={product.type ? PRODUCT_TYPE_OPTIONS[product.type]?.description : "Role of this data in the processing chain"}
                      SelectProps={{ renderValue: (v) => String(v) }}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {Object.entries(PRODUCT_TYPE_OPTIONS).map(([value, option]) => (
                        <MenuItem key={value} value={value}>
                          <ListItemText primary={option.label} secondary={option.description} />
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Model Component"
                      value={product.model_component || ""}
                      onChange={(e) =>
                        updateProduct(key, "model_component", e.target.value)
                      }
                      size="small"
                      fullWidth
                      placeholder="e.g. NEMO, ERGOM, SI3"
                    />
                    <TextField
                      label="Domain"
                      value={product.domain || ""}
                      onChange={(e) =>
                        updateProduct(key, "domain", e.target.value)
                      }
                      size="small"
                      fullWidth
                      placeholder="e.g. Baltic, Nordic+Baltic"
                    />
                    <TextField
                      label="Notes"
                      value={product.notes || ""}
                      onChange={(e) =>
                        updateProduct(key, "notes", e.target.value)
                      }
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="Contents, variables, period, size…"
                    />
                    {extras.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Extra fields kept from the YAML (edit them in the YAML panel): {extras.join(", ")}
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
                <CardActions>
                  <Button
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => removeProduct(key)}
                  >
                    Remove
                  </Button>
                </CardActions>
              </Collapse>
            </Card>
          );
        })}
      </Stack>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={addProduct}
        sx={{ mt: 2 }}
      >
        Add Product
      </Button>
    </Box>
  );
}
