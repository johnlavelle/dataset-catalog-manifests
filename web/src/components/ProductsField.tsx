import { useState } from "react";
import type { FieldProps } from "@rjsf/utils";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Collapse,
  IconButton,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  MenuItem,
  Typography,
  Stack,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

const PRODUCT_TYPES = [
  "final product",
  "original output",
  "raw output",
  "intermediate file",
  "production file",
  "project file",
  "project archive",
  "restart file",
  "diagnostic",
];

interface Product {
  name?: string;
  dir?: string;
  dir_pattern?: string;
  category?: string;
  model_component?: string;
  domain?: string;
  type?: string;
  notes?: string;
}

type ProductsMap = Record<string, Product>;

export default function ProductsField(props: FieldProps) {
  const products: ProductsMap = (props.formData as ProductsMap) || {};
  const entries = Object.entries(products);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const update = (newProducts: ProductsMap) => {
    props.onChange(newProducts);
  };

  const addProduct = () => {
    const key = `product_${Date.now()}`;
    update({ ...products, [key]: { name: "", dir: "" } });
    setExpanded((prev) => ({ ...prev, [key]: true }));
  };

  const removeProduct = (key: string) => {
    const { [key]: _, ...rest } = products;
    update(rest);
  };

  const renameKey = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
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
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Products
      </Typography>
      {entries.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No products yet. Click "Add Product" to begin.
        </Typography>
      )}
      <Stack spacing={1.5}>
        {entries.map(([key, product]) => {
          const isOpen = expanded[key] ?? false;
          const dirMode = product.dir_pattern !== undefined ? "dir_pattern" : "dir";
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
                }}
                onClick={() => toggleExpand(key)}
              >
                <IconButton
                  size="small"
                  sx={{
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    mr: 1,
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
                <Typography
                  variant="subtitle1"
                  sx={{ flex: 1, fontWeight: 500 }}
                >
                  {product.name || key}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  {key}
                </Typography>
              </Box>
              <Collapse in={isOpen}>
                <CardContent sx={{ pt: 1 }}>
                  <Stack spacing={2}>
                    <TextField
                      label="Product Key (YAML key)"
                      value={key}
                      onChange={(e) => renameKey(key, e.target.value)}
                      size="small"
                      fullWidth
                      helperText="Unique identifier used as the YAML key"
                    />
                    <TextField
                      label="Name"
                      value={product.name || ""}
                      onChange={(e) => updateProduct(key, "name", e.target.value)}
                      size="small"
                      fullWidth
                      required
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
                      placeholder={
                        dirMode === "dir"
                          ? "e.g. NORDIC_1d_grid_T"
                          : "e.g. n[0-9][0-9][0-4]"
                      }
                      helperText={
                        dirMode === "dir"
                          ? "Literal subdirectory name under dataset.path"
                          : "Shell glob pattern matching multiple subdirectories"
                      }
                    />
                    <TextField
                      label="Category"
                      value={product.category || ""}
                      onChange={(e) =>
                        updateProduct(key, "category", e.target.value)
                      }
                      size="small"
                      fullWidth
                      placeholder="e.g. Physics, Biogeochemistry, Ice"
                    />
                    <TextField
                      select
                      label="Type"
                      value={product.type || ""}
                      onChange={(e) => updateProduct(key, "type", e.target.value)}
                      size="small"
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {PRODUCT_TYPES.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
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
                      placeholder="Additional notes..."
                    />
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
