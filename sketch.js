const backgroundValue = 10;

let walls1 = [];
let walls2 = [];
const wallColor1 = [50, 150, 250, 230];
const wallColor2 = [200, 90, 250, 250];
let laser1;
let laser2;

let attenuationSlider;

let segmentsSlider1;
let innerRadiusSlider1;
let outerRadiusSlider1;
let speedSlider1;
let phaseSlider1;

let segmentsSlider2;
let innerRadiusSlider2;
let outerRadiusSlider2;
let speedSlider2;
let phaseSlider2;

let wallWeightSlider;
let laserWeightSlider;

let laserCheckbox1;
let laserCheckbox2;
let normalVectorsCheckbox;
let grayscaleWalls;


function getGrayscale(r, g, b) {
  return [(0.2126 * r) + (0.7152 * g) + (0.0722 * b)];
}

function star(x, y, radius1, radius2, npoints, speed, phase, color) {
  const walls = [];
  const points = [];
  let angle = TWO_PI / npoints;

  let halfAngle = angle / 2.0;
  const shiftAngle = frameCount * speed;

  for (let a = shiftAngle + phase; a < TWO_PI + shiftAngle + phase; a += angle) {
    let x1 = x + cos(a) * radius2;
    let y1 = y + sin(a) * radius2;
    points.push([x1, y1]);
    let x2 = x + cos(a + halfAngle) * radius1;
    let y2 = y + sin(a + halfAngle) * radius1;
    points.push([x2, y2]);
  }

  for (let i = 0; i < npoints * 2; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % (npoints * 2)];
    walls.push(new Boundary(x1, y1, x2, y2, color));
    // point(x1, y1);
  }

  return walls;
}

function onSliderChange(e) {
  console.log(e);

  if ('URLSearchParams' in window) {
    var searchParams = new URLSearchParams(window.location.search)
    searchParams.set(e.target.id, e.target.value);
    var newRelativePathQuery = window.location.pathname + '?' + searchParams.toString();
    history.pushState(null, '', newRelativePathQuery);
  }
}

function setup() {
  createCanvas(1024, 840);

  let sliderSize = 180;
  let y = -10;
  let yShift = 20;

  const urlSearchParams = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(urlSearchParams.entries());

  attenuationSlider = createSlider(10, 70, params.attenuation ? Number(params.attenuation) : 30, 1);
  attenuationSlider.position(10, y += yShift);
  attenuationSlider.size(sliderSize);
  attenuationSlider.class('slider');
  attenuationSlider.id('attenuation');
  attenuationSlider.elt.addEventListener("change", onSliderChange);

  wallWeightSlider = createSlider(1, 5, params.wall_weight ? Number(params.wall_weight) : 1, 0.1);
  wallWeightSlider.position(10, y += yShift);
  wallWeightSlider.size(sliderSize);
  wallWeightSlider.class('slider');
  wallWeightSlider.id('wall_weight');
  wallWeightSlider.elt.addEventListener("change", onSliderChange);

  laserWeightSlider = createSlider(1, 5, params.laser_weight ? Number(params.laser_weight) : 2, 0.1);
  laserWeightSlider.position(10, y += yShift);
  laserWeightSlider.size(sliderSize);
  laserWeightSlider.class('slider');
  laserWeightSlider.id('laser_weight');
  laserWeightSlider.elt.addEventListener("change", onSliderChange);

  segmentsSlider1 = createSlider(2, 50, params.segments_1 ? Number(params.segments_1) : 20, 1);
  segmentsSlider1.position(10, y += yShift);
  segmentsSlider1.size(sliderSize);
  segmentsSlider1.class('slider');
  segmentsSlider1.id('segments_1');
  segmentsSlider1.elt.addEventListener("change", onSliderChange);

  innerRadiusSlider1 = createSlider(100, 300, params.inner_1 ? Number(params.inner_1) : 197, 1);
  innerRadiusSlider1.position(10, y += yShift);
  innerRadiusSlider1.size(sliderSize);
  innerRadiusSlider1.class('slider');
  innerRadiusSlider1.id('inner_1');
  innerRadiusSlider1.elt.addEventListener("change", onSliderChange);

  outerRadiusSlider1 = createSlider(100, 300, params.outer_1 ? Number(params.outer_1) : 200, 1);
  outerRadiusSlider1.position(10, y += yShift);
  outerRadiusSlider1.size(sliderSize);
  outerRadiusSlider1.class('slider');
  outerRadiusSlider1.id('outer_1');
  outerRadiusSlider1.elt.addEventListener("change", onSliderChange);

  speedSlider1 = createSlider(-1 / 400.0, 1 / 400.0, params.speed_1 ? Number(params.speed_1) : 1 / 1600.0, 0.0001);
  speedSlider1.position(10, y += yShift);
  speedSlider1.size(sliderSize);
  speedSlider1.class('slider');
  speedSlider1.id('speed_1');
  speedSlider1.elt.addEventListener("change", onSliderChange);

  phaseSlider1 = createSlider(-46, 46, params.phase_1 ? Number(params.phase_1) : 0, 0.1);
  phaseSlider1.position(10, y += yShift);
  phaseSlider1.size(sliderSize);
  phaseSlider1.class('slider');
  phaseSlider1.id('phase_1');
  phaseSlider1.elt.addEventListener("change", onSliderChange);

  segmentsSlider2 = createSlider(2, 50, params.segments_2 ? Number(params.segments_2) : 20, 1);
  segmentsSlider2.position(10, y += yShift);
  segmentsSlider2.size(sliderSize);
  segmentsSlider2.class('slider');
  segmentsSlider2.id('segments_2');
  segmentsSlider2.elt.addEventListener("change", onSliderChange);

  innerRadiusSlider2 = createSlider(100, 300, params.inner_2 ? Number(params.inner_2) : 197, 1);
  innerRadiusSlider2.position(10, y += yShift);
  innerRadiusSlider2.size(sliderSize);
  innerRadiusSlider2.class('slider');
  innerRadiusSlider2.id('inner_2');
  innerRadiusSlider2.elt.addEventListener("change", onSliderChange);

  outerRadiusSlider2 = createSlider(100, 300, params.outer_2 ? Number(params.outer_2) : 200, 1);
  outerRadiusSlider2.position(10, y += yShift);
  outerRadiusSlider2.size(sliderSize);
  outerRadiusSlider2.class('slider');
  outerRadiusSlider2.id('outer_2');
  outerRadiusSlider2.elt.addEventListener("change", onSliderChange);

  speedSlider2 = createSlider(-1 / 400.0, 1 / 400.0, params.speed_2 ? Number(params.speed_2) : 1 / 1600.0, 0.0001);
  speedSlider2.position(10, y += yShift);
  speedSlider2.size(sliderSize);
  speedSlider2.class('slider');
  speedSlider2.id('speed_2');
  speedSlider2.elt.addEventListener("change", onSliderChange);

  phaseSlider2 = createSlider(-46, 46, params.phase_2 ? Number(params.phase_2) : 0, 0.1);
  phaseSlider2.position(10, y += yShift);
  phaseSlider2.size(sliderSize);
  phaseSlider2.class('slider');
  phaseSlider2.id('phase_2');
  phaseSlider2.elt.addEventListener("change", onSliderChange);

  laserCheckbox1 = createCheckbox("", params.laser_1 ? !!Number(params.laser_1) : true);
  laserCheckbox1.position(10, y += yShift);

  laserCheckbox2 = createCheckbox("", params.laser_2 ? !!Number(params.laser_2) : true);
  laserCheckbox2.position(10, y += yShift);

  normalVectorsCheckbox = createCheckbox("", params.normals ? !!Number(params.normals) : false);
  normalVectorsCheckbox.position(10, y += yShift);

  grayscaleWallsCheckbox = createCheckbox("", params.grayscale ? !!Number(params.grayscale) : true);
  grayscaleWallsCheckbox.position(10, y += yShift);
}

function draw() {
  background(backgroundValue);
 
  fill(230);
  noStroke();
  text('attenuation: ' + attenuationSlider.value(), attenuationSlider.x * 2 + attenuationSlider.width, attenuationSlider.y + 14);
  text('wall weight: ' + wallWeightSlider.value(), wallWeightSlider.x * 2 + wallWeightSlider.width, wallWeightSlider.y + 14);
  text('laser weight: ' + laserWeightSlider.value(), laserWeightSlider.x * 2 + laserWeightSlider.width, laserWeightSlider.y + 14);

  fill(...wallColor1);
  text('segments: ' + segmentsSlider1.value(), segmentsSlider1.x * 2 + segmentsSlider1.width, segmentsSlider1.y + 14);
  text('inner radius: ' + innerRadiusSlider1.value(), innerRadiusSlider1.x * 2 + innerRadiusSlider1.width, innerRadiusSlider1.y + 14);
  text('outer radius: ' + outerRadiusSlider1.value(), outerRadiusSlider1.x * 2 + outerRadiusSlider1.width, outerRadiusSlider1.y + 14);
  text('speed: ' + parseInt(speedSlider1.value() * 10000), speedSlider1.x * 2 + speedSlider1.width, speedSlider1.y + 14);
  text('phase: ' + phaseSlider1.value(), phaseSlider1.x * 2 + phaseSlider1.width, phaseSlider1.y + 14);

  fill(...wallColor2);
  text('segments: ' + segmentsSlider2.value(), segmentsSlider2.x * 2 + segmentsSlider2.width, segmentsSlider2.y + 14);
  text('inner radius: ' + innerRadiusSlider2.value(), innerRadiusSlider2.x * 2 + innerRadiusSlider2.width, innerRadiusSlider2.y + 14);
  text('outer radius: ' + outerRadiusSlider2.value(), outerRadiusSlider2.x * 2 + outerRadiusSlider2.width, outerRadiusSlider2.y + 14);
  text('speed: ' + parseInt(speedSlider2.value() * 10000), speedSlider2.x * 2 + speedSlider2.width, speedSlider2.y + 14);
  text('phase: ' + phaseSlider2.value(), phaseSlider2.x * 2 + phaseSlider2.width, phaseSlider2.y + 14);

  fill(230);
  text('left laser', 40, laserCheckbox1.y + 14);
  text('right laser', 40, laserCheckbox2.y + 14);
  text('normal vectors', 40, normalVectorsCheckbox.y + 14);
  text('grayscale walls', 40, grayscaleWallsCheckbox.y + 14);

  fill(255, 100, 0, 255);
  

  const starWidth = Math.max(innerRadiusSlider1.value(), outerRadiusSlider1.value(), innerRadiusSlider2.value(), outerRadiusSlider2.value());
  const wallColorSelected1 = grayscaleWallsCheckbox.checked() ? getGrayscale(...wallColor1) : wallColor1;
  const wallColorSelected2 = grayscaleWallsCheckbox.checked() ? getGrayscale(...wallColor2) : wallColor2;

  laser1 = new Laser(createVector(width / 2 - starWidth - 50, height / 2), radians(0), attenuationSlider.value());
  laser2 = new Laser(createVector(width / 2 + starWidth + 50, height / 2), radians(180), attenuationSlider.value());
  walls1 = star(width * 0.5, height * 0.5, innerRadiusSlider1.value(), outerRadiusSlider1.value(), segmentsSlider1.value(), speedSlider1.value(), radians(phaseSlider1.value()), wallColorSelected1);
  walls2 = star(width * 0.5, height * 0.5, innerRadiusSlider2.value(), outerRadiusSlider2.value(), segmentsSlider2.value(), speedSlider2.value(), radians(phaseSlider2.value()), wallColorSelected2);

  
  for (const wall1 of walls1) {
    wall1.show();
  }

  if (laserCheckbox1.checked()) {
    laser1.show();
    laser1.look(walls1);
  }
  
  if (laserCheckbox2.checked()) {
    for (const wall2 of walls2) {
      wall2.show();
    }

    laser2.show();
    laser2.look(walls2);
  }

  frameRate(60);

  let fps = frameRate();
  fill(200, 100, 0);
  noStroke();
  text("fps: " + parseInt(fps), width - 45, 20);
  text("ver: 0.5 \nApril 15th 2024", 10, height - 40);
  // noLoop();
}
