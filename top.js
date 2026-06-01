// Top-view reflection simulator.
//
// Looking down on the ring, the two facing mirrors (opposite sides of the ring,
// a ring-diameter D apart) are drawn as two vertical strips, each of width W.
// The laser enters from outside and crosses the gap D at a small angle, so it
// zig-zags left<->right between the mirrors while drifting along the width W.
// After enough bounces the drift carries it off the end of the mirror (past
// w = 0 or w = W) and it leaves the ring.
//
// This tells you how many reflections fit for a given mirror width W, ring
// diameter / gap D, and the laser's source position + angle.
//
// Layout (gap horizontal, width vertical):
//   g = position along the gap   (0 = left mirror, D = right mirror)  -> screen x
//   w = position along the width (0 = bottom edge, W = top edge)      -> screen y (up)
//
// Angle convention: measured from "straight across" the gap.
//   angle = 0   -> straight across, never drifts -> infinite reflections
//   small angle -> drifts slowly -> many reflections
// Drift per leg (one gap crossing)   = D * tan(angle)   [width units]
// Reflections that fit (full width)  ~ W / (D * tan(angle))
//
// Extras: real beam-diameter spots with overlap flag, a spot-position list + cm
// ruler, exact numeric entry + arrow-key source nudge, optical path length +
// incidence angle, and the segmented-ring sagitta (how far a flat mirror segment
// moves as the polygonal ring rotates). The laser source is a draggable handle
// and may sit behind a mirror; mirrors are one-sided (inner face reflects).
// Wheel zooms, drag empty space pans, double-click resets. Reuses Boundary and
// Ray from the front-view app.

const BACKGROUND_COLOR = 26;
const SLIDER_SIZE = 180;
const SLIDER_DISTANCE_BETWEEN = 30;
const SLIDER_TEXT_DISTANCE_BETWEEN = 14;
const CHECKBOX_DISTANCE_BETWEEN = 24;
const REFLECTIONS_LIMIT = 4000; // safety cap (e.g. when angle == 0)
const EPS = 0.001;
const MARGIN = 90;  // px of empty space kept around the cavity (room to drag the source "behind")
const HANDLE_R = 7; // laser-source handle radius (px)
const NUDGE = 0.1;  // cm the arrow keys move the source

const defaultColor = [225];
const laserColor = [255, 70, 70];
const overlapColor = [255, 180, 40]; // spots that would overlap
const mirrorColorA = [90, 170, 255];  // left mirror
const mirrorColorB = [205, 120, 255]; // right mirror
const dimColor = [120, 120, 130];

// Plot region (to the right of the controls).
const PLOT = { left: 520, right: 1245, top: 110, bottom: 760 };

const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());

// Cached trace: trace() is geometry-only, so recompute it only when an input
// (D, W, angle, source, view) changes rather than on every frame.
let traceCache = null;
let traceKey = "";

// Laser source in MODEL coords (may be outside the cavity, e.g. g < 0 = behind
// the left mirror). Updated by dragging the handle or the arrow keys.
let srcG = -11;
let srcW = -1.0;
let dragging = false;

// View transform: scale = auto-fit * zoom, plus a screen-pixel pan offset.
let zoom = 1;
let panX = 0;
let panY = 0;
let panning = false;
let panStart = null;

// Updated every frame so the mouse handlers can hit-test / convert coordinates.
let view = { scale: 1, autoScale: 1, originX: 0, originY: 0, D: 1, W: 1 };
let srcScreen = { x: -100, y: -100 };

// Slider step mode: fine by default (precision); hold Shift for coarse/fast.
let fineMode = true;
let numInputsY = 0; // y of the exact-value inputs row (set in setup, read by draw)

const sliders = {
  "diameter":      { config: [200, 320, 300, 1],   fine: 0.1,  unit: " cm",  name: "ring diameter D (mirror gap)", color: mirrorColorA },
  "width":         { config: [15, 40, 20, 0.5],     fine: 0.05, unit: " cm",  name: "mirror width W",               color: mirrorColorB },
  "angle":         { config: [0, 3, 1, 0.05],       fine: 0.005, name: "laser angle (from straight-across)", color: laserColor, format: (v) => v.toFixed(3) + " deg" },
  "segments":      { config: [2, 50, 20, 1],        fine: 1,    name: "ring segments",                color: dimColor, format: (v) => v + " (flat mirrors)" },
  "beam_diameter": { config: [0.05, 5, 1.5, 0.05],  fine: 0.01, unit: " cm",  name: "beam diameter",                color: laserColor },
  "beam_spread":   { config: [0, 3, 0.15, 0.01],    fine: 0.005, name: "beam spread (mirror imperfection)", color: laserColor, format: (v) => v.toFixed(3) + " mrad/bounce" },
  "falloff":       { config: [0, 0.9, 0.2, 0.01],   fine: 0.005, name: "falloff (dim per reflection)",  color: laserColor, format: (v) => (v * 100).toFixed(0) + "% / bounce" },
  "beam_weight":   { config: [0.2, 4, 1.3, 0.1],    fine: 0.05, name: "beam line weight",             color: defaultColor },
};

const checkboxes = {
  "show_spots":   { config: { isChecked: true },  color: defaultColor, name: "mark reflection spots" },
  "beam_width":   { config: { isChecked: true },  color: defaultColor, name: "show beam width (to scale)" },
  "show_estimate":{ config: { isChecked: true },  color: defaultColor, name: "show analytic / extras" },
  "show_normals": { config: { isChecked: false }, color: defaultColor, name: "show mirror normals" },
};

// Exact-value number inputs bound to sliders.
const NUM_INPUTS = ["diameter", "width", "angle"];
const NUM_LABELS = { diameter: "D (cm)", width: "W (cm)", angle: "angle" };
const NUM_X = [12, 92, 172]; // x of each exact-value input
const numInputs = {};

function setSearchParams(key, value) {
  const sp = new URLSearchParams(window.location.search);
  sp.set(key, value);
  history.replaceState(null, "", window.location.pathname + "?" + sp.toString());
}

function persistSource() {
  setSearchParams("src_g", srcG.toFixed(2));
  setSearchParams("src_w", srcW.toFixed(2));
}

function onInputChange(event) {
  const { target, currentTarget } = event;
  if (target.type === "checkbox") {
    setSearchParams(currentTarget.id, Number(target.checked));
  } else {
    setSearchParams(target.id, target.value);
  }
}

function applyStep() {
  for (const id in sliders) {
    const s = sliders[id];
    s.instance.elt.step = fineMode ? s.fine : s.config[3];
  }
}

function setup() {
  createCanvas(1280, 840);

  if (params.src_g !== undefined && !Number.isNaN(Number(params.src_g))) srcG = Number(params.src_g);
  if (params.src_w !== undefined && !Number.isNaN(Number(params.src_w))) srcW = Number(params.src_w);

  let y = 4;

  for (const [id, slider] of Object.entries(sliders)) {
    if (params[id] !== undefined) {
      const v = Number(params[id]);
      if (!Number.isNaN(v)) slider.config[2] = constrain(v, slider.config[0], slider.config[1]);
    }
    const instance = createSlider(...slider.config);
    instance.position(10, y += SLIDER_DISTANCE_BETWEEN);
    instance.size(SLIDER_SIZE);
    instance.class("slider");
    instance.id(id);
    instance.elt.addEventListener("change", onInputChange);
    slider.instance = instance;
  }

  y += 6;

  for (const [id, checkbox] of Object.entries(checkboxes)) {
    if (params[id] !== undefined) {
      checkbox.config.isChecked = !!Number(params[id]);
    }
    const instance = createCheckbox("", checkbox.config.isChecked);
    instance.position(10, y += CHECKBOX_DISTANCE_BETWEEN);
    instance.elt.id = id;
    instance.elt.addEventListener("change", onInputChange);
    checkbox.instance = instance;
  }

  // Exact-value number inputs (type a precise D / W / angle).
  numInputsY = y + 50;
  NUM_INPUTS.forEach((id, i) => {
    const s = sliders[id];
    const inp = createInput(String(s.instance.value()), "number");
    inp.position(NUM_X[i], numInputsY);
    inp.size(66);
    inp.class("num-input");
    inp.elt.min = s.config[0];
    inp.elt.max = s.config[1];
    inp.elt.step = s.fine;
    const apply = (persist) => {
      const v = Number(inp.value());
      if (Number.isNaN(v)) return;
      const c = constrain(v, s.config[0], s.config[1]);
      s.instance.value(c);
      if (persist) setSearchParams(id, c);
    };
    inp.elt.addEventListener("input", () => apply(false));
    inp.elt.addEventListener("change", () => apply(true));
    numInputs[id] = inp;
  });

  applyStep(); // sliders start in fine mode

  // Fine steps by default (precision); hold Shift for coarse/fast steps.
  window.addEventListener("keydown", (e) => { if (e.key === "Shift" && fineMode) { fineMode = false; applyStep(); } });
  window.addEventListener("keyup", (e) => { if (e.key === "Shift" && !fineMode) { fineMode = true; applyStep(); } });
  window.addEventListener("blur", () => { if (!fineMode) { fineMode = true; applyStep(); } });
  window.addEventListener("mouseup", endDrag); // ends drags that release off-canvas too

  // Arrow keys nudge the source (unless a control input is focused).
  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT") return;
    if (e.key === "ArrowLeft") srcG -= NUDGE;
    else if (e.key === "ArrowRight") srcG += NUDGE;
    else if (e.key === "ArrowUp") srcW += NUDGE;
    else if (e.key === "ArrowDown") srcW -= NUDGE;
    else return;
    persistSource();
    e.preventDefault();
  });
}

// Bounce a ray between the two finite, one-sided mirror segments until it walks
// off an end (no inner-face intersection) or the safety cap is hit. Returns the
// polyline of points (including the source at index 0), the reflection count,
// whether the beam exited, and the final ray (to draw the beam leaving).
function trace(src, dir, mirrors) {
  const points = [src.copy()];
  let ray = new Ray(src.copy(), dir.heading());
  let count = 0;
  let exited = false;

  for (let i = 0; i < REFLECTIONS_LIMIT; i++) {
    let hit = null;
    let hitNormal = null;
    let record = Infinity;

    for (const m of mirrors) {
      if (ray.dir.dot(m.n) >= 0) continue; // one-sided: only the inner face reflects
      const pt = ray.cast(m, 1e-9);        // tolerance: count a beam landing exactly on the far corner
      if (!pt) continue;
      const d = p5.Vector.dist(ray.pos, pt);
      if (d < EPS) continue; // ignore the point we are sitting on
      if (d < record) {
        record = d;
        hit = pt;
        hitNormal = m.n;
      }
    }

    if (!hit) {
      exited = true;
      break;
    }

    // No drift along the width (e.g. angle == 0): the beam bounces in place and
    // would otherwise fill the cap with coincident segments. Stop early, but
    // report the cap so the caller's "capped" readout still fires.
    if (Math.abs(hit.y - ray.pos.y) < EPS) {
      points.push(hit);
      count = REFLECTIONS_LIMIT;
      break;
    }

    points.push(hit);
    count++;
    const reflected = p5.Vector.reflect(ray.dir, hitNormal.copy()); // copy: reflect() mutates the normal
    ray = new Ray(hit, reflected.heading());
  }

  return { points, count, exited, ray };
}

function arrow(x1, y1, x2, y2, size = 5) {
  line(x1, y1, x2, y2);
  const a = atan2(y2 - y1, x2 - x1);
  push();
  translate(x2, y2);
  rotate(a);
  line(0, 0, -size, -size * 0.6);
  line(0, 0, -size, size * 0.6);
  pop();
}

function dashed(x1, y1, x2, y2, pattern = [4, 5]) {
  push();
  drawingContext.setLineDash(pattern);
  line(x1, y1, x2, y2);
  drawingContext.setLineDash([]);
  pop();
}

function overPlot() {
  return mouseX >= PLOT.left && mouseX <= PLOT.right && mouseY >= PLOT.top && mouseY <= PLOT.bottom;
}

function mousePressed() {
  // Near the handle -> move the source; otherwise (inside the plot) -> pan.
  if (dist(mouseX, mouseY, srcScreen.x, srcScreen.y) <= HANDLE_R + 6) {
    dragging = true; panning = false;
  } else if (overPlot()) {
    panning = true; dragging = false;
    panStart = { x: mouseX, y: mouseY, panX, panY };
  } else {
    dragging = false; panning = false;
  }
}

function mouseDragged() {
  if (dragging) {
    const mx = constrain(mouseX, PLOT.left, PLOT.right);
    const my = constrain(mouseY, PLOT.top, PLOT.bottom);
    srcG = (mx - view.originX) / view.scale;
    srcW = (view.originY - my) / view.scale;
  } else if (panning && panStart) {
    panX = panStart.panX + (mouseX - panStart.x);
    panY = panStart.panY + (mouseY - panStart.y);
  }
}

// Wheel = zoom, centred on the cursor (the model point under it stays fixed).
function mouseWheel(event) {
  if (!overPlot()) return; // let the page scroll normally outside the plot
  const g = (mouseX - view.originX) / view.scale;
  const wv = (view.originY - mouseY) / view.scale;
  zoom = constrain(zoom * (event.delta > 0 ? 0.9 : 1.1), 0.5, 60);
  const plotW = PLOT.right - PLOT.left, plotH = PLOT.bottom - PLOT.top;
  const s = view.autoScale * zoom;
  panX = mouseX - g * s - (PLOT.left + (plotW - view.D * s) / 2);
  panY = mouseY + wv * s - (PLOT.top + (plotH + view.W * s) / 2);
  return false; // prevent the page from scrolling
}

// Double-click empty space to reset zoom/pan.
function doubleClicked() {
  if (dist(mouseX, mouseY, srcScreen.x, srcScreen.y) <= HANDLE_R + 6) return;
  if (!overPlot()) return;
  zoom = 1; panX = 0; panY = 0;
}

// Release via a window listener (not p5's mouseReleased) so a mouse-up outside
// the canvas still ends the drag/pan instead of leaving it stuck.
function endDrag() {
  if (dragging) {
    dragging = false;
    persistSource();
  }
  panning = false;
}

function draw() {
  background(BACKGROUND_COLOR);

  // --- read controls -------------------------------------------------------
  const D = sliders.diameter.instance.value();
  const W = sliders.width.instance.value();
  const angleDeg = sliders.angle.instance.value();
  const beta = radians(angleDeg);
  const segments = sliders.segments.instance.value();
  const beamDia = sliders.beam_diameter.instance.value();
  const beamSpread = sliders.beam_spread.instance.value();
  const beamWeight = sliders.beam_weight.instance.value();
  const falloff = sliders.falloff.instance.value();
  const showSpots = checkboxes.show_spots.instance.checked();
  const beamWidthViz = checkboxes.beam_width.instance.checked();
  const showExtras = checkboxes.show_estimate.instance.checked();
  const showNormals = checkboxes.show_normals.instance.checked();

  // Keep the number inputs in sync with the sliders (unless being edited).
  for (const id of NUM_INPUTS) {
    if (document.activeElement !== numInputs[id].elt) numInputs[id].value(sliders[id].instance.value());
  }

  // --- control labels ------------------------------------------------------
  noStroke();
  textSize(12); // deterministic: the readout below changes textSize each frame
  for (const id in sliders) {
    const { color, format, instance, name, unit } = sliders[id];
    const v = instance.value();
    const value = format ? format(v) : v + (unit || "");
    fill(...color);
    text(name + ": " + value, instance.x * 2 + instance.width, instance.y + SLIDER_TEXT_DISTANCE_BETWEEN);
  }
  for (const id in checkboxes) {
    const { color, instance, name } = checkboxes[id];
    fill(...color);
    text(name, 34, instance.y + SLIDER_TEXT_DISTANCE_BETWEEN);
  }
  fill(...dimColor);
  text("type exact values:", 12, numInputsY - 22);
  textSize(10);
  NUM_INPUTS.forEach((id, i) => text(NUM_LABELS[id], NUM_X[i] + 2, numInputsY - 6));
  textSize(12);

  // --- map model units -> screen (uniform scale = auto-fit * zoom, + pan) ----
  const plotW = PLOT.right - PLOT.left;
  const plotH = PLOT.bottom - PLOT.top;
  const autoScale = Math.min((plotW - 2 * MARGIN) / D, (plotH - 2 * MARGIN) / W);
  const scale = autoScale * zoom;
  const pxD = D * scale;
  const pxW = W * scale;
  const originX = PLOT.left + (plotW - pxD) / 2 + panX; // g = 0 (left mirror), screen x
  const originY = PLOT.top + (plotH + pxW) / 2 + panY;   // w = 0 (bottom edge),  screen y
  view = { scale, autoScale, originX, originY, D, W };
  const xL = originX;          // left mirror
  const xR = originX + pxD;    // right mirror
  const yB = originY;          // bottom end of the mirrors (w = 0)
  const yT = originY - pxW;    // top end of the mirrors (w = W)
  const wy = (w) => originY - w * scale;

  // Two finite mirror segments, wound so their normals point INTO the cavity.
  const mirrorLeft = new Boundary(xL, yB, xL, yT, mirrorColorA);  // normal -> +x (right, inward)
  const mirrorRight = new Boundary(xR, yT, xR, yB, mirrorColorB); // normal -> -x (left, inward)
  const mirrors = [mirrorLeft, mirrorRight];

  // Laser source + initial direction.
  const srcX = originX + srcG * scale;
  const srcY = wy(srcW);
  srcScreen = { x: srcX, y: srcY };
  const sourceOnLeft = srcG < D / 2;
  const sgnG = sourceOnLeft ? 1 : -1;   // fire toward the cavity (across the gap)
  const sgnW = srcW < W / 2 ? 1 : -1;   // drift toward the bulk of the width
  const dir = createVector(sgnG * cos(beta), -sgnW * sin(beta)); // screen: +w is up = -y

  const behindMirror = srcG < 0 ? -srcG : (srcG > D ? srcG - D : 0);
  const behindWhich = sourceOnLeft ? "left" : "right";
  const sideOffset = srcW; // 0 = bottom end of the mirror, W = top end

  // Segmented-ring sagitta: how far a flat mirror chord deviates from the true
  // arc, i.e. how much the surface moves (radially -> along the gap) as the ring
  // rotates. R = D/2 (vertices on the circle); midpoint sits sag cm inside.
  const sag = (D / 2) * (1 - Math.cos(Math.PI / segments));
  const sagPx = sag * scale;

  // --- trace (cached; key includes the view transform) ---------------------
  const traceK = [D, W, angleDeg, srcG.toFixed(3), srcW.toFixed(3), zoom.toFixed(3), Math.round(panX), Math.round(panY)].join("|");
  if (traceK !== traceKey) {
    traceCache = trace(createVector(srcX, srcY), dir, mirrors);
    traceKey = traceK;
  }
  const { points, count, exited, ray } = traceCache;
  const nSpots = points.length - 1; // reflection points actually traced (capped cases included)

  // --- beam spread from mirror imperfection --------------------------------
  // Each imperfect reflection adds an RMS divergence half-angle; random errors
  // accumulate in quadrature (Theta after k reflections = spread*sqrt(k)). The
  // physical radius grows by (divergence * leg-length) along each leg.
  const spreadRad = beamSpread * 0.001; // mrad -> rad
  const radCm = [beamDia / 2];          // beam radius (cm) at each point
  {
    let div = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const legCm = dist(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y) / scale;
      radCm.push(radCm[i] + div * legCm);
      div = Math.sqrt(div * div + spreadRad * spreadRad); // reflection at points[i+1] adds spread
    }
  }
  // First reflection where the beam degrades: its footprint overlaps the
  // same-mirror neighbour, or it spills off the mirror end (w outside [0, W]).
  const spotSpacing = 2 * D * Math.tan(beta); // cm between consecutive spots on one mirror
  const spotBad = new Array(points.length).fill(false);
  let firstBad = 0, badReason = "";
  for (let i = 1; i <= nSpots; i++) {
    const w = (originY - points[i].y) / scale;
    const spill = (w + radCm[i] > W) || (w - radCm[i] < 0);
    const overlapsNbr = spotSpacing > 0 &&
      (((i - 2 >= 1) && radCm[i] + radCm[i - 2] >= spotSpacing) ||
       ((i + 2 <= nSpots) && radCm[i] + radCm[i + 2] >= spotSpacing));
    if (spill || overlapsNbr) {
      spotBad[i] = true;
      if (firstBad === 0) { firstBad = i; badReason = spill ? "beam spills off the mirror" : "spots overlap"; }
    }
  }
  const grownDia = 2 * radCm[nSpots]; // beam diameter (cm) at the last reflection

  // Clip cavity/beam drawing to the plot so zoom/pan never spills over the
  // controls, readout, or hints.
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(PLOT.left, PLOT.top, plotW, plotH);
  drawingContext.clip();

  // --- segment-motion band (surface sweep as the ring rotates) -------------
  // Each flat mirror surface can sit anywhere from the nominal face inward by
  // `sag` as the polygon rotates; draw that envelope.
  noStroke();
  fill(...mirrorColorA, 45);
  rect(xL, yT, sagPx, pxW);          // left mirror sweeps inward (+x)
  fill(...mirrorColorB, 45);
  rect(xR - sagPx, yT, sagPx, pxW);  // right mirror sweeps inward (-x)

  // --- draw the cavity -----------------------------------------------------
  // Walk-off ends (top/bottom of the mirror strips): past these the beam leaves.
  stroke(...dimColor, 150);
  strokeWeight(1);
  dashed(xL - 16, yT, xR + 16, yT, [5, 6]);
  dashed(xL - 16, yB, xR + 16, yB, [5, 6]);

  // Mirrors.
  strokeWeight(4);
  stroke(...mirrorColorA);
  line(mirrorLeft.a.x, mirrorLeft.a.y, mirrorLeft.b.x, mirrorLeft.b.y);
  stroke(...mirrorColorB);
  line(mirrorRight.a.x, mirrorRight.a.y, mirrorRight.b.x, mirrorRight.b.y);

  if (showNormals) {
    stroke(50, 255, 120, 160);
    strokeWeight(1);
    for (const m of mirrors) arrow(m.c.x, m.c.y, m.c.x + m.n.x, m.c.y + m.n.y);
  }

  // --- beam: per-reflection falloff + optional real-width band -------------
  // segAlpha(i) = brightness after i reflections (entry segment i = 0 is full).
  const segAlpha = (i) => 255 * Math.pow(1 - falloff, i);
  if (count > 0) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = segAlpha(i);
      if (beamWidthViz) { // tapered band = real, widening beam cross-section
        const r0 = radCm[i] * scale, r1 = radCm[i + 1] * scale;
        const dx = points[i + 1].x - points[i].x, dy = points[i + 1].y - points[i].y;
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len, py = dx / len; // unit perpendicular
        noStroke();
        fill(...laserColor, a * 0.22);
        quad(points[i].x + px * r0, points[i].y + py * r0,
             points[i + 1].x + px * r1, points[i + 1].y + py * r1,
             points[i + 1].x - px * r1, points[i + 1].y - py * r1,
             points[i].x - px * r0, points[i].y - py * r0);
      }
      stroke(...laserColor, a);
      strokeWeight(beamWeight);
      if (i === 0) dashed(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y); // entry
      else line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
  }
  if (exited) {
    const last = points[points.length - 1];
    const exitEnd = p5.Vector.add(last, p5.Vector.copy(ray.dir).setMag(plotW + plotH));
    const a = segAlpha(count);
    if (beamWidthViz) { stroke(...laserColor, a * 0.22); strokeWeight(Math.max(1, 2 * radCm[nSpots] * scale)); line(last.x, last.y, exitEnd.x, exitEnd.y); }
    stroke(...laserColor, a * 0.7);
    strokeWeight(beamWeight);
    dashed(last.x, last.y, exitEnd.x, exitEnd.y);
  }

  // --- reflection spots / footprints (grow with beam spread) ---------------
  let hitsLeft = 0, hitsRight = 0;
  const leftWs = [], rightWs = [];
  for (let i = 1; i < points.length; i++) {
    const onLeft = Math.abs(points[i].x - xL) < Math.abs(points[i].x - xR);
    const wv = (originY - points[i].y) / scale;
    if (onLeft) { hitsLeft++; leftWs.push(wv); } else { hitsRight++; rightWs.push(wv); }
    if (!showSpots) continue;
    const a = segAlpha(i - 1); // brightness of the beam arriving at this spot
    const c = spotBad[i] ? overlapColor : (onLeft ? mirrorColorA : mirrorColorB);
    if (beamWidthViz) {                       // real (growing) footprint
      const d = Math.max(2, 2 * radCm[i] * scale);
      noStroke(); fill(...c, a * 0.45); circle(points[i].x, points[i].y, d);
      noFill(); stroke(...c, a); strokeWeight(1); circle(points[i].x, points[i].y, d);
    } else {                                  // simple marker dot
      noStroke(); fill(...c, a); circle(points[i].x, points[i].y, Math.max(3, beamWeight + 3));
    }
  }

  // Laser source handle.
  const overHandle = dragging || dist(mouseX, mouseY, srcX, srcY) <= HANDLE_R + 6;
  stroke(...laserColor);
  strokeWeight(2);
  fill(overHandle ? color(...laserColor, 120) : color(BACKGROUND_COLOR));
  circle(srcX, srcY, HANDLE_R * 2);
  noStroke();
  fill(...laserColor);
  circle(srcX, srcY, 3);

  // Compact position tag next to the handle.
  push();
  noStroke();
  fill(...dimColor);
  textAlign(CENTER, TOP);
  textSize(11);
  const tag = (behindMirror > 0 ? behindMirror.toFixed(1) + " behind" : "in gap")
    + "  .  " + sideOffset.toFixed(1) + " side";
  text(tag, srcX, srcY + HANDLE_R + 5);
  pop();

  // --- dimensions + cm ruler ----------------------------------------------
  // D below the cavity.
  stroke(...dimColor);
  strokeWeight(1);
  const dY = yB + 34;
  arrow(xL, dY, xR, dY); arrow(xR, dY, xL, dY);
  noStroke();
  fill(...dimColor);
  textAlign(CENTER, TOP);
  text("D = " + D + " cm (mirror gap)", (xL + xR) / 2, dY + 6);

  // W as a cm ruler on the side opposite the source.
  const wX = sourceOnLeft ? xR + 30 : xL - 30;
  const labelSide = sourceOnLeft ? 1 : -1;
  push();
  textSize(10);
  textAlign(sourceOnLeft ? LEFT : RIGHT, CENTER);
  stroke(...dimColor);
  strokeWeight(1);
  line(wX, yB, wX, yT);
  const tickStep = W <= 25 ? 5 : 10;
  const drawTick = (cm) => {
    const ty = wy(cm);
    stroke(...dimColor);
    line(wX, ty, wX + labelSide * 6, ty);
    noStroke();
    fill(...dimColor);
    text(cm % 1 ? cm.toFixed(1) : cm, wX + labelSide * 9, ty);
  };
  for (let cm = 0; cm < W - 1e-6; cm += tickStep) drawTick(cm);
  drawTick(W); // always mark the exact width
  pop();
  noStroke();
  fill(...dimColor);
  textAlign(CENTER, BOTTOM);
  text("W = " + W + " cm", wX, yT - 10);
  textAlign(LEFT, BASELINE);

  drawingContext.restore(); // end plot clip

  // --- readout panel -------------------------------------------------------
  const analytic = beta > 0 ? W / (D * Math.tan(beta)) : Infinity; // entry-independent full-width max
  const capped = !exited && count >= REFLECTIONS_LIMIT;
  // Optical path inside the cavity (first reflection to last).
  let pathPx = 0;
  for (let i = 1; i < points.length - 1; i++) pathPx += dist(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  const pathCm = pathPx / scale;

  noStroke();
  fill(BACKGROUND_COLOR, 205);
  rect(PLOT.left - 8, 40, 712, 162);

  fill(...laserColor);
  textSize(26);
  let countLabel;
  if (capped && beta === 0) countLabel = String.fromCharCode(8734);
  else if (capped) countLabel = "~" + Math.round(analytic);
  else countLabel = String(count);
  text("Reflections: " + countLabel, PLOT.left, 64);
  textSize(13);

  fill(...defaultColor);
  let info;
  if (capped && beta === 0) info = "angle 0 - beam never drifts off the mirror (infinite reflections)";
  else if (capped) info = "trace capped at " + REFLECTIONS_LIMIT + " - raise the angle to draw them all";
  else if (count === 0) info = "beam misses the mirrors - drag the source or change the angle";
  else info = "on left mirror: " + hitsLeft + "    on right mirror: " + hitsRight + (exited ? "    (beam left the ring)" : "");
  text(info, PLOT.left, 86);

  const srcLine = (behindMirror > 0
    ? "source: " + behindMirror.toFixed(1) + " cm behind " + behindWhich + " mirror"
    : "source: inside the gap")
    + "    .    side offset: " + sideOffset.toFixed(1) + " cm along W (0 = bottom end)";
  text(srcLine, PLOT.left, 104);

  if (showExtras) {
    fill(...dimColor);
    if (beta > 0) {
      text("max (full width) W/(D*tan) ~ " + analytic.toFixed(1)
        + "    drift/bounce = " + (D * Math.tan(beta)).toFixed(2) + " cm"
        + "    spot spacing = " + spotSpacing.toFixed(2) + " cm", PLOT.left, 122);
    } else {
      text("angle 0 -> beam never drifts -> infinite reflections", PLOT.left, 122);
    }
    fill(...(firstBad > 0 ? overlapColor : dimColor));
    text("beam " + beamDia.toFixed(2) + " -> " + grownDia.toFixed(2) + " cm by refl " + nSpots
      + " (spread " + beamSpread.toFixed(2) + " mrad/bounce)  ->  "
      + (firstBad > 0 ? "clean to ~" + (firstBad - 1) + " refl, then " + badReason
                      : "all spots clear"), PLOT.left, 140);
    fill(...dimColor);
    const pathStr = pathCm >= 100 ? (pathCm / 100).toFixed(2) + " m" : pathCm.toFixed(1) + " cm";
    text("optical path in cavity = " + pathStr + " over " + count + " bounces"
      + "    .    incidence " + angleDeg.toFixed(3) + " deg from normal", PLOT.left, 158);
    text(segments + " flat segments -> surface moves up to " + sag.toFixed(2)
      + " cm as the ring rotates (gap varies up to " + (2 * sag).toFixed(2) + " cm)", PLOT.left, 176);
    // Spot positions (cm), capped.
    const fmt = (arr) => arr.slice(0, 6).map((v) => v.toFixed(1)).join(", ") + (arr.length > 6 ? " ...(+" + (arr.length - 6) + ")" : "");
    fill(...dimColor);
    if (count > 0) text("spots w (cm)   left: " + fmt(leftWs) + "    right: " + fmt(rightWs), PLOT.left, 194);
  }

  // --- hints ---------------------------------------------------------------
  fill(...dimColor);
  textAlign(LEFT, BOTTOM);
  text("drag handle = move source (arrows nudge it)   |   drag empty = pan   |   wheel = zoom   |   double-click = reset", PLOT.left, PLOT.bottom + 30);
  text("sliders are fine by default (hold Shift for coarse)" + (fineMode ? "" : "  [COARSE]")
    + "       zoom " + zoom.toFixed(1) + "x", PLOT.left, PLOT.bottom + 46);
  textAlign(LEFT, BASELINE);

  // fps
  fill(200, 100, 0);
  noStroke();
  textAlign(RIGHT, BASELINE);
  text("fps: " + parseInt(frameRate()), width - 12, 20);
  textAlign(LEFT, BASELINE);
}
