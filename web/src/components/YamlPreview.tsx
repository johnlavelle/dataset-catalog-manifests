import { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  TextField,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import CheckIcon from "@mui/icons-material/Check";
import { toYaml, downloadYaml, copyToClipboard } from "../yamlExport";

interface YamlPreviewProps {
  formData: Record<string, unknown>;
}

export default function YamlPreview({ formData }: YamlPreviewProps) {
  const [copied, setCopied] = useState(false);

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

  return (
    <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          YAML Preview
        </Typography>
        <Stack direction="row" spacing={0.5}>
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
        </Stack>
      </Stack>
      <TextField
        multiline
        fullWidth
        value={yamlContent}
        InputProps={{
          readOnly: true,
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
