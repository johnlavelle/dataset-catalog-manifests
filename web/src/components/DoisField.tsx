import type { FieldProps } from "@rjsf/utils";
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

type DoisMap = Record<string, string>;

export default function DoisField(props: FieldProps) {
  const dois: DoisMap = (props.formData as DoisMap) || {};
  const entries = Object.entries(dois);

  const update = (newDois: DoisMap) => {
    props.onChange(Object.keys(newDois).length > 0 ? newDois : undefined);
  };

  const addEntry = () => {
    update({ ...dois, "": "" });
  };

  const removeEntry = (oldKey: string) => {
    const { [oldKey]: _, ...rest } = dois;
    update(rest);
  };

  const updateKey = (oldKey: string, newKey: string, idx: number) => {
    const result: DoisMap = {};
    let i = 0;
    for (const [k, v] of Object.entries(dois)) {
      if (i === idx) result[newKey] = v;
      else if (k === oldKey) result[k] = v;
      else result[k] = v;
      i++;
    }
    update(result);
  };

  const updateValue = (key: string, value: string) => {
    update({ ...dois, [key]: value });
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" gutterBottom>
        DOIs
      </Typography>
      <Stack spacing={1}>
        {entries.map(([key, value], idx) => (
          <Box key={idx} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <TextField
              label="Product ID"
              value={key}
              onChange={(e) => updateKey(key, e.target.value, idx)}
              size="small"
              sx={{ flex: 1 }}
              placeholder="e.g. BALTICSEA_MULTIYEAR_PHY_003_011"
            />
            <TextField
              label="DOI"
              value={value}
              onChange={(e) => updateValue(key, e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              placeholder="e.g. 10.48670/moi-00013"
            />
            <IconButton
              size="small"
              color="error"
              onClick={() => removeEntry(key)}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        ))}
      </Stack>
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={addEntry}
        sx={{ mt: 1 }}
      >
        Add DOI
      </Button>
    </Box>
  );
}
