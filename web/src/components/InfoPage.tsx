import { useEffect, useRef, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Container,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import mermaid from "mermaid";
import { REQUIRED_BY_STATUS } from "../guidance";
import { ARCHIVE_TOOL, CONFLUENCE_FAQ, CONFLUENCE_PROCESS, CONFLUENCE_QMS_ARCHIVING, CONFLUENCE_STORAGE } from "../steps";

mermaid.initialize({ startOnLoad: false, theme: "default" });

const REPOSITORY = "https://gitlab.dmi.dk/jola/dataset-catalog-manifests";

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

const WORKFLOW_DIAGRAM = `%%{init: {"flowchart": {"rankSpacing": 24}}}%%
graph LR
    A["Download the YAML"] --> B["Merge request"]
    B --> C["CI checks"]
    C --> D["Owner approves"]
    D --> E["In the catalogue"]
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

const CONTENTS: [string, string][] = [
  ["start", "Quick start"],
  ["screen", "The screen"],
  ["submit", "Submitting"],
  ["lifecycle", "Lifecycle"],
  ["roles", "Roles"],
  ["rules", "Rules & placeholders"],
  ["conventions", "Conventions"],
  ["faq", "Common questions"],
  ["help", "Documents & help"],
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Paper id={`about-${id}`} sx={{ p: 3, mb: 3, scrollMarginTop: 16 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function SimpleTable({ head, rows, firstWidth }: { head?: string[]; rows: ReactNode[][]; firstWidth?: number }) {
  return (
    <Table size="small">
      {head && (
        <TableHead>
          <TableRow>
            {head.map((h) => (
              <TableCell key={h}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
      )}
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j} sx={j === 0 ? { fontWeight: 500, width: firstWidth, verticalAlign: "top" } : undefined}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const SCREEN: [string, ReactNode][] = [
  [
    "Top bar",
    <>
      <em>New</em>, <em>Open</em> (a .yaml file), <em>Example</em> (a complete, fictional archived dataset) and{" "}
      <em>AI prompt</em>. The <em>?</em> button opens this page and takes you back.
    </>,
  ],
  [
    "Section bar",
    "Jumps to a card. Each section shows whether it has fields to fix, is required now, is filled in, or is not needed yet.",
  ],
  [
    "Cards",
    <>
      One per section. <em>How to fill this in</em> opens the guidance from the DMI documents. Fields that only apply
      to another choice stay hidden.
    </>,
  ],
  [
    "Checklist tab",
    "What the chosen status requires, what the next status will need, recommendations and open placeholders, each with the requirement behind it. Click an item to go to its field.",
  ],
  [
    "Steps tab",
    "The work behind the chosen status, in order and by role: registering, preparing, packaging data as squashfs, checksums, deleting. Commands are filled in from the manifest; tips that are not in the DMI documents are marked as such.",
  ],
  [
    "YAML tab",
    <>
      The manifest as it will be saved: copy it, download it as <code>&lt;id&gt;.yaml</code>, or edit or paste YAML
      (e.g. from an AI assistant) and apply it to the form.
    </>,
  ],
  ["Divider", "Drag the line between the form and the side panel to resize it; double-click to reset."],
  [
    "Your draft",
    "Saved in this browser as you type, and nothing is sent anywhere. New, Open and Example ask before replacing it. Download the YAML to keep or share it.",
  ],
];

const ROLES: [string, string, string][] = [
  ["Data Owner", "What is this dataset for, who may use it, how long do we keep it?", "Project lead, group head, product owner"],
  ["Data Steward", "Is this dataset described, documented and fit for use?", "Senior researcher, dataset maintainer"],
  [
    "Data Custodian",
    "Is it stored, protected and accessible according to the Standard?",
    "IT (file storage or database team); a team mailbox is fine",
  ],
];

const CONVENTIONS: [string, ReactNode][] = [
  [
    "Catalogue ID",
    <>
      Short and stable: lower-case letters, digits, <code>-</code> and <code>_</code>. It becomes the file name{" "}
      <code>&lt;id&gt;.yaml</code> and never changes, even when the title does. <em>From title</em> suggests one.
    </>,
  ],
  [
    "People",
    <>
      <code>Full Name &lt;name@dmi.dk&gt;</code>. One person may hold all three roles; then tick the box that says so.
    </>,
  ],
  ["Dates", <>ISO 8601: <code>YYYY-MM-DD</code>.</>],
  [
    "Formats, containers, compression",
    <>
      Three separate lists. Yearly squashfs images of zstd-compressed netCDF and PNG files are formats{" "}
      <em>netCDF, image</em>, container <em>squashfs</em>, compression <em>zstd</em>. An edition or convention goes in{" "}
      <em>Format details</em>, tool options in <em>Compression settings</em>.
    </>,
  ],
  [
    "DOIs",
    <>
      <em>DOI of this dataset</em> is its own DOI only. DOIs of other things — a Copernicus Marine product made from the
      data, a paper describing it, its input data — go under <em>Related DOIs</em>.
    </>,
  ],
  [
    "WIS2 discipline",
    "One per entry: archive folders do not mix disciplines (REQ-NAME-005), so a dataset that spans two is split into two entries.",
  ],
  [
    "Anything else",
    <>
      Information with no field of its own goes under <em>Other information</em> as a key and a value, or in a
      product's notes or the notes for the Designated Community. YAML comments are not kept.
    </>,
  ],
  [
    "What to leave out",
    "Facts a scan of the files can find (time span, area, variables, sizes), and personal or sensitive details about the data's contents.",
  ],
];

const FAQ: [string, ReactNode][] = [
  [
    "I don't know everything yet.",
    <>
      Save it as <em>Proposed</em> with what you know: that is what Proposed is for. Once the dataset is registered,
      facts and links not known yet can be recorded as <code>TBD by YYYY-MM-DD</code>; decisions cannot.
    </>,
  ],
  [
    "Which status should I choose?",
    <>
      <em>Proposed</em> until the Owner has decided the roles, retention and licence; <em>Active</em> once registered
      and in use; <em>Archived</em> when written to /dmidata/archive; <em>Deprecated</em> when flagged for retirement
      but still kept; <em>Deleted</em> when the data is gone — the entry stays.
    </>,
  ],
  [
    "Do I need to fill in STAC metadata?",
    "No. A STAC catalogue is generated from the manifest and a scan of the files, which finds the time span, area, variables and sizes. The manifest holds only what a person has to know or decide.",
  ],
  [
    "Where do Copernicus Marine or other external DOIs go?",
    <>
      Under <em>Related DOIs</em> (in <em>Identifiers, links &amp; dates</em>), with what each one is — e.g. the
      product code. <em>DOI of this dataset</em> is only for a DOI registered for this dataset itself.
    </>,
  ],
  [
    "How do I turn a .tar.gz into a squashfs image?",
    <>
      Open the <em>Steps</em> tab with the status set to <em>Archived</em> (or look at the later stages under{" "}
      <em>Active</em>). <em>Package and write to the archive</em> shows how to unpack and package it, or convert it
      directly with tar2sqfs, and how to check the result before the source is removed.
    </>,
  ],
  [
    "The editor says it cannot show this manifest.",
    <>
      The file or draft holds something the form cannot display. <em>Download draft</em> keeps a copy;{" "}
      <em>Start a new manifest</em> clears it. Files that use older field names (free-text format or compression,{" "}
      <code>dataset.contact</code>, a <code>stac</code> section) are converted automatically when opened.
    </>,
  ],
  [
    "Who approves the entry?",
    "The Data Owner (Procedure A.7). In the catalogue repository the approval is given in the merge request; without it the entry is not registered.",
  ],
];

const DOCUMENTS: [string, string][] = [
  ["Policy (POL-STOR-ARCH-001)", "The direction: keep the right data, in the right place, for the right length of time."],
  ["Standard (STD-STOR-ARCH-001)", "The requirements (SHALL / SHOULD / MAY with stable REQ-IDs). This manifest is its catalogue entry (§4.2)."],
  ["Procedures (PRC-STOR-ARCH-001)", "Step by step: register (A), prepare (B), archive (C, D), recall (E), folders (F), delete (G), incidents (H)."],
  ["Guidelines (GDL-STOR-ARCH-001)", "The judgement calls: tiers, appraisal, retention, names, file sizes, compression, licences."],
];

const LINKS: [string, string, string][] = [
  ["Archiving process", CONFLUENCE_PROCESS, "How data is prepared and written to /dmidata/archive (Confluence)"],
  ["Archiving FAQ", CONFLUENCE_FAQ, "Practical questions: servers, moving data, tape (Confluence)"],
  ["Storage support", CONFLUENCE_STORAGE, "Making and mounting squashfs images (Confluence)"],
  ["QMS 4.4 Data — Arkivering", CONFLUENCE_QMS_ARCHIVING, "Archiving principles and checksums (Confluence)"],
  ["DMI archive tool", ARCHIVE_TOOL, "Automated archiving of scheduled production (GitLab)"],
  ["Catalogue repository", REPOSITORY, "The manifests, the schema and this editor (GitLab)"],
];

export default function InfoPage() {
  const jump = (id: string) => document.getElementById(`about-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <Container maxWidth="md" sx={{ py: 4, overflow: "auto", height: "100%" }}>
      <Typography variant="h4" gutterBottom>
        About the Dataset Manifest Editor
      </Typography>
      <Typography paragraph color="text.secondary">
        Write and check the catalogue entry for a DMI dataset: what it is, who is responsible for it, how long it is
        kept, and — when the time comes — how it is archived. Everything stays in your browser until you download the
        YAML.
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
        {CONTENTS.map(([id, title]) => (
          <Chip key={id} label={title} onClick={() => jump(id)} variant="outlined" color="primary" />
        ))}
      </Stack>

      <Section id="start" title="Quick start">
        <Typography component="div">
          <ol>
            <li>
              <strong>Start</strong> with <em>New</em>, or <em>Open</em> an existing manifest. To see every field in
              use, load the <em>Example</em>. Prefer a conversation? <em>AI prompt</em> gives you a file to upload to
              an AI assistant, which interviews you and writes the YAML.
            </li>
            <li>
              <strong>Pick the status</strong> with the stepper at the top of the form. A new dataset starts as{" "}
              <em>Proposed</em>: only the basics and its products are needed then.
            </li>
            <li>
              <strong>Fill in the cards</strong> marked <em>Required</em>. <em>How to fill this in</em> on each card
              explains what is asked and why.
            </li>
            <li>
              <strong>Clear the checklist</strong> in the side panel. Click an item to jump to its field.
            </li>
            <li>
              <strong>Do the work</strong> listed in the <em>Steps</em> tab: who does what at this stage, with the
              commands for packaging data for the archive.
            </li>
            <li>
              <strong>Submit it:</strong> download the YAML and add it to the catalogue in a merge request (below).
            </li>
          </ol>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          A manifest is the catalogue entry the DMI Storage and Archiving Standard requires for every dataset that
          outlives a short project (REQ-CAT-001–009). Register it before any data is moved to archive folders
          (REQ-CAT-002).
        </Typography>
      </Section>

      <Section id="screen" title="The screen">
        <SimpleTable rows={SCREEN} firstWidth={140} />
      </Section>

      <Section id="submit" title="Submitting a manifest">
        <Typography>
          Manifests live in the{" "}
          <Link href={REPOSITORY} target="_blank" rel="noopener">
            catalogue repository
          </Link>{" "}
          as <code>manifests/&lt;id&gt;.yaml</code>, are reviewed in merge requests and are checked by CI against the
          same rules as this form.
        </Typography>
        <Mermaid id="workflow-diagram" chart={WORKFLOW_DIAGRAM} />
        <Typography component="div">
          <ol>
            <li>
              Clear the checklist, then download the YAML from the YAML tab. It is named after the catalogue ID.
            </li>
            <li>
              Add the file to <code>manifests/</code> in a merge request.
            </li>
            <li>CI checks it: errors block the merge, warnings are listed.</li>
            <li>The Data Owner approves the merge request (Procedure A.7); once merged, the entry is in the catalogue.</li>
          </ol>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          To change an entry later, open its file here, edit it and submit the new version the same way. Changes to
          location, format, retention or Owner are due in the catalogue within 10 working days (REQ-CAT-005).
        </Typography>
      </Section>

      <Section id="lifecycle" title="Dataset lifecycle">
        <Typography>
          The status decides which fields are mandatory, what the checklist asks for and which steps the Steps tab
          shows. Set it with the stepper at the top of the form.
        </Typography>
        <Mermaid id="lifecycle-diagram" chart={LIFECYCLE_DIAGRAM} />
        <SimpleTable head={["Status", "Mandatory fields"]} rows={REQUIRED_BY_STATUS} firstWidth={180} />
      </Section>

      <Section id="roles" title="Roles">
        <Typography paragraph>
          Every dataset has a named Owner, Steward and Custodian. One person may hold all three for a small dataset, but
          the entry must say so. The procedures assume the three are named — if not, assign them first.
        </Typography>
        <SimpleTable head={["Role", "Answers the question", "Usually"]} rows={ROLES} />
      </Section>

      <Section id="rules" title="Mandatory, recommended, optional">
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
              <strong>Not known yet?</strong> For facts and links (PID, DOI, pages, release date) switch on{" "}
              <em>Not known yet</em> to record <code>TBD by YYYY-MM-DD</code> (Procedure A.5). CI lists open
              placeholders and flags overdue ones. Decisions — roles, retention, licence — cannot be postponed, and no
              placeholder may remain once a dataset is archived.
            </li>
            <li>
              A deviation from a SHALL requirement needs a registered exception with an expiry date at most 12 months
              ahead; list it under <em>Notes, exceptions &amp; other information</em>.
            </li>
          </ul>
        </Typography>
      </Section>

      <Section id="conventions" title="Conventions worth knowing">
        <SimpleTable rows={CONVENTIONS} firstWidth={170} />
      </Section>

      <Section id="faq" title="Common questions">
        {FAQ.map(([question, answer]) => (
          <Accordion key={question} disableGutters elevation={0} sx={{ "&:before": { opacity: 0.6 } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
              <Typography sx={{ fontWeight: 500 }}>{question}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <Typography color="text.secondary">{answer}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Section>

      <Section id="help" title="The documents and further help">
        <Typography paragraph>
          The rules come from DMI's Storage and Archiving document set, version 1.0. Each card's guidance and each
          checklist item cite the requirement or procedure step behind them.
        </Typography>
        <SimpleTable rows={DOCUMENTS} firstWidth={240} />
        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          Practical help
        </Typography>
        <SimpleTable
          rows={LINKS.map(([label, href, what]) => [
            <Link href={href} target="_blank" rel="noopener">
              {label}
            </Link>,
            what,
          ])}
          firstWidth={240}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Questions about folders, permissions, quotas or tape: ask the Data Custodian. Questions about what to keep and
          for how long: ask the Data Owner.
        </Typography>
      </Section>
    </Container>
  );
}
