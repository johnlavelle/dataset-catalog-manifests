import { memo, useEffect, useMemo, useRef, useState } from "react";
import { deepEquals, type ErrorSchema, type FieldProps } from "@rjsf/utils";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Checkbox,
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
import { asText, isMapping } from "../compliance";
import { COLLAPSE_ALL_EVENT, REVEAL_FIELD_EVENT, pathParts } from "../navigation";
import { sharedValues, type BulkScope } from "../productBulk";
import ProductBulkBar from "./ProductBulkBar";

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

function fieldErrors(errors: ErrorSchema | undefined, field: string): string[] {
  return (errors as Record<string, { __errors?: string[] }> | undefined)?.[field]?.__errors ?? [];
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

/** What a card asks of the list. One stable object, so that a change to one card leaves the others alone. */
export interface ProductActions {
  toggleOpen: (key: string) => void;
  toggleTick: (key: string, on: boolean) => void;
  remove: (key: string) => void;
  rename: (oldKey: string, newKey: string) => void;
  isTaken: (key: string) => boolean;
  setField: (key: string, field: string, value: string) => void;
  keepOnly: (key: string, keep: "dir" | "dir_pattern") => void;
  setDirMode: (key: string, mode: "dir" | "dir_pattern") => void;
}

interface ProductCardProps {
  productKey: string;
  product: Product;
  /** Id of the products field; a card's inputs are <id>_<key>_<field>, as the checklist builds them from a path. */
  fieldId: string;
  open: boolean;
  ticked: boolean;
  showTick: boolean;
  status: unknown;
  errors: ErrorSchema | undefined;
  actions: ProductActions;
}

/** Only the fields of an open card exist: a manifest can have many products, and each would cost time on every edit. */
export const ProductCard = memo(function ProductCard({
  productKey: key,
  product,
  fieldId,
  open: isOpen,
  ticked,
  showTick,
  status,
  errors,
  actions,
}: ProductCardProps) {
  const inputId = (field: string) => `${fieldId}_${key}_${field}`;
  const set = (field: string, value: string) => actions.setField(key, field, value);
  const dirMode = product.dir_pattern !== undefined ? "dir_pattern" : "dir";
  const bothDirs = product.dir !== undefined && product.dir_pattern !== undefined;
  const errorCount = ["name", "dir", "dir_pattern"].reduce((n, f) => n + fieldErrors(errors, f).length, 0) + (bothDirs ? 1 : 0);
  const extras = Object.keys(product).filter((k) => !KNOWN_FIELDS.has(k));
  const archiveWarning = product.type === "intermediate file" && (status === "active" || status === "archived");
  const dirErrors = fieldErrors(errors, dirMode);
  const nameErrors = fieldErrors(errors, "name");
  return (
    <Card variant="outlined">
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
        onClick={() => actions.toggleOpen(key)}
      >
        {showTick && (
          <Checkbox
            size="small"
            sx={{ p: 0.25 }}
            checked={ticked}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => actions.toggleTick(key, e.target.checked)}
            inputProps={{ "aria-label": `Tick ${asText(product.name) || key}` }}
          />
        )}
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
          {asText(product.name) || key}
        </Typography>
        {archiveWarning && (
          <Tooltip title="Intermediate files should be filtered out before archiving (REQ-ARC-005)">
            <WarningAmberIcon color="warning" fontSize="small" />
          </Tooltip>
        )}
        {asText(product.type) && <Chip size="small" variant="outlined" label={asText(product.type)} />}
        {errorCount > 0 && <Chip size="small" color="error" label={`${errorCount} to fix`} />}
        <Typography variant="caption" color="text.secondary">
          {key}
        </Typography>
      </Box>
      <Collapse in={isOpen} mountOnEnter unmountOnExit>
        <CardContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <KeyInput value={key} taken={actions.isTaken} onCommit={(k) => actions.rename(key, k)} />
            <TextField
              id={inputId("name")}
              label="Name"
              value={asText(product.name)}
              onChange={(e) => set("name", e.target.value)}
              size="small"
              fullWidth
              required
              error={nameErrors.length > 0}
              helperText={nameErrors[0]}
              placeholder="Human-readable product name"
            />
            {bothDirs && (
              <Alert
                severity="error"
                action={
                  <Stack direction="row" spacing={0.5}>
                    <Button color="inherit" size="small" onClick={() => actions.keepOnly(key, "dir")}>
                      Keep dir
                    </Button>
                    <Button color="inherit" size="small" onClick={() => actions.keepOnly(key, "dir_pattern")}>
                      Keep pattern
                    </Button>
                  </Stack>
                }
              >
                Both dir (<code>{asText(product.dir)}</code>) and dir_pattern (
                <code>{asText(product.dir_pattern)}</code>) are set; a product has one or the other.
              </Alert>
            )}
            <FormControl>
              <FormLabel>Directory type</FormLabel>
              <RadioGroup row value={dirMode} onChange={(e) => actions.setDirMode(key, e.target.value as "dir" | "dir_pattern")}>
                <FormControlLabel value="dir" control={<Radio size="small" />} label="dir (literal subdirectory)" />
                <FormControlLabel value="dir_pattern" control={<Radio size="small" />} label="dir_pattern (shell glob)" />
              </RadioGroup>
            </FormControl>
            <TextField
              id={inputId(dirMode)}
              label={dirMode === "dir" ? "dir" : "dir_pattern"}
              value={dirMode === "dir" ? asText(product.dir) : asText(product.dir_pattern)}
              onChange={(e) => set(dirMode, e.target.value)}
              size="small"
              fullWidth
              required
              error={dirErrors.length > 0}
              placeholder={dirMode === "dir" ? "e.g. NORDIC_1d_grid_T" : "e.g. n[0-9][0-9][0-4]"}
              helperText={
                dirErrors[0] ??
                (dirMode === "dir" ? "Literal subdirectory name under the dataset path" : "Shell glob pattern matching multiple subdirectories")
              }
            />
            <Autocomplete
              id={inputId("category")}
              freeSolo
              options={PRODUCT_CATEGORIES}
              inputValue={asText(product.category)}
              onInputChange={(_, value) => set("category", value)}
              renderInput={(params) => (
                <TextField {...params} label="Category" size="small" placeholder="e.g. Physics, Biogeochemistry, Ice" />
              )}
            />
            <TextField
              id={inputId("type")}
              select
              label="Type"
              value={asText(product.type)}
              onChange={(e) => set("type", e.target.value)}
              size="small"
              fullWidth
              helperText={PRODUCT_TYPE_OPTIONS[asText(product.type)]?.description ?? "Role of this data in the processing chain"}
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
              id={inputId("model_component")}
              label="Model Component"
              value={asText(product.model_component)}
              onChange={(e) => set("model_component", e.target.value)}
              size="small"
              fullWidth
              placeholder="e.g. NEMO, ERGOM, SI3"
            />
            <TextField
              id={inputId("domain")}
              label="Domain"
              value={asText(product.domain)}
              onChange={(e) => set("domain", e.target.value)}
              size="small"
              fullWidth
              placeholder="e.g. Baltic, Nordic+Baltic"
            />
            <TextField
              id={inputId("notes")}
              label="Notes"
              value={asText(product.notes)}
              onChange={(e) => set("notes", e.target.value)}
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
          <Button color="error" size="small" startIcon={<DeleteIcon />} onClick={() => actions.remove(key)}>
            Remove
          </Button>
        </CardActions>
      </Collapse>
    </Card>
  );
},
// Products and errors arrive as new objects with the same content after any edit; actions never change
(a, b) =>
  a.productKey === b.productKey &&
  a.open === b.open &&
  a.ticked === b.ticked &&
  a.showTick === b.showTick &&
  a.status === b.status &&
  a.fieldId === b.fieldId &&
  deepEquals(a.product, b.product) &&
  deepEquals(a.errors, b.errors));

export default function ProductsField(props: FieldProps) {
  // Anything but a mapping is a schema error, listed in the checklist; show it as no products
  const products: ProductsMap = isMapping(props.formData) ? (props.formData as ProductsMap) : {};
  const entries = Object.entries(products).map(([k, p]) => [k, isMapping(p) ? p : {}] as [string, Product]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<BulkScope>("empty");
  const { status, manifestId } = (props.uiSchema?.["ui:options"] ?? {}) as { status?: unknown; manifestId?: unknown };
  const errorSchema = props.errorSchema as Record<string, ErrorSchema> | undefined;

  /** What the actions below work on: always this render's, though the actions are made once. */
  const latest = useRef({ products, onChange: props.onChange });
  latest.current = { products, onChange: props.onChange };
  const update = (newProducts: ProductsMap) => latest.current.onChange(newProducts);

  // This field stays mounted when another manifest is opened, and ticks belong to the one they were made in
  useEffect(() => setTicked(new Set()), [manifestId]);

  // A jump from the checklist to a field inside a product opens its card; "Collapse all" closes them all
  useEffect(() => {
    const open = (e: Event) => {
      const [top, key] = pathParts((e as CustomEvent<string>).detail);
      if (top === "products" && key) setExpanded((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    };
    const collapse = () => setExpanded({});
    window.addEventListener(REVEAL_FIELD_EVENT, open);
    window.addEventListener(COLLAPSE_ALL_EVENT, collapse);
    return () => {
      window.removeEventListener(REVEAL_FIELD_EVENT, open);
      window.removeEventListener(COLLAPSE_ALL_EVENT, collapse);
    };
  }, []);

  const addProduct = () => {
    let n = entries.length + 1;
    while (`product_${n}` in products) n++;
    const key = `product_${n}`;
    update({ ...products, [key]: { name: "", dir: "", ...sharedValues(products) } });
    setExpanded((prev) => ({ ...prev, [key]: true }));
  };

  const actions = useMemo<ProductActions>(() => {
    const current = () => latest.current.products;
    const productOf = (key: string): Product => {
      const product = current()[key];
      return { ...(isMapping(product) ? product : {}) };
    };
    const toggleTick = (key: string, on: boolean) => {
      setTicked((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      });
      if (on) setScope("ticked");
    };
    return {
      toggleOpen: (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] })),
      toggleTick,
      isTaken: (key) => key in current(),
      remove: (key) => {
        const { [key]: _, ...rest } = current();
        update(rest);
        toggleTick(key, false);
      },
      rename: (oldKey, newKey) => {
        // Preserve insertion order
        const result: ProductsMap = {};
        for (const [k, v] of Object.entries(current())) {
          if (k === oldKey) result[newKey] = v;
          else result[k] = v;
        }
        update(result);
        setExpanded((prev) => {
          const { [oldKey]: wasOpen, ...rest } = prev;
          return { ...rest, [newKey]: wasOpen ?? true };
        });
        setTicked((prev) => (prev.has(oldKey) ? new Set([...prev].map((k) => (k === oldKey ? newKey : k))) : prev));
      },
      setField: (key, field, value) => {
        const product: Record<string, unknown> = { ...productOf(key), [field]: value };
        // Clear empty optional fields
        if (!value) delete product[field];
        update({ ...current(), [key]: product });
      },
      /** A product with both dir and dir_pattern (CI refuses it) keeps one. */
      keepOnly: (key, keep) => {
        const product = productOf(key);
        if (keep === "dir") delete product.dir_pattern;
        else delete product.dir;
        update({ ...current(), [key]: product });
      },
      setDirMode: (key, mode) => {
        const product = productOf(key);
        if (mode === "dir") {
          product.dir = product.dir_pattern || "";
          delete product.dir_pattern;
        } else {
          product.dir_pattern = product.dir || "";
          delete product.dir;
        }
        update({ ...current(), [key]: product });
      },
    };
  }, []);

  return (
    <Box>
      {entries.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No products yet. Add one per sub-directory (or family of sub-directories) of the dataset path.
        </Typography>
      )}
      {entries.length > 1 && (
        <ProductBulkBar products={products} ticked={ticked} scope={scope} onScope={setScope} onChange={(p) => update(p as ProductsMap)} />
      )}
      <Stack spacing={1.5}>
        {entries.map(([key, product]) => (
          <ProductCard
            key={key}
            productKey={key}
            product={product}
            fieldId={props.idSchema.$id}
            open={expanded[key] ?? false}
            ticked={ticked.has(key)}
            showTick={entries.length > 1}
            status={status}
            errors={errorSchema?.[key]}
            actions={actions}
          />
        ))}
      </Stack>
      <Button
        // The checklist jumps here for the products list itself while there are none
        id={`${props.idSchema.$id}_add`}
        data-empty={entries.length === 0}
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
