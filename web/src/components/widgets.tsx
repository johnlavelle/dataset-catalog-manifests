import { useEffect, useState } from "react";
import type { WidgetProps } from "@rjsf/utils";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControlLabel,
  ListItemText,
  MenuItem,
  Stack,
  Step,
  StepButton,
  Stepper,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { addDays, slugify, type Manifest } from "../compliance";
import { STATUSES, STATUS_INFO, statusOf, type Option } from "../guidance";

/** Shared with every widget through rjsf's formContext. */
export interface EditorContext {
  formData: Manifest;
}

const ctxOf = (props: WidgetProps) => (props.registry.formContext ?? { formData: {} }) as EditorContext;
const hasErrors = (props: WidgetProps) => (props.rawErrors?.length ?? 0) > 0;

/** Lifecycle status as a clickable stepper (Standard §4, Figure 1). */
export function StatusWidget({ value, onChange, disabled, readonly }: WidgetProps) {
  const status = statusOf(value);
  const unknown = value !== undefined && value !== status;
  const index = STATUSES.indexOf(status);
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Lifecycle status
      </Typography>
      <Stepper nonLinear alternativeLabel activeStep={index} sx={{ mb: 1.5 }}>
        {STATUSES.map((s, i) => (
          <Step key={s} completed={status !== "deleted" && i < index}>
            <StepButton
              onClick={() => onChange(s)}
              disabled={disabled || readonly}
              optional={
                <Typography variant="caption" color="text.secondary" component="div" sx={{ textAlign: "center" }}>
                  {STATUS_INFO[s].short}
                </Typography>
              }
            >
              {STATUS_INFO[s].label}
            </StepButton>
          </Step>
        ))}
      </Stepper>
      {unknown ? (
        <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
          <strong>"{String(value)}"</strong> is not a lifecycle status. Pick one above; until then the form treats the
          entry as Proposed.
        </Alert>
      ) : (
        <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
          <strong>{STATUS_INFO[status].label}:</strong> {STATUS_INFO[status].detail}
        </Alert>
      )}
    </Box>
  );
}

/** Catalogue ID with a "suggest from title" helper. */
export function IdWidget(props: WidgetProps) {
  const { id, value, onChange, label, required, disabled, readonly, placeholder } = props;
  const name: string | undefined = ctxOf(props).formData?.dataset?.name;
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <TextField
        id={id}
        label={label}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled || readonly}
        // Suggest the title's slug without filling it in: the ID must not follow later title edits
        placeholder={name ? slugify(name) : placeholder || "e.g. danra-data"}
        InputLabelProps={name ? { shrink: true } : undefined}
        error={hasErrors(props)}
        fullWidth
      />
      <Tooltip title={name ? `Use "${slugify(name)}"` : "Fill in the dataset title first"}>
        <span>
          <Button
            variant="outlined"
            sx={{ whiteSpace: "nowrap", height: 56 }}
            disabled={!name || disabled || readonly}
            onClick={() => name && onChange(slugify(name))}
          >
            From title
          </Button>
        </span>
      </Tooltip>
    </Stack>
  );
}

const PERSON_PARTS = /^(.*?)\s*<([^<>]*)>\s*$/;

function splitPerson(value: unknown): { name: string; email: string } {
  if (typeof value !== "string" || !value) return { name: "", email: "" };
  const m = PERSON_PARTS.exec(value);
  return m ? { name: m[1], email: m[2] } : { name: value, email: "" };
}

function joinPerson(name: string, email: string): string | undefined {
  const n = name.trim();
  const e = email.trim();
  return n || e ? `${n} <${e}>` : undefined;
}

/** "Full Name <email@dmi.dk>" edited as two inputs. ui:options.copyFrom copies another role. */
export function PersonWidget(props: WidgetProps) {
  const { id, value, onChange, label, required, disabled, readonly, options } = props;
  const [parts, setParts] = useState(() => splitPerson(value));

  // Re-sync when the value changes from outside (YAML import, "copy from Owner").
  useEffect(() => {
    if (joinPerson(parts.name, parts.email) !== (value || undefined)) setParts(splitPerson(value));
  }, [value]);

  const update = (next: { name: string; email: string }) => {
    setParts(next);
    onChange(joinPerson(next.name, next.email));
  };

  const copyFrom = options.copyFrom as string | undefined;
  const source: string | undefined = copyFrom ? ctxOf(props).formData?.roles?.[copyFrom] : undefined;

  // A fixed list of people to choose from (the approved Data Owners)
  const choices = (options.choices as string[] | undefined) ?? [];
  if (choices.length) {
    return (
      <Autocomplete
        freeSolo
        options={choices}
        value={value ?? ""}
        onChange={(_, v) => onChange(v || undefined)}
        onInputChange={(_, v, reason) => reason === "input" && onChange(v || undefined)}
        disabled={disabled || readonly}
        renderInput={(params) => (
          <TextField
            {...params}
            id={id}
            label={label}
            required={required}
            error={hasErrors(props)}
            placeholder="Type to search the approved Data Owners"
          />
        )}
      />
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          id={id}
          label={label}
          required={required}
          value={parts.name}
          placeholder="Full name or team"
          onChange={(e) => update({ ...parts, name: e.target.value })}
          disabled={disabled || readonly}
          error={hasErrors(props)}
          sx={{ flex: 3 }}
        />
        <TextField
          id={`${id}_email`}
          label="E-mail"
          type="email"
          required={required}
          value={parts.email}
          placeholder="name@dmi.dk"
          onChange={(e) => update({ ...parts, email: e.target.value })}
          disabled={disabled || readonly}
          error={hasErrors(props)}
          sx={{ flex: 2 }}
        />
      </Stack>
      {copyFrom && source && source !== value && (
        <Button size="small" sx={{ mt: 0.5 }} onClick={() => onChange(source)} disabled={disabled || readonly}>
          Same person as the {copyFrom}
        </Button>
      )}
    </Box>
  );
}

/**
 * A text, URL or date input that can instead hold a "TBD by YYYY-MM-DD" placeholder
 * (Procedure A.5). Placeholders are refused once the dataset is archived.
 */
export function TbdWidget(props: WidgetProps) {
  const { id, value, onChange, label, required, disabled, readonly, options, placeholder } = props;
  const inputType = (options.inputType as string) || "text";
  const isTbd = typeof value === "string" && value.startsWith("TBD");
  const archived = ctxOf(props).formData?.status === "archived";
  const due = isTbd ? value.replace(/^TBD by\s*/, "") : "";

  const toggle = (on: boolean) => onChange(on ? `TBD by ${addDays(30)}` : undefined);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
      {isTbd ? (
        <TextField
          id={id}
          type="date"
          label={`${label} — to be decided by`}
          required={required}
          value={due}
          onChange={(e) => onChange(`TBD by ${e.target.value}`)}
          disabled={disabled || readonly}
          error={hasErrors(props)}
          InputLabelProps={{ shrink: true }}
          helperText={`Saved as "TBD by ${due || "YYYY-MM-DD"}"`}
          fullWidth
        />
      ) : (
        <TextField
          id={id}
          type={inputType}
          label={label}
          required={required}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value || undefined)}
          disabled={disabled || readonly}
          error={hasErrors(props)}
          InputLabelProps={inputType === "date" ? { shrink: true } : undefined}
          fullWidth
        />
      )}
      <Tooltip
        title={
          archived && !isTbd
            ? "Placeholders are not allowed once a dataset is archived (REQ-ARC-001)"
            : "Not known yet? Record a placeholder with the date it will be decided by (Procedure A.5)"
        }
      >
        <FormControlLabel
          sx={{ whiteSpace: "nowrap", mr: 0 }}
          control={
            <Switch
              size="small"
              checked={isTbd}
              onChange={(e) => toggle(e.target.checked)}
              disabled={disabled || readonly || (archived && !isTbd)}
            />
          }
          label={<Typography variant="body2">Not known yet</Typography>}
        />
      </Tooltip>
    </Stack>
  );
}

/** A select whose options carry a label and an explanation (ui:options.choices). */
export function DescribedSelectWidget(props: WidgetProps) {
  const { id, value, onChange, label, required, disabled, readonly, options } = props;
  const choices = (options.choices ?? {}) as Record<string, Option>;
  const values = (options.enumOptions ?? []).map((o) => String(o.value));
  return (
    <TextField
      id={id}
      select
      fullWidth
      label={label}
      required={required}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      disabled={disabled || readonly}
      error={hasErrors(props)}
      helperText={value ? choices[value]?.description : undefined}
      SelectProps={{ renderValue: (v) => choices[v as string]?.label ?? String(v) }}
    >
      <MenuItem value="">
        <em>Not set</em>
      </MenuItem>
      {values.map((v) => (
        <MenuItem key={v} value={v} sx={{ whiteSpace: "normal" }}>
          <ListItemText
            primary={choices[v]?.label ?? v}
            secondary={choices[v]?.description}
            secondaryTypographyProps={{ sx: { whiteSpace: "normal", maxWidth: 520 } }}
          />
        </MenuItem>
      ))}
    </TextField>
  );
}

export const widgets = {
  StatusWidget,
  IdWidget,
  PersonWidget,
  TbdWidget,
  DescribedSelectWidget,
};
