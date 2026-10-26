import { useEffect, useState } from "react";
import type { ErrorSchema, ObjectFieldTemplatePropertyType, ObjectFieldTemplateProps } from "@rjsf/utils";
import { Templates } from "@rjsf/mui";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import CheckIcon from "@mui/icons-material/Check";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import { hasContent, type Manifest } from "../compliance";
import { ENTRY_SECTION, OPEN_SECTION_EVENT, sectionDomId } from "../navigation";
import { SECTIONS, SECTION_OBJECT_KEYS, SUBSECTION_TITLES, statusOf, type Guidance, type SectionInfo, type Status } from "../guidance";
import type { EditorContext } from "./widgets";

const MuiObjectFieldTemplate = Templates.ObjectFieldTemplate!;

function countErrors(schema: ErrorSchema | undefined): number {
  if (!schema || typeof schema !== "object") return 0;
  let n = 0;
  for (const [key, value] of Object.entries(schema)) {
    if (key === "__errors") n += Array.isArray(value) ? value.length : 0;
    else n += countErrors(value as ErrorSchema);
  }
  return n;
}

export function requirement(section: SectionInfo, status: Status): { label: string; color: "primary" | "default" } {
  if (section.requiredFor === "always" || section.requiredFor.includes(status))
    return { label: "Required", color: "primary" };
  if (status === "proposed" && section.requiredFor.includes("active"))
    return { label: "Needed to register", color: "default" };
  if ((status === "proposed" || status === "active") && section.requiredFor.includes("archived"))
    return { label: "Needed to archive", color: "default" };
  return { label: "Optional", color: "default" };
}

/** How a card looks at a glance: errors to fix, filled in, still needed now, or neither. */
export type SectionTone = "error" | "done" | "required" | "idle";

export function sectionTone(errors: number, filled: boolean, required: boolean): SectionTone {
  if (errors > 0) return "error";
  if (filled) return "done";
  return required ? "required" : "idle";
}

export const TONE_COLOR: Record<SectionTone, string> = {
  error: "error.main",
  done: "success.main",
  required: "primary.main",
  idle: "grey.400",
};

/** Sections shown for the data: Deletion only once the dataset is on its way out, or already filled in. */
export function visibleSections(formData: Manifest): SectionInfo[] {
  const status = statusOf(formData.status);
  return SECTIONS.filter(
    (s) => s.key !== "deletion" || status === "deprecated" || status === "deleted" || hasContent(formData.deletion)
  );
}

function GuidanceBox({ guidance }: { guidance: Guidance }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mb: 2 }}>
      <Button size="small" startIcon={<LightbulbOutlinedIcon />} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide guidance" : "How to fill this in"}
      </Button>
      <Collapse in={open}>
        <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: "#f5f9fe", borderColor: "#cfe0f3" }}>
          {guidance.intro && (
            <Typography variant="body2" sx={{ fontStyle: "italic", mb: 1 }}>
              {guidance.intro}
            </Typography>
          )}
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {guidance.points.map((p) => (
              <Typography key={p} component="li" variant="body2" sx={{ mb: 0.5 }}>
                {p}
              </Typography>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Source: {guidance.source}
          </Typography>
        </Paper>
      </Collapse>
    </Box>
  );
}

interface SectionCardProps {
  section: SectionInfo;
  number: number;
  props: Record<string, ObjectFieldTemplatePropertyType>;
  formData: Manifest;
  errorSchema?: ErrorSchema;
}

function SectionCard({ section, number, props, formData, errorSchema }: SectionCardProps) {
  const status = statusOf(formData.status);
  const errors = section.fields.reduce((n, f) => n + countErrors((errorSchema as Record<string, ErrorSchema>)?.[f]), 0);
  const filled = section.fields.some((f) => hasContent(formData[f]));
  const req = requirement(section, status);
  const auto = req.label === "Required" || filled || errors > 0;
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? auto;
  const multi = section.fields.length > 1;
  const tone = sectionTone(errors, filled, req.label === "Required");

  // Opened from the checklist or the section bar
  useEffect(() => {
    const onOpen = (e: Event) => (e as CustomEvent<string>).detail === section.key && setOpen(true);
    window.addEventListener(OPEN_SECTION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SECTION_EVENT, onOpen);
  }, [section.key]);

  return (
    <Accordion
      id={sectionDomId(section.key)}
      expanded={isOpen}
      onChange={(_, v) => setOpen(v)}
      disableGutters
      variant="outlined"
      sx={{
        "&:before": { display: "none" },
        borderLeft: 4,
        borderLeftColor: TONE_COLOR[tone],
        scrollMarginTop: 72,
        transition: "box-shadow 0.2s",
        "&.Mui-expanded": { boxShadow: "0 1px 3px rgba(16, 24, 40, 0.08)" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
        <Avatar
          sx={{
            width: 30,
            height: 30,
            mr: 1.5,
            mt: 0.25,
            alignSelf: "flex-start",
            fontSize: "0.85rem",
            fontWeight: 600,
            bgcolor: tone === "idle" ? "grey.100" : TONE_COLOR[tone],
            color: tone === "idle" ? "text.secondary" : "common.white",
          }}
        >
          {tone === "done" ? <CheckIcon fontSize="small" /> : tone === "error" ? <PriorityHighIcon fontSize="small" /> : number}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h6" sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
              {section.title}
            </Typography>
            <Chip size="small" label={req.label} color={req.color} variant={req.color === "primary" ? "filled" : "outlined"} />
            {errors > 0 && <Chip size="small" color="error" label={`${errors} to fix`} />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {section.summary}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pl: { sm: 7.5 } }}>
        {section.guidance && <GuidanceBox guidance={section.guidance} />}
        <Stack spacing={2} divider={multi ? <Divider flexItem /> : undefined}>
          {section.fields.map((f) =>
            props[f] ? (
              <Box key={f}>
                {multi && SUBSECTION_TITLES[f] && (
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    {SUBSECTION_TITLES[f]}
                  </Typography>
                )}
                {props[f].content}
              </Box>
            ) : null
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function RootLayout({ properties, registry, errorSchema }: ObjectFieldTemplateProps) {
  const formData = ((registry.formContext as EditorContext)?.formData ?? {}) as Manifest;
  const byName = Object.fromEntries(properties.map((p) => [p.name, p]));
  const visible = visibleSections(formData);

  return (
    <Stack spacing={2}>
      <Paper id={sectionDomId(ENTRY_SECTION)} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: "10px", scrollMarginTop: 72 }}>
        <Stack spacing={2}>
          {byName.status?.content}
          {byName.id?.content}
        </Stack>
      </Paper>
      {visible.map((s, i) => (
        <SectionCard key={s.key} section={s} number={i + 1} props={byName} formData={formData} errorSchema={errorSchema} />
      ))}
    </Stack>
  );
}

/** Root: entry header + section cards. Section objects: just their fields. Others: MUI default. */
export default function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const id = props.idSchema.$id;
  if (id === "root") return <RootLayout {...props} />;
  if (id.startsWith("root_") && SECTION_OBJECT_KEYS.has(id.slice(5))) {
    return (
      <Grid container spacing={2}>
        {props.properties.map((p) =>
          p.hidden ? (
            p.content
          ) : (
            <Grid item xs={12} key={p.name}>
              {p.content}
            </Grid>
          )
        )}
      </Grid>
    );
  }
  return <MuiObjectFieldTemplate {...props} />;
}
