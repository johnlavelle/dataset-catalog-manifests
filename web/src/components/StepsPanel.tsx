import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { Manifest } from "../compliance";
import { STATUS_INFO, statusOf } from "../guidance";
import { goTo } from "../navigation";
import { stagesFor, stepDone, type Command, type Stage, type Step } from "../steps";

const ROLE_COLOUR = { Owner: "secondary", Steward: "primary", Custodian: "success" } as const;

/** A shell snippet with a copy button. */
function CommandBlock({ command }: { command: Command }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused (e.g. not a secure context): the text can still be selected by hand
    }
  };
  return (
    <Box sx={{ mt: 1 }}>
      {command.label && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.25 }}>
          {command.label}
        </Typography>
      )}
      <Box sx={{ position: "relative" }}>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1,
            pr: 4.5,
            bgcolor: "#0f172a",
            color: "#e2e8f0",
            borderRadius: 1.5,
            fontSize: 12,
            lineHeight: 1.5,
            overflowX: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          }}
        >
          {command.code}
        </Box>
        <Tooltip title={copied ? "Copied" : "Copy"}>
          <IconButton
            size="small"
            onClick={copy}
            aria-label="Copy command"
            sx={{ position: "absolute", top: 4, right: 4, color: "#cbd5e1" }}
          >
            {copied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function StepItem({ step, index, data }: { step: Step; index: number; data: Manifest }) {
  const done = stepDone(data, step);
  return (
    <Box sx={{ display: "flex", gap: 1.25, py: 1.25, "&:not(:last-of-type)": { borderBottom: 1, borderColor: "divider" } }}>
      <Box sx={{ flex: "none", width: 24, pt: 0.1, textAlign: "center" }}>
        {done ? (
          <Tooltip title="Recorded in the manifest" placement="left">
            <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
          </Tooltip>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {index + 1}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" sx={{ fontWeight: 600, mr: 0.5 }}>
            {step.title}
          </Typography>
          {step.who?.map((role) => (
            <Chip key={role} label={role} size="small" variant="outlined" color={ROLE_COLOUR[role]} sx={{ height: 20 }} />
          ))}
        </Stack>
        {step.text && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {step.text}
          </Typography>
        )}
        {step.tip && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
            <TipsAndUpdatesOutlinedIcon color="warning" sx={{ fontSize: 16 }} />
            <Typography variant="caption" color="text.secondary">
              {step.tip}
            </Typography>
          </Stack>
        )}
        {step.commands?.map((c, i) => <CommandBlock key={i} command={c} />)}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
          <Typography variant="caption" color="text.disabled">
            {step.ref}
          </Typography>
          {step.link && (
            <Link variant="caption" href={step.link.href} target="_blank" rel="noopener">
              {step.link.label}
            </Link>
          )}
          {step.fields?.length ? (
            <Link
              component="button"
              variant="caption"
              onClick={() => goTo(step.fields![0])}
              sx={{ display: "inline-flex", alignItems: "center" }}
            >
              {done ? "See in form" : "Fill in"}
              <ChevronRightIcon sx={{ fontSize: 14 }} />
            </Link>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}

function StageCard({ stage, data }: { stage: Stage; data: Manifest }) {
  const recordable = stage.steps.filter((s) => s.fields?.length).length;
  const doneCount = stage.steps.filter((s) => stepDone(data, s)).length;
  return (
    <Accordion
      defaultExpanded={!stage.later}
      disableGutters
      variant="outlined"
      sx={{ mb: 1.5, borderRadius: "10px !important", "&:before": { display: "none" }, overflow: "hidden" }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {stage.title}
            </Typography>
            <Chip
              size="small"
              label={stage.later ? "Later" : "Now"}
              color={stage.later ? "default" : "primary"}
              variant={stage.later ? "outlined" : "filled"}
            />
          </Stack>
          {recordable > 0 && (
            <Typography variant="caption" color="text.secondary">
              {doneCount} of {recordable} recorded in the manifest
              {recordable < stage.steps.length ? ` · ${stage.steps.length - recordable} to check yourself` : ""}
            </Typography>
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0 }}>
        {stage.intro && (
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {stage.intro}
          </Typography>
        )}
        {stage.steps.map((step, i) => (
          <StepItem key={step.title} step={step} index={i} data={data} />
        ))}
      </AccordionDetails>
    </Accordion>
  );
}

export default function StepsPanel({ formData }: { formData: Manifest }) {
  const status = statusOf(formData.status);
  return (
    <Box sx={{ p: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: "10px" }}>
        <Typography variant="subtitle2">What to do — {STATUS_INFO[status].label}</Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          The work behind this status, in order, with who does each step. Commands use the values in this manifest; check
          them before running. Change the status at the top of the form to see the steps for another stage.
        </Typography>
      </Paper>
      {stagesFor(formData).map((stage) => (
        // A stage moving from Later to Now remounts, so that it opens
        <StageCard key={`${stage.key}-${stage.later ? "later" : "now"}`} stage={stage} data={formData} />
      ))}
    </Box>
  );
}
