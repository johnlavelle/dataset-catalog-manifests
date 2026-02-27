import { useState, useCallback } from "react";
import { Box, AppBar, Toolbar, Typography, IconButton } from "@mui/material";
import { HelpOutline, ArrowBack } from "@mui/icons-material";
import ManifestForm from "./components/ManifestForm";
import YamlPreview from "./components/YamlPreview";
import InfoPage from "./components/InfoPage";
import type { IChangeEvent } from "@rjsf/core";
import "./App.css";

const INITIAL_DATA = {
  dataset: { name: "", path: "" },
  products: {},
};

export default function App() {
  const [formData, setFormData] = useState<Record<string, unknown>>(INITIAL_DATA);
  const [showInfo, setShowInfo] = useState(false);

  const handleChange = useCallback((e: IChangeEvent) => {
    if (e.formData) setFormData(e.formData);
  }, []);

  const handleImport = useCallback((data: Record<string, unknown>) => {
    setFormData(data);
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar position="static" elevation={1}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Dataset Manifest Editor
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => setShowInfo((v) => !v)}
            title={showInfo ? "Back to editor" : "Info"}
          >
            {showInfo ? <ArrowBack /> : <HelpOutline />}
          </IconButton>
        </Toolbar>
      </AppBar>
      {showInfo ? (
        <InfoPage />
      ) : (
        <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              p: 3,
              borderRight: 1,
              borderColor: "divider",
            }}
          >
            <ManifestForm formData={formData} onChange={handleChange} />
          </Box>
          <Box
            sx={{
              width: 480,
              minWidth: 360,
              overflow: "auto",
              bgcolor: "grey.50",
            }}
          >
            <YamlPreview formData={formData} onImport={handleImport} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
