import type { RJSFValidationError } from "@rjsf/utils";
import { Box, ButtonBase, Stack, Tooltip, Typography } from "@mui/material";
import { hasContent, type Manifest } from "../compliance";
import { statusOf } from "../guidance";
import { openSection, sectionOf } from "../navigation";
import { TONE_COLOR, requirement, sectionTone, visibleSections } from "./FormLayout";

const TONE_HINT = {
  error: "Has fields to fix",
  done: "Filled in",
  required: "Required now",
  idle: "Not needed yet",
} as const;

interface SectionNavProps {
  formData: Manifest;
  errors: RJSFValidationError[];
}

/** A bar of all section cards, coloured like the cards, that jumps to one on click. */
export default function SectionNav({ formData, errors }: SectionNavProps) {
  const status = statusOf(formData.status);
  return (
    <Box
      component="nav"
      aria-label="Sections"
      data-tour="sections"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        bgcolor: "rgba(242, 245, 249, 0.92)",
        backdropFilter: "blur(6px)",
        borderBottom: 1,
        borderColor: "divider",
        px: { xs: 2, md: 3 },
        py: 1,
      }}
    >
      {/* One row that scrolls sideways, so its height (and the cards' scroll margin) stays fixed */}
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ maxWidth: 960, mx: "auto", overflowX: "auto", scrollbarWidth: "thin", pb: 0.25 }}
      >
        {visibleSections(formData).map((s) => {
          const count = errors.filter((e) => sectionOf(e.property ?? "") === s.key).length;
          const filled = s.fields.some((f) => hasContent(formData[f]));
          const tone = sectionTone(count, filled, requirement(s, status).label === "Required");
          return (
            <Tooltip key={s.key} title={TONE_HINT[tone]}>
              <ButtonBase
                onClick={() => openSection(s.key)}
                sx={{
                  gap: 0.75,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 99,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  flex: "none",
                  "&:hover, &.Mui-focusVisible": { borderColor: "primary.main", bgcolor: "primary.light" },
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: TONE_COLOR[tone], flex: "none" }} />
                <Typography variant="caption" sx={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                  {s.title}
                </Typography>
              </ButtonBase>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
