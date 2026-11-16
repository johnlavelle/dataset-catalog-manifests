import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { Box } from "@mui/material";

export const PANEL_DEFAULT = 480;
export const PANEL_MIN = 280;
/** Room the form keeps however wide the panel is dragged. */
export const FORM_MIN = 400;
const STEP = 24;

/** Panel width limited to what the window allows, so a width saved on a wide screen still fits a narrow one. */
export function clampPanel(width: number, containerWidth = window.innerWidth): number {
  return Math.round(Math.max(PANEL_MIN, Math.min(width, containerWidth - FORM_MIN)));
}

interface SplitHandleProps {
  /** The panel to the right of the handle; resized directly while dragging. */
  panelRef: RefObject<HTMLElement>;
  width: number;
  onChange: (width: number) => void;
}

/**
 * Draggable border between the form and the side panel. While dragging it sets the
 * panel's width on the element itself and reports the result only on release: a state
 * update per pointer move would re-render the whole form and stutter.
 */
export default function SplitHandle({ panelRef, width, onChange }: SplitHandleProps) {
  const drag = useRef<{ x: number; width: number; container: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const containerWidth = () => panelRef.current?.parentElement?.clientWidth ?? window.innerWidth;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !panelRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, width: panelRef.current.offsetWidth, container: containerWidth() };
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !panelRef.current) return;
    panelRef.current.style.width = `${clampPanel(d.width + d.x - e.clientX, d.container)}px`;
  };

  const endDrag = () => {
    if (!drag.current || !panelRef.current) return;
    drag.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onChange(panelRef.current.offsetWidth);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? STEP * 4 : STEP;
    // The rendered width, which CSS may have narrowed since the window shrank
    const current = panelRef.current?.offsetWidth ?? width;
    const next = {
      ArrowLeft: current + step,
      ArrowRight: current - step,
      Home: containerWidth() - FORM_MIN,
      End: PANEL_MIN,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(clampPanel(next, containerWidth()));
  };

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the side panel"
      aria-valuenow={width}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={Math.max(PANEL_MIN, containerWidth() - FORM_MIN)}
      aria-valuetext={`Side panel ${width} pixels wide`}
      title="Drag to resize · double-click to reset"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={() => onChange(clampPanel(PANEL_DEFAULT, containerWidth()))}
      onKeyDown={onKeyDown}
      sx={{
        flex: "none",
        width: 9,
        mx: "-4px",
        zIndex: 1,
        cursor: "col-resize",
        touchAction: "none",
        display: "flex",
        justifyContent: "center",
        outline: "none",
        "&::after": {
          content: '""',
          width: dragging ? 3 : 1,
          bgcolor: dragging ? "primary.main" : "divider",
          transition: "width 0.1s, background-color 0.1s",
        },
        "&:hover::after, &:focus-visible::after": { width: 3, bgcolor: "primary.main" },
      }}
    />
  );
}
