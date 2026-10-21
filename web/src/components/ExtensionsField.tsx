import { useRef } from "react";
import yaml from "js-yaml";
import type { FieldProps } from "@rjsf/utils";
import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { KeyInput } from "./ProductsField";

type Extensions = Record<string, unknown>;

const isText = (v: unknown) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/**
 * Free-form key/value pairs (extensions, additionalProperties: true). Text values are edited
 * here; lists and mappings, which rjsf cannot render without a schema, are shown read-only
 * and edited in the YAML tab.
 */
export default function ExtensionsField(props: FieldProps) {
  const data: Extensions = (props.formData as Extensions) || {};
  const entries = Object.entries(data);

  // Row ids that survive a rename, so the row is not remounted and keeps focus
  const ids = useRef(new Map<string, number>());
  const nextId = useRef(0);
  const rowId = (key: string) => {
    if (!ids.current.has(key)) ids.current.set(key, nextId.current++);
    return ids.current.get(key)!;
  };

  const set = (key: string, value: unknown) => props.onChange({ ...data, [key]: value });
  const remove = (key: string) => {
    const { [key]: _, ...rest } = data;
    ids.current.delete(key);
    props.onChange(rest);
  };
  // Preserve insertion order
  const rename = (oldKey: string, newKey: string) => {
    ids.current.set(newKey, rowId(oldKey));
    ids.current.delete(oldKey);
    props.onChange(Object.fromEntries(entries.map(([k, v]) => [k === oldKey ? newKey : k, v])));
  };
  const add = () => {
    let n = entries.length + 1;
    while (`item_${n}` in data) n++;
    set(`item_${n}`, "");
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {props.schema.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {props.schema.description}
      </Typography>
      <Stack spacing={1.5}>
        {entries.map(([key, value]) => (
          <Stack key={rowId(key)} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
              <KeyInput
                value={key}
                taken={(k) => k in data}
                onCommit={(k) => rename(key, k)}
                label="Key"
                helper="A short name, e.g. forcing_note"
                takenText="Another entry already uses this key"
              />
            </Box>
            <Box sx={{ flex: 2, minWidth: 0, width: "100%" }}>
              {isText(value) ? (
                <TextField
                  label="Value"
                  value={String(value)}
                  onChange={(e) => set(key, e.target.value)}
                  multiline
                  size="small"
                  fullWidth
                />
              ) : (
                <TextField
                  label="Value (a list or mapping: edit it in the YAML tab)"
                  value={yaml.dump(value, { indent: 2, lineWidth: 100 }).trimEnd()}
                  multiline
                  size="small"
                  fullWidth
                  InputProps={{ readOnly: true, sx: { fontFamily: "monospace", fontSize: "0.8rem" } }}
                />
              )}
            </Box>
            <Tooltip title="Remove">
              <IconButton onClick={() => remove(key)} aria-label={`Remove ${key}`}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        ))}
      </Stack>
      <Button startIcon={<AddIcon />} onClick={add} variant="outlined" size="small" sx={{ mt: 1.5 }}>
        Add information
      </Button>
    </Box>
  );
}
