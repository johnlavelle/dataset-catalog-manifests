import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Badge,
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Tab,
  Tabs,
  Tooltip,
} from "@mui/material";
import { HelpOutline, ArrowBack, NoteAddOutlined, FolderOpenOutlined, AutoStoriesOutlined } from "@mui/icons-material";
import validator from "@rjsf/validator-ajv8";
import ManifestForm from "./components/ManifestForm";
import YamlPreview from "./components/YamlPreview";
import ChecklistPanel from "./components/ChecklistPanel";
import InfoPage from "./components/InfoPage";
import type { IChangeEvent } from "@rjsf/core";
import { checklist, customValidate, emptyManifest, missingCount, normalise, schema, type Manifest } from "./compliance";
import transformErrors from "./transformErrors";
import { parseYaml } from "./yamlExport";
import exampleYaml from "../../examples/example-archived.yaml?raw";
import "./App.css";

const DRAFT_KEY = "dataset-manifest-editor:draft";

function loadDraft(): Manifest {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) return normalise(JSON.parse(saved));
  } catch {
    // Storage unavailable or corrupt: start fresh
  }
  return emptyManifest();
}

export default function App() {
  const [formData, setFormData] = useState<Manifest>(loadDraft);
  const [showInfo, setShowInfo] = useState(false);
  const [tab, setTab] = useState<"checklist" | "yaml">("checklist");
  const [confirmNew, setConfirmNew] = useState(false);
  const [message, setMessage] = useState<{ text: string; severity: "success" | "error" } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch {
      // Autosave is a convenience only
    }
  }, [formData]);

  const errors = useMemo(
    () => validator.validateFormData(formData, schema, customValidate, transformErrors).errors,
    [formData]
  );
  const missing = useMemo(() => missingCount(checklist(formData)), [formData]);

  const handleChange = useCallback((e: IChangeEvent) => {
    if (e.formData) setFormData(normalise(e.formData));
  }, []);

  const handleImport = useCallback((data: Manifest, source?: string) => {
    const imported = { ...data };
    if (!imported.id && source) imported.id = source.replace(/\.ya?ml$/i, "");
    if (!imported.status) imported.status = "proposed";
    setFormData(normalise(imported));
    setShowInfo(false);
  }, []);

  const openFile = async (file: File) => {
    try {
      handleImport(parseYaml(await file.text()), file.name);
      setMessage({ text: `Loaded ${file.name}`, severity: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not read the file", severity: "error" });
    }
  };

  const loadExample = () => {
    handleImport(parseYaml(exampleYaml));
    setMessage({ text: "Loaded an illustrative example of an archived dataset", severity: "success" });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar position="static" elevation={1}>
        <Toolbar variant="dense" sx={{ gap: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Dataset Manifest Editor
          </Typography>
          <Tooltip title="Start a new manifest">
            <Button color="inherit" startIcon={<NoteAddOutlined />} onClick={() => setConfirmNew(true)}>
              New
            </Button>
          </Tooltip>
          <Tooltip title="Open an existing manifest (.yaml)">
            <Button color="inherit" startIcon={<FolderOpenOutlined />} onClick={() => fileInput.current?.click()}>
              Open
            </Button>
          </Tooltip>
          <Tooltip title="Load a fully filled-in example">
            <Button color="inherit" startIcon={<AutoStoriesOutlined />} onClick={loadExample}>
              Example
            </Button>
          </Tooltip>
          <input
            ref={fileInput}
            type="file"
            accept=".yaml,.yml"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) openFile(file);
              e.target.value = "";
            }}
          />
          <IconButton
            color="inherit"
            onClick={() => setShowInfo((v) => !v)}
            title={showInfo ? "Back to editor" : "About the manifest and the archiving rules"}
          >
            {showInfo ? <ArrowBack /> : <HelpOutline />}
          </IconButton>
        </Toolbar>
      </AppBar>
      {showInfo ? (
        <InfoPage />
      ) : (
        <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              p: 3,
              borderRight: 1,
              borderColor: "divider",
            }}
          >
            <ManifestForm formData={formData} onChange={handleChange} />
          </Box>
          <Box
            sx={{
              width: 480,
              minWidth: 360,
              display: "flex",
              flexDirection: "column",
              bgcolor: "grey.50",
            }}
          >
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tab
                value="checklist"
                label={
                  <Badge color="error" badgeContent={errors.length || missing} sx={{ pr: 1.5 }}>
                    Checklist
                  </Badge>
                }
              />
              <Tab value="yaml" label="YAML" />
            </Tabs>
            <Box sx={{ flex: 1, overflow: "auto" }}>
              {tab === "checklist" ? (
                <ChecklistPanel formData={formData} errors={errors} />
              ) : (
                <YamlPreview formData={formData} onImport={(data) => handleImport(data)} />
              )}
            </Box>
          </Box>
        </Box>
      )}

      <Dialog open={confirmNew} onClose={() => setConfirmNew(false)}>
        <DialogTitle>Start a new manifest?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This clears the form. Download or copy the current YAML first if you want to keep it.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmNew(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              setFormData(emptyManifest());
              setConfirmNew(false);
              setShowInfo(false);
            }}
          >
            Clear form
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage(null)}>
        {message ? (
          <Alert severity={message.severity} onClose={() => setMessage(null)} variant="filled">
            {message.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
