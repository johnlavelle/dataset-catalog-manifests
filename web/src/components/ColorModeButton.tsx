import { useState } from "react";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import BrightnessAutoOutlined from "@mui/icons-material/BrightnessAutoOutlined";
import CheckIcon from "@mui/icons-material/Check";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import { useColorMode, type ColorMode } from "../colorMode";

const MODES: { mode: ColorMode; label: string; icon: JSX.Element }[] = [
  { mode: "system", label: "System", icon: <BrightnessAutoOutlined /> },
  { mode: "light", label: "Light", icon: <LightModeOutlined /> },
  { mode: "dark", label: "Dark", icon: <DarkModeOutlined /> },
];

/** Picks light, dark or the operating system's scheme. The icon shows the choice, not the scheme it resolves to. */
export default function ColorModeButton() {
  const { mode, setMode } = useColorMode();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = MODES.find((m) => m.mode === mode) ?? MODES[0];
  return (
    <>
      <Tooltip title={`Theme: ${current.label}`}>
        <IconButton
          color="inherit"
          aria-label={`Theme: ${current.label}`}
          aria-haspopup="menu"
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          {current.icon}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {MODES.map((m) => (
          <MenuItem
            key={m.mode}
            selected={m.mode === mode}
            onClick={() => {
              setMode(m.mode);
              setAnchor(null);
            }}
          >
            <ListItemIcon>{m.icon}</ListItemIcon>
            <ListItemText>{m.label}</ListItemText>
            <CheckIcon fontSize="small" sx={{ ml: 2, visibility: m.mode === mode ? "visible" : "hidden" }} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
