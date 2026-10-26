import type { RJSFValidationError } from "@rjsf/utils";
import {
  Box,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ScheduleIcon from "@mui/icons-material/Schedule";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { checklist, missingCount, placeholders, type CheckState, type Manifest } from "../compliance";
import { STATUS_INFO, statusOf } from "../guidance";
import { goTo } from "../navigation";

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

/** Rows needing attention get a faint tint in their state's colour. */
const ROW_TINT: Partial<Record<CheckState, string>> = { missing: "error.light", warn: "warning.light", tbd: "warning.light" };

function prettyPath(property: string | undefined): string {
  return (property ?? "").replace(/^\./, "").replace(/\./g, " › ") || "manifest";
}

interface RowProps {
  icon: JSX.Element;
  hint?: string;
  primary: string;
  secondary?: string;
  secondaryColor?: string;
  dim?: boolean;
  tint?: string;
  /** Field to jump to; without one the row is plain text. */
  target?: string;
}

function Row({ icon, hint, primary, secondary, secondaryColor, dim, tint, target }: RowProps) {
  const content = (
    <>
      <Tooltip title={hint ?? ""} placement="left" disableHoverListener={!hint}>
        <ListItemIcon sx={{ minWidth: 32 }}>{icon}</ListItemIcon>
      </Tooltip>
      <ListItemText
        primary={primary}
        secondary={secondary}
        primaryTypographyProps={{ variant: "body2", color: dim ? "text.secondary" : undefined }}
        secondaryTypographyProps={{ variant: "caption", color: secondaryColor }}
        sx={{ my: 0.25 }}
      />
    </>
  );
  const sx = { borderRadius: 1.5, py: 0.25, px: 1, mb: 0.25, bgcolor: tint };
  if (!target) return <ListItem sx={sx}>{content}</ListItem>;
  return (
    <ListItem disablePadding>
      <ListItemButton
        onClick={() => goTo(target)}
        sx={{
          ...sx,
          "& .goto-arrow": { opacity: 0, transition: "opacity 0.15s" },
          "&:hover .goto-arrow, &.Mui-focusVisible .goto-arrow": { opacity: 1 },
        }}
      >
        {content}
        <ChevronRightIcon className="goto-arrow" fontSize="small" color="action" />
      </ListItemButton>
    </ListItem>
  );
}

function Group({ title, chip, children }: { title: string; chip?: JSX.Element; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ mb: 1.5, p: 1.5, pb: 1, borderRadius: "10px" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75, px: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        {chip}
      </Stack>
      <List dense disablePadding>
        {children}
      </List>
    </Paper>
  );
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
  const current = groups.filter((g) => g.relation === "now");
  const warnings = current.reduce((n, g) => n + g.items.filter((i) => i.state === "warn").length, 0);
  const open = [
    tbds.length && `${tbds.length} placeholder${tbds.length === 1 ? "" : "s"}`,
    warnings && `${warnings} recommendation${warnings === 1 ? "" : "s"}`,
  ].filter(Boolean);

  // Progress over the mandatory items for the current status (placeholders count as done for now)
  const mandatory = current.flatMap((g) => g.items).filter((i) => i.mandatory);
  const done = mandatory.length - missing;
  const complete = missing === 0 && errors.length === 0;

  return (
    <Box sx={{ p: 2 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          borderRadius: "10px",
          borderColor: complete ? "success.main" : "divider",
          bgcolor: complete ? "success.light" : "background.paper",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          {complete ? <TaskAltIcon color="success" /> : <ErrorIcon color={errors.length ? "error" : "warning"} />}
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2">
              {complete
                ? `Complete for ${STATUS_INFO[status].label}`
                : errors.length > 0
                  ? `${errors.length} field error${errors.length === 1 ? "" : "s"} to fix`
                  : `${missing} mandatory item${missing === 1 ? "" : "s"} open`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {complete
                ? open.length
                  ? `Still open: ${open.join(", ")}.`
                  : "Nothing left for this status."
                : `For status ${STATUS_INFO[status].label} · ${done} of ${mandatory.length} mandatory items done`}
            </Typography>
          </Box>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={mandatory.length ? (100 * done) / mandatory.length : 100}
          color={complete ? "success" : "primary"}
          sx={{ mt: 1.5, height: 6, borderRadius: 3, bgcolor: "action.hover" }}
        />
        {!complete && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Click an item to jump to its field.
          </Typography>
        )}
      </Paper>

      {groups.map((g) => (
        <Box key={g.key} sx={{ opacity: g.relation === "later" ? 0.8 : 1 }}>
          <Group
            title={g.title}
            chip={
              <Chip
                size="small"
                variant={g.relation === "now" ? "filled" : "outlined"}
                label={RELATION_LABEL[g.relation]}
                color={g.relation === "now" ? "primary" : "default"}
              />
            }
          >
            {g.items.map((item) => (
              <Row
                key={item.label}
                icon={ICONS[item.state].icon}
                hint={ICONS[item.state].hint}
                primary={item.label}
                secondary={item.ref}
                dim={item.state === "todo"}
                tint={ROW_TINT[item.state]}
                target={item.state === "manual" ? undefined : item.target}
              />
            ))}
          </Group>
        </Box>
      ))}

      {tbds.length > 0 && (
        <Group title="Open placeholders">
          {tbds.map((t) => (
            <Row
              key={t.path}
              icon={<ScheduleIcon color={t.overdue ? "error" : "warning"} fontSize="small" />}
              primary={t.path}
              secondary={t.overdue ? `overdue since ${t.due}` : `to be decided by ${t.due}`}
              secondaryColor={t.overdue ? "error" : undefined}
              target={t.path}
            />
          ))}
        </Group>
      )}

      {errors.length > 0 && (
        <Group title="Field errors" chip={<Chip size="small" color="error" label={errors.length} />}>
          {errors.map((e, i) => (
            <Row
              key={`${e.property}-${i}`}
              icon={<ErrorIcon color="error" fontSize="small" />}
              primary={prettyPath(e.property)}
              secondary={e.message}
              tint="error.light"
              target={e.property || undefined}
            />
          ))}
        </Group>
      )}
    </Box>
  );
}
