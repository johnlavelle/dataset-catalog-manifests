import { useState } from "react";
import type { ErrorSchema, ObjectFieldTemplatePropertyType, ObjectFieldTemplateProps } from "@rjsf/utils";
import { Templates } from "@rjsf/mui";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import { hasContent, type Manifest } from "../compliance";
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

function requirement(section: SectionInfo, status: Status): { label: string; color: "primary" | "default" } {
  if (section.requiredFor === "always" || section.requiredFor.includes(status))
    return { label: "Required", color: "primary" };
  if (status === "proposed" && section.requiredFor.includes("active"))
    return { label: "Needed to register", color: "default" };
  if ((status === "proposed" || status === "active") && section.requiredFor.includes("archived"))
    return { label: "Needed to archive", color: "default" };
  return { label: "Optional", color: "default" };
}

function GuidanceBox({ guidance }: { guidance: Guidance }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mb: 2 }}>
      <Button size="small" startIcon={<LightbulbOutlinedIcon />} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide guidance" : "How to fill this in"}
      </Button>
      <Collapse in={open}>
        <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: "#f7f9fc" }}>
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
  props: Record<string, ObjectFieldTemplatePropertyType>;
  formData: Manifest;
  errorSchema?: ErrorSchema;
}

function SectionCard({ section, props, formData, errorSchema }: SectionCardProps) {
  const status = statusOf(formData.status);
  const errors = section.fields.reduce((n, f) => n + countErrors((errorSchema as Record<string, ErrorSchema>)?.[f]), 0);
  const filled = section.fields.some((f) => hasContent(formData[f]));
  const req = requirement(section, status);
  const auto = req.label === "Required" || filled || errors > 0;
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? auto;
  const multi = section.fields.length > 1;

  return (
    <Accordion
      expanded={isOpen}
      onChange={(_, v) => setOpen(v)}
      disableGutters
      variant="outlined"
      sx={{ "&:before": { display: "none" }, borderRadius: 1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h6" sx={{ fontSize: "1.05rem" }}>
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
      <AccordionDetails>
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
  const status = statusOf(formData.status);
  const visible = SECTIONS.filter(
    (s) => s.key !== "deletion" || status === "deleted" || hasContent(formData.deletion)
  );

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          {byName.status?.content}
          {byName.id?.content}
        </Stack>
      </Paper>
      {visible.map((s) => (
        <SectionCard key={s.key} section={s} props={byName} formData={formData} errorSchema={errorSchema} />
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
