import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, AlertTitle, Box, Button, Stack } from "@mui/material";
import { downloadManifest } from "../yamlExport";
import type { Manifest } from "../compliance";

interface ErrorBoundaryProps {
  formData: Manifest;
  /** Start a new, empty manifest. */
  onReset: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** The draft that failed to render. */
  failed?: Manifest;
}

/**
 * The draft is autosaved, so a value the editor cannot render would otherwise give a blank
 * page on every reload. Show what went wrong and let the user save the draft and start over.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Editor crashed", error, info.componentStack);
    this.setState({ failed: this.props.formData });
  }

  /** New, Open and Example in the toolbar replace the draft: try rendering again. */
  componentDidUpdate() {
    const { error, failed } = this.state;
    if (error && failed && failed !== this.props.formData) this.setState({ error: null, failed: undefined });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Box sx={{ p: 3, maxWidth: 720 }}>
        <Alert severity="error">
          <AlertTitle>The editor cannot show this manifest</AlertTitle>
          Something in the current draft is not what the form expects, probably a value typed in the YAML. Download the
          draft, fix it in a text editor and open it again, or start a new manifest (the draft stays under Recent).
          <Box component="pre" sx={{ fontSize: "0.75rem", whiteSpace: "pre-wrap", my: 1 }}>
            {error.message}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" color="inherit" onClick={() => downloadManifest(this.props.formData)}>
              Download draft
            </Button>
            <Button variant="contained" color="error" onClick={this.props.onReset}>
              Start a new manifest
            </Button>
          </Stack>
        </Alert>
      </Box>
    );
  }
}
