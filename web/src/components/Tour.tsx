import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Box, Button, Modal, Paper, Stack, Typography } from "@mui/material";
import type { Side, TourStep } from "../tour";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Layout {
  /** The lit area; none while the step points at nothing. */
  spot: Rect | null;
  card: { top: number; left: number };
}

/** Room around the target inside the spotlight. */
const PAD = 6;
/** Between the spotlight and the card. */
const GAP = 12;
/** Kept free at the window's edges. */
const MARGIN = 16;
const CARD_WIDTH = 360;
const SIDES: Side[] = ["bottom", "top", "left", "right"];

const motion = (properties: string[]) => ({
  transition: properties.map((p) => `${p} 0.25s ease`).join(", "),
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
});

// Inputs in a collapsed card are laid out but invisible
const isShown = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};

/** Every shown element the selector matches; the first one is scrolled to. */
function findTargets(selector?: string): Element[] {
  return selector ? [...document.querySelectorAll(selector)].filter(isShown) : [];
}

/** The area around all the elements, with some room. */
function around(elements: Element[]): Rect | null {
  if (!elements.length) return null;
  const rects = elements.map((el) => el.getBoundingClientRect());
  const top = Math.min(...rects.map((r) => r.top)) - PAD;
  const left = Math.min(...rects.map((r) => r.left)) - PAD;
  const bottom = Math.max(...rects.map((r) => r.bottom)) + PAD;
  const right = Math.max(...rects.map((r) => r.right)) + PAD;
  return { top, left, width: right - left, height: bottom - top };
}

/**
 * Where the card goes: beside the spotlight on the preferred side if it fits there, else on the
 * first side that does, else in the middle of the window (also when there is no spotlight).
 */
export function placeCard(
  spot: Rect | null,
  card: { width: number; height: number },
  view: { width: number; height: number },
  side: Side = "bottom"
): { top: number; left: number } {
  const clamp = (value: number, size: number, room: number) => Math.max(MARGIN, Math.min(value, room - size - MARGIN));
  const middle = {
    top: clamp((view.height - card.height) / 2, card.height, view.height),
    left: clamp((view.width - card.width) / 2, card.width, view.width),
  };
  if (!spot) return middle;
  const x = clamp(spot.left + spot.width / 2 - card.width / 2, card.width, view.width);
  const y = clamp(spot.top + spot.height / 2 - card.height / 2, card.height, view.height);
  const below = spot.top + spot.height + GAP;
  const above = spot.top - GAP - card.height;
  const before = spot.left - GAP - card.width;
  const after = spot.left + spot.width + GAP;
  const places: Record<Side, { top: number; left: number; fits: boolean }> = {
    bottom: { top: below, left: x, fits: below + card.height <= view.height - MARGIN },
    top: { top: above, left: x, fits: above >= MARGIN },
    left: { top: y, left: before, fits: before >= MARGIN },
    right: { top: y, left: after, fits: after + card.width <= view.width - MARGIN },
  };
  const found = [side, ...SIDES.filter((s) => s !== side)].find((s) => places[s].fits);
  return found ? { top: places[found].top, left: places[found].left } : middle;
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

const sameLayout = (a: Layout | null, b: Layout) =>
  !!a && sameRect(a.spot, b.spot) && a.card.top === b.card.top && a.card.left === b.card.left;

interface TourProps {
  steps: TourStep[];
  /** Called as each step is shown, to bring its target onto the page (a tab, a card). */
  onStep: (step: TourStep) => void;
  /** Finished, skipped or closed with Escape. */
  onClose: () => void;
}

/**
 * A guided tour: dims the page except for what a step points at, with a card explaining it
 * beside it. Mounted while the tour runs. Nothing on the page can be used meanwhile, so the tour
 * changes nothing in the form.
 */
export default function Tour({ steps, onStep, onClose }: TourProps) {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  /** The card moves smoothly from step to step, but appears in its first place without sliding there. */
  const [placed, setPlaced] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const showStep = useRef(onStep);
  showStep.current = onStep;

  const step = steps[index];
  const first = index === 0;
  const last = index === steps.length - 1;
  const back = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => (last ? onClose() : setIndex((i) => i + 1));

  // Follow the target every frame: scrolling, opening cards and resizing all move it
  useEffect(() => {
    showStep.current(step);
    let frame = 0;
    let scrolled = false;
    const measure = () => {
      const targets = findTargets(step.target);
      if (targets.length && !scrolled) {
        scrolled = true;
        const r = targets[0].getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth)
          targets[0].scrollIntoView({ block: "center", inline: "nearest" });
      }
      const spot = around(targets);
      const size = { width: card.current?.offsetWidth ?? CARD_WIDTH, height: card.current?.offsetHeight ?? 0 };
      const view = { width: window.innerWidth, height: window.innerHeight };
      const now = { spot, card: placeCard(spot, size, view, step.side) };
      setLayout((prev) => (sameLayout(prev, now) ? prev : now));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (!layout || placed) return;
    const frame = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(frame);
  }, [layout, placed]);

  useEffect(() => primary.current?.focus(), [index]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") back();
    else return;
    e.preventDefault();
  };

  const spot = layout?.spot;
  return (
    <Modal open hideBackdrop onClose={onClose}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        onKeyDown={onKeyDown}
        sx={{ outline: "none" }}
      >
        {/* The shadow dims everything outside the lit area; without a target it is a point in the middle */}
        <Box
          sx={{
            position: "fixed",
            pointerEvents: "none",
            borderRadius: "10px",
            top: spot?.top ?? "50%",
            left: spot?.left ?? "50%",
            width: spot?.width ?? 0,
            height: spot?.height ?? 0,
            boxShadow: `${spot ? "0 0 0 3px rgba(11, 92, 173, 0.6), " : ""}0 0 0 9999px rgba(15, 23, 42, 0.55)`,
            ...motion(["top", "left", "width", "height"]),
          }}
        />
        <Paper
          ref={card}
          elevation={8}
          sx={{
            position: "fixed",
            top: layout?.card.top ?? 0,
            left: layout?.card.left ?? 0,
            width: `min(${CARD_WIDTH}px, calc(100vw - ${2 * MARGIN}px))`,
            p: 2.5,
            borderRadius: "12px",
            visibility: layout ? "visible" : "hidden",
            ...(placed ? motion(["top", "left"]) : {}),
          }}
        >
          <Box aria-live="polite">
            <Typography variant="caption" color="text.secondary">
              {index + 1} of {steps.length}
            </Typography>
            <Typography id="tour-title" variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3, mt: 0.25, mb: 1 }}>
              {step.title}
            </Typography>
            <Typography id="tour-text" variant="body2" color="text.secondary">
              {step.text}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2.5 }}>
            {!last && (
              <Button size="small" color="inherit" onClick={onClose} sx={{ color: "text.secondary" }}>
                {first ? "Not now" : "Skip tour"}
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {!first && (
              <Button size="small" onClick={back}>
                Back
              </Button>
            )}
            <Button ref={primary} size="small" variant="contained" onClick={next}>
              {first ? "Show me around" : last ? "Done" : "Next"}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Modal>
  );
}
