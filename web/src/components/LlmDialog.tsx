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

/** Hands an AI assistant a file with which it interviews the user and writes the YAML. */
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
            <li>Download the prompt file. Nothing needs to be added to it.</li>
            <li>
              Upload it to your AI assistant (or paste its text) and send &ldquo;Start&rdquo;. In a command-line
              assistant, ask it to follow the instructions in the file; it can then look at the dataset directory
              itself.
            </li>
            <li>
              Answer its questions, a few at a time — &ldquo;don&rsquo;t know&rdquo; is a fine answer. It ends with
              the YAML.
            </li>
            <li>
              Paste the YAML into the YAML tab (edit button), or save it as a file and use <em>Open</em>. Then work
              through the checklist: the result is a draft, and you are still responsible for it.
            </li>
          </ol>
        </Typography>
        {hasDraft && (
          <FormControlLabel
            control={<Checkbox checked={includeDraft} onChange={(e) => setIncludeDraft(e.target.checked)} />}
            label="Include the current form, so the assistant only asks about what is missing"
          />
        )}
        <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
          Only share information with an external AI service if DMI's rules allow it — leave out personal data and
          anything confidential.
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => downloadFile(prompt(), "dataset-manifest-prompt.md", "text/markdown")}
          >
            Prompt (.md)
          </Button>
          <Button variant="outlined" startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />} onClick={handleCopy}>
            {copied ? "Copied" : "Copy prompt"}
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
