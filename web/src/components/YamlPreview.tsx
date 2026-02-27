import { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  TextField,
  Button,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import { toYaml, downloadYaml, copyToClipboard, parseYaml } from "../yamlExport";

interface YamlPreviewProps {
  formData: Record<string, unknown>;
  onImport: (data: Record<string, unknown>) => void;
}

export default function YamlPreview({ formData, onImport }: YamlPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const yamlContent = toYaml(formData);

  const datasetName =
    (formData?.dataset as Record<string, unknown>)?.name as string | undefined;
  const filename = datasetName
    ? `${datasetName.toLowerCase().replace(/\s+/g, "_")}.yaml`
    : "manifest.yaml";

  const handleCopy = async () => {
    await copyToClipboard(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadYaml(yamlContent, filename);
  };

  const handleEditStart = () => {
    setEditText(yamlContent);
    setParseError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setParseError(null);
  };

  const handleApply = () => {
    try {
      const parsed = parseYaml(editText);
      onImport(parsed);
      setEditing(false);
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid YAML");
    }
  };

  return (
    <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {editing ? "Import YAML" : "YAML Preview"}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {editing ? (
            <>
              <Button size="small" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={handleApply}>
                Apply
              </Button>
            </>
          ) : (
            <>
              <Tooltip title="Edit / Import YAML">
                <IconButton size="small" onClick={handleEditStart}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
                <IconButton size="small" onClick={handleCopy}>
                  {copied ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title={`Download as ${filename}`}>
                <IconButton size="small" onClick={handleDownload}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      </Stack>
      <TextField
        multiline
        fullWidth
        value={editing ? editText : yamlContent}
        onChange={editing ? (e) => setEditText(e.target.value) : undefined}
        error={!!parseError}
        helperText={parseError}
        InputProps={{
          readOnly: !editing,
          sx: {
            fontFamily: "monospace",
            fontSize: "0.8rem",
            lineHeight: 1.5,
          },
        }}
        sx={{
          flex: 1,
          "& .MuiOutlinedInput-root": { height: "100%", alignItems: "flex-start" },
        }}
      />
    </Box>
  );
}
