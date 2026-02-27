import { useEffect, useRef, useState } from "react";
import { Box, Container, Typography, Paper } from "@mui/material";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "default" });

const WORKFLOW_DIAGRAM = `graph TD
    A["Identify dataset on storage system"] --> B["Open web editor & fill in metadata"]
    B --> C["Download / copy the generated YAML"]
    C --> D["Commit .yaml file to GitLab manifests repo via MR"]
    D --> E["CI validates manifest (schema + duplicate checks)"]
    E --> F["Manifest is merged & available in the catalog"]
`;

export default function InfoPage() {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [svgRendered, setSvgRendered] = useState(false);

  useEffect(() => {
    if (svgRendered) return;
    let cancelled = false;
    mermaid.render("workflow-diagram", WORKFLOW_DIAGRAM).then(({ svg }) => {
      if (!cancelled && diagramRef.current) {
        diagramRef.current.innerHTML = svg;
        setSvgRendered(true);
      }
    });
    return () => { cancelled = true; };
  }, [svgRendered]);

  return (
    <Container maxWidth="md" sx={{ py: 4, overflow: "auto", height: "100%" }}>
      <Typography variant="h4" gutterBottom>
        About the Dataset Manifest Editor
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          What is this?
        </Typography>
        <Typography>
          This tool generates YAML manifest files that describe datasets and
          their products on the DMI storage system. Each manifest captures
          metadata — ownership, contact information, file patterns, and optional
          STAC-compatible fields — so that datasets can be discovered and used
          through the data catalog.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Workflow
        </Typography>
        <Box
          ref={diagramRef}
          sx={{
            display: "flex",
            justifyContent: "center",
            my: 2,
            "& svg": { maxWidth: "100%" },
          }}
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Manifest structure
        </Typography>
        <Typography component="div">
          <ul>
            <li>
              <strong>dataset</strong> — Name, storage path, contact, and a
              description of the dataset.
            </li>
            <li>
              <strong>products</strong> — One or more products within the
              dataset, each defined by a directory pattern and file pattern that
              locate the data on storage.
            </li>
            <li>
              <strong>stac</strong> (optional) — STAC-compatible metadata such as
              spatial/temporal extent for geospatial datasets.
            </li>
          </ul>
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Getting started
        </Typography>
        <Typography component="div">
          <ul>
            <li>
              <strong>Start fresh</strong> — Fill in the form fields on the left;
              the YAML preview updates in real time.
            </li>
            <li>
              <strong>Import existing YAML</strong> — Paste or upload an existing
              manifest in the YAML preview panel to continue editing it.
            </li>
          </ul>
        </Typography>
      </Paper>
    </Container>
  );
}
