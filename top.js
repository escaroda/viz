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
// The laser source is a draggable handle and may sit anywhere, including behind
// a mirror. Mirrors are one-sided (only the inner face reflects), so a beam
// coming from behind passes through and enters the cavity. Reuses Boundary
// (geometry + inward normal) and Ray (segment cast + reflect) from the
// front-view app.

const BACKGROUND_COLOR = 26;
const SLIDER_SIZE = 180;
const SLIDER_DISTANCE_BETWEEN = 30;
const SLIDER_TEXT_DISTANCE_BETWEEN = 14;
const CHECKBOX_DISTANCE_BETWEEN = 24;
const REFLECTIONS_LIMIT = 4000; // safety cap (e.g. when angle == 0)
const EPS = 0.001;
const MARGIN = 90;  // px of empty space kept around the cavity (room to drag the source "behind")
const HANDLE_R = 7; // laser-source handle radius (px)

const defaultColor = [225];
const laserColor = [255, 70, 70];
const mirrorColorA = [90, 170, 255];  // left mirror
const mirrorColorB = [205, 120, 255]; // right mirror
const dimColor = [120, 120, 130];

// Plot region (to the right of the controls).
const PLOT = { left: 520, right: 1245, top: 110, bottom: 760 };

const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());

// Cached trace: trace() is geometry-only, so recompute it only when an input
// (D, W, angle, source position) changes rather than on every frame.
let traceCache = null;
let traceKey = "";

// Laser source in MODEL coords (may be outside the cavity, e.g. g < 0 = behind
// the left mirror). Updated by dragging the handle.
let srcG = -15;
let srcW = -2;
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

const sliders = {
  "diameter":    { config: [200, 320, 300, 1],   fine: 0.1,  unit: " cm", name: "ring diameter D (mirror gap)", color: mirrorColorA },
  "width":       { config: [15, 40, 20, 0.5],     fine: 0.05, unit: " cm", name: "mirror width W",               color: mirrorColorB },
  "angle":       { config: [0, 3, 1, 0.05],       fine: 0.005, name: "laser angle (from straight-across)", color: laserColor, format: (v) => v.toFixed(3) + " deg" },
  "beam_weight": { config: [0.2, 4, 1.3, 0.1],    fine: 0.05, name: "beam weight",                    color: defaultColor },
};

const checkboxes = {
  "show_spots":   { config: { isChecked: true },  color: defaultColor, name: "mark reflection spots" },
  "show_estimate":{ config: { isChecked: true },  color: defaultColor, name: "show analytic estimate" },
  "show_normals": { config: { isChecked: false }, color: defaultColor, name: "show mirror normals" },
};

function setSearchParams(key, value) {
  if ("URLSearchParams" in window) {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set(key, value);
    history.pushState(null, "", window.location.pathname + "?" + searchParams.toString());
  }
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

  // Restore the dragged source position from the URL, if present.
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

  applyStep(); // sliders start in fine mode

  // Fine steps by default (precision); hold Shift for coarse/fast steps.
  window.addEventListener("keydown", (e) => { if (e.key === "Shift" && fineMode) { fineMode = false; applyStep(); } });
  window.addEventListener("keyup", (e) => { if (e.key === "Shift" && !fineMode) { fineMode = true; applyStep(); } });
  window.addEventListener("blur", () => { if (!fineMode) { fineMode = true; applyStep(); } });
  window.addEventListener("mouseup", endDrag); // ends drags that release off-canvas too
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
    setSearchParams("src_g", srcG.toFixed(2));
    setSearchParams("src_w", srcW.toFixed(2));
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
  const beamWeight = sliders.beam_weight.instance.value();
  const showSpots = checkboxes.show_spots.instance.checked();
  const showEstimate = checkboxes.show_estimate.instance.checked();
  const showNormals = checkboxes.show_normals.instance.checked();

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
  const gx = (g) => originX + g * scale;
  const wy = (w) => originY - w * scale;

  // Two finite mirror segments, wound so their normals point INTO the cavity.
  const mirrorLeft = new Boundary(xL, yB, xL, yT, mirrorColorA);  // normal -> +x (right, inward)
  const mirrorRight = new Boundary(xR, yT, xR, yB, mirrorColorB); // normal -> -x (left, inward)
  const mirrors = [mirrorLeft, mirrorRight];

  // Laser source + initial direction.
  const srcX = gx(srcG);
  const srcY = wy(srcW);
  srcScreen = { x: srcX, y: srcY };
  const sourceOnLeft = srcG < D / 2;
  const sgnG = sourceOnLeft ? 1 : -1;   // fire toward the cavity (across the gap)
  const sgnW = srcW < W / 2 ? 1 : -1;   // drift toward the bulk of the width
  const dir = createVector(sgnG * cos(beta), -sgnW * sin(beta)); // screen: +w is up = -y

  // How far the source sits behind a mirror, and its offset along the width.
  const behindMirror = srcG < 0 ? -srcG : (srcG > D ? srcG - D : 0);
  const behindWhich = sourceOnLeft ? "left" : "right";
  const sideOffset = srcW; // 0 = bottom end of the mirror, W = top end

  // --- trace (cached) ------------------------------------------------------
  // Key includes the view transform (zoom/pan) since the traced points are in
  // screen coords — otherwise the cached beam would desync from the mirrors.
  const traceK = [D, W, angleDeg, srcG.toFixed(3), srcW.toFixed(3), zoom.toFixed(3), Math.round(panX), Math.round(panY)].join("|");
  if (traceK !== traceKey) {
    traceCache = trace(createVector(srcX, srcY), dir, mirrors);
    traceKey = traceK;
  }
  const { points, count, exited, ray } = traceCache;

  // Clip cavity/beam drawing to the plot so zoom/pan never spills over the
  // controls, readout, or hints.
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(PLOT.left, PLOT.top, plotW, plotH);
  drawingContext.clip();

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

  // Beam: entry (source -> first hit) dashed, bounces solid, exit dashed.
  stroke(...laserColor);
  strokeWeight(beamWeight);
  if (count > 0) {
    dashed(points[0].x, points[0].y, points[1].x, points[1].y);
    for (let i = 1; i < points.length - 1; i++) {
      line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
  }
  if (exited) {
    const last = points[points.length - 1];
    const exitEnd = p5.Vector.add(last, p5.Vector.copy(ray.dir).setMag(plotW + plotH));
    stroke(...laserColor, 170);
    dashed(last.x, last.y, exitEnd.x, exitEnd.y);
  }

  // Reflection spots, coloured by which mirror they land on.
  let hitsLeft = 0;
  let hitsRight = 0;
  for (let i = 1; i < points.length; i++) {
    const onLeft = Math.abs(points[i].x - xL) < Math.abs(points[i].x - xR);
    if (onLeft) hitsLeft++; else hitsRight++;
    if (showSpots) {
      noStroke();
      fill(...(onLeft ? mirrorColorA : mirrorColorB));
      circle(points[i].x, points[i].y, Math.max(3, beamWeight + 3));
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

  // --- dimension annotations ----------------------------------------------
  stroke(...dimColor);
  strokeWeight(1);
  const dY = yB + 34;          // D arrow below the cavity
  arrow(xL, dY, xR, dY); arrow(xR, dY, xL, dY);
  // Width dimension on the side OPPOSITE the laser source, so it stays clear of it.
  const wX = sourceOnLeft ? xR + 34 : xL - 34;
  arrow(wX, yB, wX, yT); arrow(wX, yT, wX, yB);
  noStroke();
  fill(...dimColor);
  textAlign(CENTER, TOP);
  text("D = " + D + " cm (mirror gap)", (xL + xR) / 2, dY + 6);
  push();
  translate(wX + (sourceOnLeft ? 8 : -8), (yB + yT) / 2);
  rotate(-HALF_PI);
  textAlign(CENTER, sourceOnLeft ? TOP : BOTTOM);
  text("W = " + W + " cm", 0, 0);
  pop();
  textAlign(LEFT, BASELINE);

  drawingContext.restore(); // end plot clip

  // --- readout -------------------------------------------------------------
  const driftPerLeg = D * Math.tan(beta);                 // width units per gap-crossing
  const spotSpacing = 2 * driftPerLeg;                    // spacing between spots on one mirror
  const analytic = beta > 0 ? W / driftPerLeg : Infinity; // entry-independent estimate (continuous)
  const capped = !exited && count >= REFLECTIONS_LIMIT;

  noStroke();
  fill(...laserColor);
  textSize(26);
  let countLabel;
  if (capped && beta === 0) countLabel = String.fromCharCode(8734); // never drifts -> infinite
  else if (capped) countLabel = "~" + Math.round(analytic);          // finite, but too many to draw
  else countLabel = String(count);                                    // the actual traced count
  text("Reflections: " + countLabel, PLOT.left, 56);
  textSize(13);

  fill(...defaultColor);
  let info;
  if (capped && beta === 0) {
    info = "angle 0 - beam never drifts off the mirror (infinite reflections)";
  } else if (capped) {
    info = "trace capped at " + REFLECTIONS_LIMIT + " - raise the angle to draw them all";
  } else if (count === 0) {
    info = "beam misses the mirrors - drag the source or change the angle";
  } else {
    info = "on left mirror: " + hitsLeft + "    on right mirror: " + hitsRight
      + (exited ? "    (beam left the ring)" : "");
  }
  text(info, PLOT.left, 80);

  // Source position relative to the mirrors.
  fill(...defaultColor);
  const srcLine = (behindMirror > 0
    ? "source: " + behindMirror.toFixed(1) + " cm behind " + behindWhich + " mirror"
    : "source: inside the gap")
    + "    .    side offset: " + sideOffset.toFixed(1) + " cm along W (0 = bottom end)";
  text(srcLine, PLOT.left, 98);

  if (showEstimate && beta > 0) {
    fill(...dimColor);
    text("max (full width) W/(D*tan) ~ " + analytic.toFixed(1)
      + "    drift/bounce = " + driftPerLeg.toFixed(2) + " cm"
      + "    spot spacing = " + spotSpacing.toFixed(2) + " cm"
      + "    (actual count depends on where the beam enters along W)", PLOT.left, 116);
  }

  // Hints.
  fill(...dimColor);
  textAlign(LEFT, BOTTOM);
  text("drag handle = move source   |   drag empty = pan   |   wheel = zoom   |   double-click = reset", PLOT.left, PLOT.bottom + 30);
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
