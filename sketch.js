const backgroundValue = 10;

let walls = [];
let laser1;
let laser2;

let segmentsSlider;
let attenuationSlider; // TODO: Depends on angle?
let innerRadiusSlider;
let outerRadiusSlider;
let speedSlider;
let secondLaserCheckbox;
let normalVectorsCheckbox;

function star(x, y, radius1, radius2, npoints, speed) {
  const walls = [];
  const points = [];
  let angle = TWO_PI / npoints;

  let halfAngle = angle / 2.0;
  const shiftAngle = frameCount * speed;

  for (let a = shiftAngle; a < TWO_PI + shiftAngle; a += angle) {
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
    walls.push(new Boundary(x1, y1, x2, y2));
    point(x1, y1);
  }

  return walls;
}

function setup() {
  createCanvas(800, 800);

  let sliderSize = 180;

  segmentsSlider = createSlider(2, 50, 20, 1);
  segmentsSlider.position(10, 10);
  segmentsSlider.size(sliderSize);

  attenuationSlider = createSlider(10, 70, 30, 1);
  attenuationSlider.position(10, 30);
  attenuationSlider.size(sliderSize);

  innerRadiusSlider = createSlider(100, 300, 197, 1);
  innerRadiusSlider.position(10, 50);
  innerRadiusSlider.size(sliderSize);

  outerRadiusSlider = createSlider(100, 300, 200, 1);
  outerRadiusSlider.position(10, 70);
  outerRadiusSlider.size(sliderSize);

  speedSlider = createSlider(1 / 6000.0, 1 / 400.0, 1 / 1600.0, 0.0001);
  speedSlider.position(10, 90);
  speedSlider.size(sliderSize);

  secondLaserCheckbox = createCheckbox("", true);
  secondLaserCheckbox.position(10, 110);

  normalVectorsCheckbox = createCheckbox("", true);
  normalVectorsCheckbox.position(10, 130);
}

function draw() {
  background(backgroundValue);
 
  fill(250);
  text('segments: ' + segmentsSlider.value(), segmentsSlider.x * 2 + segmentsSlider.width, segmentsSlider.y + 14);
  text('attenuation: ' + attenuationSlider.value(), attenuationSlider.x * 2 + attenuationSlider.width, attenuationSlider.y + 14);
  text('inner radius: ' + innerRadiusSlider.value(), innerRadiusSlider.x * 2 + innerRadiusSlider.width, innerRadiusSlider.y + 14);
  text('outer radius: ' + outerRadiusSlider.value(), outerRadiusSlider.x * 2 + outerRadiusSlider.width, outerRadiusSlider.y + 14);
  text('speed: ' + parseInt(speedSlider.value() * 10000), speedSlider.x * 2 + speedSlider.width, speedSlider.y + 14);
  text('second laser', 40, 110 + 14);
  text('normal vectors', 40, 130 + 14);

  const starWidth = Math.max(innerRadiusSlider.value(), outerRadiusSlider.value());

  laser1 = new Laser(createVector(width / 2 - starWidth - 50, height / 2), radians(0), attenuationSlider.value());
  laser2 = new Laser(createVector(width / 2 + starWidth + 50, height / 2), radians(180), attenuationSlider.value());
  walls = star(width * 0.5, height * 0.5, innerRadiusSlider.value(), outerRadiusSlider.value(), segmentsSlider.value(), speedSlider.value());

  for (const wall of walls) {
    wall.show();
  }

  laser1.show();
  laser1.look(walls);
  
  if (secondLaserCheckbox.checked()) {
    laser2.show();
    laser2.look(walls);
  }

  frameRate(60);

  let fps = frameRate();
  text("fps: " + parseInt(fps), width - 45, 20);
  text("ver: 0.1 \nApril 14th 2024", 10, height - 40);
  // noLoop();
}
