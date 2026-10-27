import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Badge,
  Box,
  AppBar,
  Chip,
  Divider,
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
import {
  HelpOutline,
  ArrowBack,
  NoteAddOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  AutoStoriesOutlined,
  SmartToyOutlined,
  Inventory2Outlined,
} from "@mui/icons-material";
import validator from "@rjsf/validator-ajv8";
import ManifestForm from "./components/ManifestForm";
import YamlPreview from "./components/YamlPreview";
import ChecklistPanel from "./components/ChecklistPanel";
import StepsPanel from "./components/StepsPanel";
import SectionNav from "./components/SectionNav";
import InfoPage from "./components/InfoPage";
import LlmDialog from "./components/LlmDialog";
import RecentDialog, { manifestTitle } from "./components/RecentDialog";
import ErrorBoundary from "./components/ErrorBoundary";
import SplitHandle, { FORM_MIN, PANEL_DEFAULT, PANEL_MIN, clampPanel } from "./components/SplitHandle";
import type { IChangeEvent } from "@rjsf/core";
import {
  checklist,
  customValidate,
  emptyManifest,
  missingCount,
  normalise,
  schema,
  type Manifest,
  asText,
} from "./compliance";
import { STATUS_INFO, statusOf } from "./guidance";
import { findSaved, isBlank, loadDraft, newKey, saveDraft, type Draft, type SavedManifest } from "./draft";
import transformErrors from "./transformErrors";
import { parseYaml } from "./yamlExport";
import exampleYaml from "../../examples/example-archived.yaml?raw";
import "./App.css";

const PANEL_KEY = "dataset-manifest-editor:panel-width";

function loadPanelWidth(): number {
  try {
    const saved = Number(localStorage.getItem(PANEL_KEY));
    if (saved > 0) return clampPanel(saved);
  } catch {
    // Storage unavailable: use the default width
  }
  return PANEL_DEFAULT;
}

/** A file or pasted YAML as the form holds it: named after the file if it has no ID, Proposed if it has no status. */
function prepareImport(data: Manifest, source?: string): Manifest {
  const imported = { ...data };
  if (!imported.id && source) imported.id = source.replace(/\.ya?ml$/i, "");
  if (!imported.status) imported.status = "proposed";
  return normalise(imported);
}

export default function App() {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const formData = draft.data;
  /** Whether the browser keeps the form: false in some private windows, or when its storage is full. */
  const [stored, setStored] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [tab, setTab] = useState<"checklist" | "steps" | "yaml">("checklist");
  const [showLlm, setShowLlm] = useState(false);
  const [pending, setPending] = useState<{ title: string; confirm: string; run: () => void } | null>(null);
  const [message, setMessage] = useState<{ text: string; severity: "success" | "error" } | null>(null);
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const panel = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStored(saveDraft(draft));
  }, [draft]);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, String(panelWidth));
    } catch {
      // The width is remembered only as a convenience
    }
  }, [panelWidth]);

  const errors = useMemo(
    () => validator.validateFormData(formData, schema, customValidate, transformErrors).errors,
    [formData]
  );
  const missing = useMemo(() => missingCount(checklist(formData)), [formData]);

  const handleChange = useCallback((e: IChangeEvent) => {
    if (!e.formData) return;
    const data = normalise(e.formData);
    setDraft((d) => ({ key: d.key, data }));
  }, []);

  /**
   * Put another manifest in the form, under an entry of its own (the one already holding the same
   * manifest, if any). The manifest it replaces stays under Recent.
   */
  const show = useCallback((data: Manifest, key = findSaved(data)?.key ?? newKey()) => {
    setDraft({ key, data });
    setShowInfo(false);
    return key;
  }, []);

  const formHasContent = !isBlank(formData);
  /** Said when another entry replaces the form, so that the user knows where the previous manifest went. */
  const kept = (key: string) =>
    formHasContent && stored && key !== draft.key ? " The previous manifest is under Recent." : "";

  const openFile = async (file: File) => {
    try {
      const key = show(prepareImport(parseYaml(await file.text()), file.name));
      setMessage({ text: `Loaded ${file.name}.${kept(key)}`, severity: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not read the file", severity: "error" });
    }
  };

  const loadExample = () => {
    const key = show(prepareImport(parseYaml(exampleYaml)));
    setMessage({ text: `Loaded an illustrative example of an archived dataset.${kept(key)}`, severity: "success" });
  };

  const startNew = () => {
    const note = kept(show(emptyManifest(), newKey()));
    if (note) setMessage({ text: `Started a new manifest.${note}`, severity: "success" });
  };

  const openSaved = (entry: SavedManifest) => {
    setShowRecent(false);
    if (entry.key === draft.key) {
      setShowInfo(false);
      return;
    }
    replaceForm("Open another manifest?", "Open", () => {
      show(normalise(entry.data), entry.key);
      setMessage({ text: `Opened “${manifestTitle(entry.data)}”.${kept(entry.key)}`, severity: "success" });
    });
  };

  /**
   * Replacing the form loses nothing while the browser keeps it under Recent; otherwise ask
   * before replacing a form that holds anything beyond the defaults.
   */
  const replaceForm = (title: string, confirm: string, run: () => void) => {
    if (formHasContent && !stored) setPending({ title, confirm, run });
    else run();
  };

  const title = asText(formData.dataset?.name) || asText(formData.id);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{ background: "linear-gradient(90deg, #083f78 0%, #0b5cad 100%)" }}
      >
        <Toolbar variant="dense" sx={{ gap: 0.5, minHeight: 56 }}>
          <Inventory2Outlined sx={{ mr: 1, opacity: 0.9 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.1rem", whiteSpace: "nowrap" }}>
            Dataset Manifest Editor
          </Typography>
          <Box sx={{ flexGrow: 1, minWidth: 0, display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1, ml: 2 }}>
            {!showInfo && (
              <>
                <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,255,255,0.3)", my: 1.5 }} />
                <Typography variant="body2" noWrap sx={{ opacity: 0.9, ml: 1 }} title={title}>
                  {title || "Untitled dataset"}
                </Typography>
                <Chip
                  size="small"
                  label={STATUS_INFO[statusOf(formData.status)].label}
                  sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "inherit", flex: "none" }}
                />
              </>
            )}
          </Box>
          <Box sx={{ flexGrow: 1, display: { xs: "block", md: "none" } }} />
          <Tooltip title="Start a new manifest">
            <Button
              color="inherit"
              startIcon={<NoteAddOutlined />}
              onClick={() => replaceForm("Start a new manifest?", "Clear form", startNew)}
            >
              New
            </Button>
          </Tooltip>
          <Tooltip title="Open an existing manifest (.yaml)">
            <Button
              color="inherit"
              startIcon={<FolderOpenOutlined />}
              onClick={() => replaceForm("Open another manifest?", "Choose file", () => fileInput.current?.click())}
            >
              Open
            </Button>
          </Tooltip>
          <Tooltip title="Manifests you have edited in this browser">
            <Button color="inherit" startIcon={<HistoryOutlined />} onClick={() => setShowRecent(true)}>
              Recent
            </Button>
          </Tooltip>
          <Tooltip title="Load a fully filled-in example">
            <Button
              color="inherit"
              startIcon={<AutoStoriesOutlined />}
              onClick={() => replaceForm("Load the example?", "Load example", loadExample)}
            >
              Example
            </Button>
          </Tooltip>
          <Tooltip title="Get a file that lets an AI assistant interview you and write the manifest">
            <Button color="inherit" startIcon={<SmartToyOutlined />} onClick={() => setShowLlm(true)}>
              AI prompt
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
        <ErrorBoundary formData={formData} onReset={() => show(emptyManifest(), newKey())}>
          <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <Box sx={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <SectionNav formData={formData} errors={errors} />
              <Box sx={{ maxWidth: 960, mx: "auto", p: { xs: 2, md: 3 }, pb: 8 }}>
                <ManifestForm formData={formData} onChange={handleChange} />
              </Box>
            </Box>
            <SplitHandle panelRef={panel} width={panelWidth} onChange={setPanelWidth} />
            <Box
              ref={panel}
              style={{ width: panelWidth }}
              sx={{
                flex: "none",
                minWidth: PANEL_MIN,
                maxWidth: `calc(100% - ${FORM_MIN}px)`,
                display: "flex",
                flexDirection: "column",
                bgcolor: "#f8fafc",
                borderLeft: 1,
                borderColor: "divider",
              }}
            >
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="fullWidth"
                sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}
              >
                <Tab
                  value="checklist"
                  label={
                    <Badge color="error" badgeContent={errors.length || missing} sx={{ pr: 1.5 }}>
                      Checklist
                    </Badge>
                  }
                />
                <Tab value="steps" label="Steps" />
                <Tab value="yaml" label="YAML" />
              </Tabs>
              <Box sx={{ flex: 1, overflow: "auto" }}>
                {tab === "checklist" && <ChecklistPanel formData={formData} errors={errors} />}
                {tab === "steps" && <StepsPanel formData={formData} errors={errors} />}
                {tab === "yaml" && (
                  <YamlPreview
                    formData={formData}
                    onImport={(data) => setDraft((d) => ({ key: d.key, data: prepareImport(data) }))}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </ErrorBoundary>
      )}

      <Dialog open={!!pending} onClose={() => setPending(null)}>
        <DialogTitle>{pending?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This browser is not keeping what you type (some private windows do not, or its storage is full), so this
            replaces what is in the form now. Download or copy the current YAML first if you want to keep it.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              pending?.run();
              setPending(null);
            }}
          >
            {pending?.confirm}
          </Button>
        </DialogActions>
      </Dialog>

      <RecentDialog
        open={showRecent}
        onClose={() => setShowRecent(false)}
        currentKey={draft.key}
        stored={stored}
        onOpen={openSaved}
      />

      <LlmDialog open={showLlm} onClose={() => setShowLlm(false)} formData={formData} hasDraft={formHasContent} />

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
