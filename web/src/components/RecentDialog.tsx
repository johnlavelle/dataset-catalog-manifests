import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { DeleteOutline, DownloadOutlined } from "@mui/icons-material";
import { asText, isMapping, type Manifest } from "../compliance";
import { STATUS_INFO, statusOf } from "../guidance";
import { removeSaved, restoreSaved, savedManifests, type SavedManifest } from "../draft";
import { downloadManifest } from "../yamlExport";

interface RecentDialogProps {
  open: boolean;
  onClose: () => void;
  /** The entry open in the editor. */
  currentKey: string;
  /** The browser keeps what is typed: false in some private windows, or when its storage is full. */
  stored: boolean;
  onOpen: (entry: SavedManifest) => void;
}

export const manifestTitle = (data: Manifest) =>
  asText(isMapping(data.dataset) ? data.dataset.name : undefined) || asText(data.id) || "Untitled dataset";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "5 minutes ago", "yesterday". */
function ago(time: number): string {
  const seconds = (time - Date.now()) / 1000;
  for (const [unit, length] of UNITS)
    if (Math.abs(seconds) >= length) return relative.format(Math.round(seconds / length), unit);
  return "just now";
}

/** Every manifest edited in this browser, to open again, download or remove. */
export default function RecentDialog({ open, onClose, currentKey, stored, onOpen }: RecentDialogProps) {
  const [entries, setEntries] = useState<SavedManifest[]>([]);
  const [removed, setRemoved] = useState<SavedManifest | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(savedManifests());
    setRemoved(null);
  }, [open]);

  const remove = (entry: SavedManifest) => {
    removeSaved(entry.key);
    setRemoved(entry);
    setEntries(savedManifests());
  };

  const undo = () => {
    if (removed) restoreSaved(removed);
    setRemoved(null);
    setEntries(savedManifests());
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Recent manifests</DialogTitle>
      <DialogContent dividers>
        {!stored && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This browser is not keeping what you type (some private windows do not, or its storage is full). Download
            the YAML to keep your work.
          </Alert>
        )}
        {removed && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={undo}>
                Undo
              </Button>
            }
          >
            Removed &ldquo;{manifestTitle(removed.data)}&rdquo;.
          </Alert>
        )}
        {entries.length ? (
          <List dense disablePadding>
            {entries.map((entry) => {
              const current = entry.key === currentKey;
              const id = asText(entry.data.id);
              return (
                <ListItem
                  key={entry.key}
                  disablePadding
                  secondaryAction={
                    <Stack direction="row">
                      <Tooltip title="Download the YAML">
                        <IconButton edge="end" onClick={() => downloadManifest(entry.data)}>
                          <DownloadOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!current && (
                        <Tooltip title="Remove from this browser">
                          <IconButton edge="end" onClick={() => remove(entry)} sx={{ ml: 0.5 }}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  }
                  sx={{ "& .MuiListItemButton-root": { pr: current ? 7 : 11 } }}
                >
                  <ListItemButton selected={current} onClick={() => onOpen(entry)}>
                    <ListItemText
                      primary={
                        <>
                          {manifestTitle(entry.data)}
                          {current && <Chip size="small" label="Open now" color="primary" sx={{ ml: 1, height: 20 }} />}
                        </>
                      }
                      secondary={
                        <>
                          {id ? <code>{id}</code> : "No ID yet"} · {STATUS_INFO[statusOf(entry.data.status)].label} ·{" "}
                          <span title={new Date(entry.saved).toLocaleString()}>changed {ago(entry.saved)}</span>
                        </>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        ) : (
          <Typography color="text.secondary">Nothing here yet.</Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Every manifest you edit is kept here as you type, so opening another one loses nothing. They are kept only
          in this browser on this computer: the editor in another browser or at another address has its own list.
          Clearing the browser&rsquo;s site data removes them, and some browsers clear it by themselves when the page
          has not been visited for a while. Download the YAML to keep a copy or to submit it.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
