import { useState } from "react";
import { Alert, Autocomplete, Box, Button, FormControlLabel, ListItemText, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { PRODUCT_CATEGORIES, PRODUCT_TYPE_OPTIONS } from "../guidance";
import { applyBulk, bulkPlan, usedValues, BULK_FIELDS, type BulkPlan, type BulkScope, type Products } from "../productBulk";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function applyLabel({ fill, replace }: BulkPlan): string {
  if (!fill.length && !replace.length) return "Nothing to change";
  if (!replace.length) return `Set on ${plural(fill.length, "product")}`;
  return `Replace ${plural(replace.length, "value")}${fill.length ? `, fill ${fill.length}` : ""}`;
}

/** The change just made, which can be taken back until the products change again. */
interface Done {
  before: Products;
  after: string;
  message: string;
}

export default function ProductBulkBar({
  products,
  ticked,
  scope,
  onScope,
  onChange,
}: {
  products: Products;
  ticked: Set<string>;
  scope: BulkScope;
  onScope: (scope: BulkScope) => void;
  onChange: (products: Products) => void;
}) {
  const [field, setField] = useState(BULK_FIELDS[0].field);
  const [value, setValue] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  const text = value.trim();
  const label = BULK_FIELDS.find((f) => f.field === field)?.label ?? field;
  // With nothing ticked, "Ticked" is not on offer
  const target = scope === "ticked" && !ticked.size ? "empty" : scope;
  const plan = bulkPlan(products, field, value, target, ticked);
  const planAll = bulkPlan(products, field, value, "all", ticked);
  const empty = bulkPlan(products, field, value, "empty", ticked).fill.length;
  const total = Object.keys(products).length;
  const kept = total - empty;
  const canUndo = done?.after === JSON.stringify(products);

  const apply = () => {
    const changed = plan.fill.length + plan.replace.length;
    const after = applyBulk(products, field, value, plan);
    setDone({ before: products, after: JSON.stringify(after), message: `${label} set to “${text}” on ${plural(changed, "product")}.` });
    setValue("");
    onChange(after);
  };

  const undo = () => {
    if (done) onChange(done.before);
    setDone(null);
  };

  const suggestions = [...new Set([...(field === "category" ? PRODUCT_CATEGORIES : []), ...usedValues(products, field)])];

  return (
    <Box sx={{ mb: 2, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }} data-testid="product-bulk">
      <Typography variant="subtitle2" gutterBottom>
        Set a field on several products
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 0.5 }}>
        <TextField
          select
          label="Field"
          value={field}
          onChange={(e) => {
            setField(e.target.value);
            setValue("");
          }}
          size="small"
          sx={{ minWidth: 170 }}
        >
          {BULK_FIELDS.map((f) => (
            <MenuItem key={f.field} value={f.field}>
              {f.label}
            </MenuItem>
          ))}
        </TextField>
        {field === "type" ? (
          <TextField
            select
            label="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            size="small"
            fullWidth
            helperText={PRODUCT_TYPE_OPTIONS[value]?.description}
            SelectProps={{ renderValue: (v) => String(v) }}
          >
            {Object.entries(PRODUCT_TYPE_OPTIONS).map(([option, { label: primary, description }]) => (
              <MenuItem key={option} value={option}>
                <ListItemText primary={primary} secondary={description} />
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Autocomplete
            key={field}
            freeSolo
            fullWidth
            options={suggestions}
            inputValue={value}
            onInputChange={(_, v) => setValue(v)}
            renderInput={(params) => <TextField {...params} label="Value" size="small" />}
          />
        )}
      </Stack>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 2 }}>
        <RadioGroup row aria-label="Which products" value={target} onChange={(e) => onScope(e.target.value as BulkScope)} sx={{ flex: 1 }}>
          <FormControlLabel value="empty" control={<Radio size="small" />} label={`Empty only (${empty})`} />
          <FormControlLabel value="all" control={<Radio size="small" />} label={`All (${total})`} />
          <FormControlLabel value="ticked" control={<Radio size="small" />} label={`Ticked (${ticked.size})`} disabled={!ticked.size} />
        </RadioGroup>
        <Button
          variant="outlined"
          size="small"
          color={plan.replace.length ? "warning" : "primary"}
          disabled={!text || !(plan.fill.length + plan.replace.length)}
          onClick={apply}
        >
          {text ? applyLabel(plan) : "Choose a value"}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {target === "empty" && kept > 0 && text
          ? `${plural(kept, "product")} with a value already ${kept === 1 ? "keeps it" : "keep theirs"}${
              planAll.replace.length ? ` (${planAll.replace.length} different)` : ""
            }.`
          : "Tick products in the list below to set only those."}
      </Typography>
      {canUndo && done && (
        <Alert
          severity="success"
          sx={{ mt: 1 }}
          action={
            <Button color="inherit" size="small" onClick={undo}>
              Undo
            </Button>
          }
        >
          {done.message}
        </Alert>
      )}
    </Box>
  );
}
