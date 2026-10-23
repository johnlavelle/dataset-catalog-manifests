import type { RJSFValidationError } from "@rjsf/utils";
import { Alert, Box, Chip, List, ListItem, ListItemIcon, ListItemText, Stack, Tooltip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ScheduleIcon from "@mui/icons-material/Schedule";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import { checklist, missingCount, placeholders, type CheckState, type Manifest } from "../compliance";
import { STATUS_INFO, statusOf } from "../guidance";

const ICONS: Record<CheckState, { icon: JSX.Element; hint: string }> = {
  ok: { icon: <CheckCircleIcon color="success" fontSize="small" />, hint: "Done" },
  missing: { icon: <ErrorIcon color="error" fontSize="small" />, hint: "Mandatory now" },
  todo: { icon: <RadioButtonUncheckedIcon color="disabled" fontSize="small" />, hint: "Needed for the next step" },
  tbd: { icon: <ScheduleIcon color="warning" fontSize="small" />, hint: "Placeholder — resolve before archiving" },
  warn: { icon: <WarningAmberIcon color="warning" fontSize="small" />, hint: "Recommended (SHOULD)" },
  optional: { icon: <RemoveIcon color="disabled" fontSize="small" />, hint: "Only where it applies" },
  manual: { icon: <HandymanOutlinedIcon color="action" fontSize="small" />, hint: "Outside the manifest — check yourself" },
};

const RELATION_LABEL = { now: "Required now", next: "Next step", later: "Later" } as const;

function prettyPath(property: string | undefined): string {
  return (property ?? "").replace(/^\./, "").replace(/\./g, " › ") || "manifest";
}

interface ChecklistPanelProps {
  formData: Manifest;
  errors: RJSFValidationError[];
}

export default function ChecklistPanel({ formData, errors }: ChecklistPanelProps) {
  const status = statusOf(formData.status);
  const groups = checklist(formData);
  const missing = missingCount(groups);
  const tbds = placeholders(formData);
  const warnings = groups
    .filter((g) => g.relation === "now")
    .reduce((n, g) => n + g.items.filter((i) => i.state === "warn").length, 0);
  const open = [
    tbds.length && `${tbds.length} placeholder${tbds.length === 1 ? "" : "s"}`,
    warnings && `${warnings} recommendation${warnings === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <Box sx={{ p: 2 }}>
      {missing === 0 && errors.length === 0 ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          Complete for status <strong>{STATUS_INFO[status].label}</strong>
          {open.length ? ` — still open: ${open.join(", ")}.` : "."}
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {errors.length > 0
            ? `${errors.length} field error${errors.length === 1 ? "" : "s"} to fix`
            : `${missing} mandatory item${missing === 1 ? "" : "s"} open`}{" "}
          for status <strong>{STATUS_INFO[status].label}</strong>.
        </Alert>
      )}

      {groups.map((g) => (
        <Box key={g.key} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2">{g.title}</Typography>
            <Chip size="small" variant="outlined" label={RELATION_LABEL[g.relation]} color={g.relation === "now" ? "primary" : "default"} />
          </Stack>
          <List dense disablePadding>
            {g.items.map((item) => (
              <ListItem key={item.label} disableGutters sx={{ py: 0 }}>
                <Tooltip title={ICONS[item.state].hint} placement="left">
                  <ListItemIcon sx={{ minWidth: 30 }}>{ICONS[item.state].icon}</ListItemIcon>
                </Tooltip>
                <ListItemText
                  primary={item.label}
                  secondary={item.ref}
                  primaryTypographyProps={{ variant: "body2", color: item.state === "todo" ? "text.secondary" : undefined }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      ))}

      {tbds.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Open placeholders</Typography>
          <List dense disablePadding>
            {tbds.map((t) => (
              <ListItem key={t.path} disableGutters sx={{ py: 0 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <ScheduleIcon color={t.overdue ? "error" : "warning"} fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={t.path}
                  secondary={t.overdue ? `overdue since ${t.due}` : `to be decided by ${t.due}`}
                  primaryTypographyProps={{ variant: "body2" }}
                  secondaryTypographyProps={{ variant: "caption", color: t.overdue ? "error" : undefined }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {errors.length > 0 && (
        <Box>
          <Typography variant="subtitle2">Field errors</Typography>
          <List dense disablePadding>
            {errors.map((e, i) => (
              <ListItem key={`${e.property}-${i}`} disableGutters sx={{ py: 0 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <ErrorIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={prettyPath(e.property)}
                  secondary={e.message}
                  primaryTypographyProps={{ variant: "body2" }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
