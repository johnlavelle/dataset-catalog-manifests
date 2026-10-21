import { useEffect, useRef } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import mermaid from "mermaid";
import { REQUIRED_BY_STATUS } from "../guidance";

mermaid.initialize({ startOnLoad: false, theme: "default" });

const LIFECYCLE_DIAGRAM = `stateDiagram-v2
    direction LR
    [*] --> Proposed
    Proposed --> Active: register
    Active --> Archived: archive
    Archived --> Deprecated: deprecate
    Deprecated --> Deleted: delete
    Deprecated --> Active: restore
    Proposed --> Deleted: withdraw
    Deleted --> [*]
`;

const WORKFLOW_DIAGRAM = `graph TD
    A["Steward fills in the manifest in this editor"] --> B["Download the YAML (named after the catalogue ID)"]
    B --> C["Commit it to manifests/ in a merge request"]
    C --> D["CI validates: errors block the merge, warnings are listed"]
    D --> E["Data Owner approves the merge request (Procedure A.7)"]
    E --> F["Merged: the entry is part of the catalogue"]
`;

function Mermaid({ id, chart }: { id: string; chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    mermaid.render(id, chart).then(({ svg }) => {
      if (!cancelled && ref.current) ref.current.innerHTML = svg;
    });
    return () => {
      cancelled = true;
    };
  }, [id, chart]);
  return (
    <Box
      ref={ref}
      sx={{ display: "flex", justifyContent: "center", my: 2, "& svg": { maxWidth: "100%", height: "auto" } }}
    />
  );
}

const ROLES: [string, string, string][] = [
  ["Data Owner", "What is this dataset for, who may use it, how long do we keep it?", "Project lead, group head, product owner"],
  ["Data Steward", "Is this dataset described, documented and fit for use?", "Senior researcher, dataset maintainer"],
  ["Data Custodian", "Is it stored, protected and accessible according to the Standard?", "IT / HPC"],
];

const DOCUMENTS: [string, string][] = [
  ["Policy (POL-STOR-ARCH-001)", "The direction: keep the right data, in the right place, for the right length of time."],
  ["Standard (STD-STOR-ARCH-001)", "The requirements (SHALL / SHOULD / MAY with stable REQ-IDs). This manifest is its catalogue entry (§4.2)."],
  ["Procedures (PRC-STOR-ARCH-001)", "Step by step: register (A), prepare (B), archive (C, D), recall (E), folders (F), delete (G), incidents (H)."],
  ["Guidelines (GDL-STOR-ARCH-001)", "The judgement calls: tiers, appraisal, retention, names, file sizes, compression, licences."],
];

export default function InfoPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4, overflow: "auto", height: "100%" }}>
      <Typography variant="h4" gutterBottom>
        About the Dataset Manifest Editor
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          What is this?
        </Typography>
        <Typography paragraph>
          A manifest is the catalogue entry for one dataset, as required by DMI's Storage and Archiving Standard (§4,
          REQ-CAT-001–009). It records what a person has to decide or know — owner, retention, licence, appraisal,
          where the data lives.
        </Typography>
        <Typography>
          Manifests live in Git, are reviewed in merge requests and are validated by CI against the same JSON Schema
          that drives this form. Every dataset that outlives a short project is registered before it is moved to
          archive folders (REQ-CAT-001/002).
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Dataset lifecycle
        </Typography>
        <Typography>
          The status decides which fields are mandatory. Set it with the stepper at the top of the form; the cards and
          the checklist follow.
        </Typography>
        <Mermaid id="lifecycle-diagram" chart={LIFECYCLE_DIAGRAM} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 180 }}>Status</TableCell>
              <TableCell>Mandatory fields</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {REQUIRED_BY_STATUS.map(([status, fields]) => (
              <TableRow key={status}>
                <TableCell sx={{ fontWeight: 500 }}>{status}</TableCell>
                <TableCell>{fields}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Roles
        </Typography>
        <Typography paragraph>
          Every dataset has a named Owner, Steward and Custodian. One person may hold all three for a small dataset, but
          the entry must say so. Procedures start from the assumption that the three are named — if not, assign them
          first.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Role</TableCell>
              <TableCell>Answers the question</TableCell>
              <TableCell>Usually</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ROLES.map(([role, question, who]) => (
              <TableRow key={role}>
                <TableCell sx={{ fontWeight: 500 }}>{role}</TableCell>
                <TableCell>{question}</TableCell>
                <TableCell>{who}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Mandatory, recommended, optional
        </Typography>
        <Typography component="div">
          <ul>
            <li>
              <strong>SHALL</strong> requirements are enforced: the form marks the field as required and CI rejects the
              manifest.
            </li>
            <li>
              <strong>SHOULD</strong> requirements are recommendations: the checklist and CI show a warning, but nothing
              is blocked.
            </li>
            <li>
              <strong>Not known yet?</strong> For facts and links (PID, pages, release date) switch on “Not known yet” to
              record <code>TBD by YYYY-MM-DD</code> (Procedure A.5). CI lists open placeholders and flags overdue ones.
              Decisions — roles, retention, licence — cannot be postponed, and no placeholder may remain once a dataset
              is archived.
            </li>
            <li>
              Deviations from a SHALL requirement need a registered exception with an expiry date at most 12 months
              ahead; list it under <em>Notes &amp; exceptions</em>.
            </li>
          </ul>
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Workflow
        </Typography>
        <Mermaid id="workflow-diagram" chart={WORKFLOW_DIAGRAM} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          The document set
        </Typography>
        <Table size="small">
          <TableBody>
            {DOCUMENTS.map(([doc, what]) => (
              <TableRow key={doc}>
                <TableCell sx={{ fontWeight: 500, width: 240 }}>{doc}</TableCell>
                <TableCell>{what}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Each card in the form has a “How to fill this in” section with the relevant guidance, and the checklist cites
          the requirement behind each item.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Getting started
        </Typography>
        <Typography component="div">
          <ul>
            <li>
              <strong>New</strong> — fill in the form; the checklist and the YAML update as you type. Your draft is kept
              in this browser.
            </li>
            <li>
              <strong>Open</strong> — load an existing manifest file to continue editing it, or paste YAML via the edit
              button in the YAML tab.
            </li>
            <li>
              <strong>Example</strong> — load a fully filled-in (fictional) archived dataset to see every field in use.
            </li>
            <li>
              <strong>AI prompt</strong> — download a file and upload it to an AI assistant as it is. The assistant
              interviews you a few questions at a time and ends with the YAML; paste that back here and check it
              against the checklist. The schema and example can also be downloaded separately.
            </li>
          </ul>
        </Typography>
      </Paper>
    </Container>
  );
}
