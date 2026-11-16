import { useState } from "react";
import { Alert, Autocomplete, Box, Button, Checkbox, FormControlLabel, ListItemText, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { PART_CATEGORIES, PART_TYPE_OPTIONS } from "../guidance";
import { applyBulk, bulkPlan, usedValues, BULK_FIELDS, type BulkPlan, type Parts } from "../partBulk";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function applyLabel({ fill, replace }: BulkPlan): string {
  if (!fill.length && !replace.length) return "Nothing to change";
  if (!replace.length) return `Set on ${plural(fill.length, "part")}`;
  return `Replace ${plural(replace.length, "value")}${fill.length ? `, fill ${fill.length}` : ""}`;
}

/** The change just made, which can be taken back until the parts change again. */
interface Done {
  before: Parts;
  after: string;
  message: string;
}

/**
 * Set a field on the parts ticked in the list. "All" ticks every part, or unticks them all; "Only empty
 * values" leaves the parts that already have a value as they are.
 */
export default function PartBulkBar({
  parts,
  ticked,
  onTickAll,
  onChange,
}: {
  parts: Parts;
  ticked: Set<string>;
  onTickAll: (on: boolean) => void;
  onChange: (parts: Parts) => void;
}) {
  const [field, setField] = useState(BULK_FIELDS[0].field);
  const [value, setValue] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const text = value.trim();
  const label = BULK_FIELDS.find((f) => f.field === field)?.label ?? field;
  const keys = Object.keys(parts);
  const total = keys.length;
  // Ticks of parts since removed in the YAML do not count
  const tickedCount = keys.filter((k) => ticked.has(k)).length;
  const plan = bulkPlan(parts, field, value, ticked, onlyEmpty);
  const canUndo = done?.after === JSON.stringify(parts);

  const apply = () => {
    const changed = plan.fill.length + plan.replace.length;
    const after = applyBulk(parts, field, value, plan);
    setDone({ before: parts, after: JSON.stringify(after), message: `${label} set to “${text}” on ${plural(changed, "part")}.` });
    setValue("");
    onChange(after);
  };

  const undo = () => {
    if (done) onChange(done.before);
    setDone(null);
  };

  const suggestions = [...new Set([...(field === "category" ? PART_CATEGORIES : []), ...usedValues(parts, field)])];

  let caption = "Tick parts in the list below, or All.";
  if (tickedCount && plan.keep.length)
    caption = `${plural(plan.keep.length, "ticked part")} with another value ${plan.keep.length === 1 ? "keeps it" : "keep theirs"}.`;
  else if (tickedCount) caption = `${plural(tickedCount, "part")} ticked.`;

  return (
    <Box sx={{ mb: 2, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }} data-testid="part-bulk">
      <Typography variant="subtitle2" gutterBottom>
        Set a field on several parts
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
            helperText={PART_TYPE_OPTIONS[value]?.description}
            SelectProps={{ renderValue: (v) => String(v) }}
          >
            {Object.entries(PART_TYPE_OPTIONS).map(([option, { label: primary, description }]) => (
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
        <Box sx={{ flex: 1, display: "flex", flexWrap: "wrap", columnGap: 2 }}>
          <FormControlLabel
            label={`All (${total})`}
            control={
              <Checkbox
                size="small"
                checked={total > 0 && tickedCount === total}
                indeterminate={tickedCount > 0 && tickedCount < total}
                onChange={() => onTickAll(tickedCount < total)}
              />
            }
          />
          <FormControlLabel
            label="Only empty values"
            control={<Checkbox size="small" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />}
          />
        </Box>
        <Button
          variant="outlined"
          size="small"
          color={plan.replace.length ? "warning" : "primary"}
          disabled={!text || !(plan.fill.length + plan.replace.length)}
          onClick={apply}
        >
          {!tickedCount ? "Tick parts first" : text ? applyLabel(plan) : "Choose a value"}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {caption}
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
