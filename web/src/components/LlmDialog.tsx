import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import { buildPrompt, exampleYaml, schemaText } from "../llmPrompt";
import { copyToClipboard, downloadFile, toYaml } from "../yamlExport";
import type { Manifest } from "../compliance";

interface LlmDialogProps {
  open: boolean;
  onClose: () => void;
  formData: Manifest;
  /** The form holds something worth handing to the assistant as a starting point. */
  hasDraft: boolean;
}

/** Hands the schema, rules and guidance to an AI assistant, which writes the YAML. */
export default function LlmDialog({ open, onClose, formData, hasDraft }: LlmDialogProps) {
  const [includeDraft, setIncludeDraft] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copied = copyState === "copied";

  const prompt = () => buildPrompt(hasDraft && includeDraft ? toYaml(formData) : undefined);

  const handleCopy = async () => {
    try {
      await copyToClipboard(prompt());
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Write the manifest with an AI assistant</DialogTitle>
      <DialogContent>
        <Typography component="div" variant="body2">
          <ol style={{ paddingLeft: 20, marginTop: 0 }}>
            <li>
              Copy or download the prompt. It contains the instructions, the rules for each status, the DMI guidance,
              the JSON Schema and a complete example.
            </li>
            <li>
              Paste it into your AI assistant and add what you know about the dataset at the end — notes, a directory
              listing, an existing wiki page. It will ask about anything mandatory that is missing.
            </li>
            <li>
              Paste the YAML it returns into the YAML tab (edit button), or save it as a file and use <em>Open</em>.
              Then work through the checklist: the result is a draft, and you are still responsible for it.
            </li>
          </ol>
        </Typography>
        {hasDraft && (
          <FormControlLabel
            control={<Checkbox checked={includeDraft} onChange={(e) => setIncludeDraft(e.target.checked)} />}
            label="Include the current form as a starting point"
          />
        )}
        <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
          Only share information with an external AI service if DMI's rules allow it — leave out personal data and
          anything confidential.
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          <Button
            variant="contained"
            startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy prompt"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadFile(prompt(), "dataset-manifest-prompt.md", "text/markdown")}
          >
            Prompt (.md)
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadFile(schemaText, "dataset_manifest.schema.json", "application/json")}
          >
            Schema (.json)
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadFile(exampleYaml, "example-archived.yaml", "text/yaml")}
          >
            Example (.yaml)
          </Button>
        </Stack>
        {copyState === "failed" && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            The browser did not allow copying. Download the prompt (.md) instead and paste its contents.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
