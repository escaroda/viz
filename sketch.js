const SLIDER_SIZE = 180;
const SLIDER_DISTANCE_BETWEEN = 20;
const SLIDER_TEXT_DISTANCE_BETWEEN = 14;
const COLOR_PICKER_DISTANCE_BETWEEN = 30;
const BACKGROUND_COLOR = 10;

const defaultColor = [230];
const defaultLaserColor = [255, 30, 30];
const wallColor1 = [50, 150, 250, 230];
const wallColor2 = [200, 90, 250, 250];
const speedFormat = (value) => parseInt(value * 10000);
const wheelTypes = ["star", "wave"];

const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());
// console.log(params);

const sliders = {
  "attenuation": { config: [10, 70, 60, 1], name: "attenuation", color: defaultColor },
  "wall_weight": { config: [0, 5, 0.4, 0.1], name: "wall weight", color: defaultColor },
  "laser_weight": { config: [0, 5, 2, 0.1], name: "laser weight", color: defaultColor },
  "laser_height_1": { config: [-200, 200, 0, 0.1], name: "left laser height", color: defaultColor },
  "laser_angle_1": { config: [-90, 90, 0, 0.01], name: "left laser angle", color: defaultColor },
  "laser_height_2": { config: [-200, 200, 0, 0.1], name: "right laser height", color: defaultColor },
  "laser_angle_2": { config: [-90, 90, 0, 0.01], name: "right laser angle", color: defaultColor },

  // 1st wheel
  "segments_1": { config: [2, 50, 20, 1], name: "segments", color: wallColor1 },
  "inner_1": { config: [100, 300, 197, 1], name: "inner radius", color: wallColor1 },
  "outer_1": { config: [100, 300, 200, 1], name: "outer radius", color: wallColor1 },
  "speed_1": { config: [-1 / 400.0, 1 / 400.0, 1 / 1600.0, 0.0001], name: "speed", color: wallColor1, format: speedFormat },
  "phase_1": { config: [-46, 46, 0, 0.1], name: "phase", color: wallColor1 },
  "ratio_1": { config: [0, 1, 0.5, 0.01], name: "ratio", color: wallColor1 },

  // 2nd wheel
  "segments_2": { config: [2, 50, 20, 1], name: "segments", color: wallColor2 },
  "inner_2": { config: [100, 300, 197, 1], name: "inner radius", color: wallColor2 },
  "outer_2": { config: [100, 300, 200, 1], name: "outer radius", color: wallColor2 },
  "speed_2": { config: [-1 / 400.0, 1 / 400.0, 1 / 1600.0, 0.0001], name: "speed", color: wallColor2, format: speedFormat },
  "phase_2": { config: [-46, 46, 0, 0.1], name: "phase", color: wallColor2 },
  "ratio_2": { config: [0, 1, 0.5, 0.01], name: "ratio", color: wallColor2 },
};

const checkboxes = {
  "laser_1": { config: { isChecked: true }, color: defaultColor, name: "left laser" },
  "laser_2": { config: { isChecked: true }, color: defaultColor, name: "right laser" },
  "normals": { config: { isChecked: false }, color: defaultColor, name: "normal vectors" },
  "grayscale": { config: { isChecked: true }, color: defaultColor, name: "grayscale walls" },
};

const colorPickers = {
  "laser_color_1": { color: defaultLaserColor, posShift: [-50, 0], name: "left laser color" },
  "laser_color_2": { color: defaultLaserColor, posShift: [50, 0], name: "right laser color" },
};

const selectors = {
  "wheel_type_1": { options: wheelTypes, selected: wheelTypes[0] },
  "wheel_type_2": { options: wheelTypes, selected: wheelTypes[0] },
};

function getGrayscale(r, g, b) {
  return [(0.2126 * r) + (0.7152 * g) + (0.0722 * b)];
}

function setSearchParams(key, value) {
  if ("URLSearchParams" in window) {
    var searchParams = new URLSearchParams(window.location.search)
    searchParams.set(key, value);
    var newRelativePathQuery = window.location.pathname + "?" + searchParams.toString();
    history.pushState(null, "", newRelativePathQuery);
  }
}

function onInputChange({ target }) {
  if (target.type === "checkbox" && target.offsetParent.id) {
    setSearchParams(target.offsetParent.id, Number(target.checked)); 
  } else {
    setSearchParams(target.id, target.value);
  }
}

function setup() {
  createCanvas(1280, 840);
  blendMode(SCREEN);

  let y = -10;

  for (const [id, slider] of Object.entries(sliders)) {
    if (params[id]) {
      slider.config[2] = Number(params[id]);
    }
    const instance = createSlider(...slider.config);
    instance.position(10, y += SLIDER_DISTANCE_BETWEEN);
    instance.size(SLIDER_SIZE);
    instance.class("slider");
    instance.id(id);
    instance.elt.addEventListener("change", onInputChange);
    slider.instance = instance;
  }

  for (const [id, checkbox] of Object.entries(checkboxes)) {
    if (params[id]) {
      checkbox.config.isChecked = !!Number(params[id]);
    }
    const instance = createCheckbox("", checkbox.config.isChecked);
    instance.position(10, y += SLIDER_DISTANCE_BETWEEN);
    instance.elt.id = id;
    instance.elt.addEventListener("change", onInputChange);
    checkbox.instance = instance;
  }

  for (const [id, colorPicker] of Object.entries(colorPickers)) {
    if (params[id]) {
      colorPicker.color = color(params[id]).levels;
    }
    const instance = createColorPicker(color(colorPicker.color));
    instance.class("color-picker");
    instance.id(id);
    instance.elt.addEventListener("input", onInputChange);
    colorPicker.instance = instance;
  }

  y += 6;

  for (const [id, selector] of Object.entries(selectors)) {
    if (params[id]) {
      selector.selected = params[id];
    }
    const instance = createSelect();
    instance.position(10, y += SLIDER_DISTANCE_BETWEEN);
    wheelTypes.forEach(type => instance.option(type));
    instance.selected(selector.selected);
    instance.class("wheel-type-selector");
    instance.id(id);
    instance.elt.addEventListener("change", onInputChange);
    selector.instance = instance;
  }
}

function draw() {
  clear()
  background(BACKGROUND_COLOR);
  noStroke();

  for (const id in sliders) {
    const { color, format, instance, name } = sliders[id];
    const displayedValue = format ? format(instance.value()) : instance.value();

    if (id.startsWith("laser") && id !== "laser_weight") {
      const idx = id.split("_").at(-1);
      fill(...colorPickers["laser_color_" + idx].instance.color().levels);
    } else {
      fill(...color);
    }

    text(name + ": " + displayedValue, instance.x * 2 + instance.width, instance.y + SLIDER_TEXT_DISTANCE_BETWEEN);
  }

  for (const id in checkboxes) {
    const { color, instance, name } = checkboxes[id];
    fill(...color);
    text(name, 40, instance.y + SLIDER_TEXT_DISTANCE_BETWEEN);
  }

  const starWidth = Math.max(
    sliders["inner_1"].instance.value(),
    sliders["outer_1"].instance.value(),
    sliders["inner_2"].instance.value(),
    sliders["outer_2"].instance.value(),
  );
  const wallColorSelected1 = checkboxes["grayscale"].instance.checked() ? getGrayscale(...wallColor1) : wallColor1;
  const wallColorSelected2 = checkboxes["grayscale"].instance.checked() ? getGrayscale(...wallColor2) : wallColor2;

  for (const id in colorPickers) {
    const idx = id.split("_").at(-1);
    const { instance, posShift: [dx] } = colorPickers[id];
    instance.position(width / 2 + (dx > 0 ? 1 : -1) * starWidth + dx - 25, height / 2 - 14 - sliders["laser_height_" + idx].instance.value());
  }

  const laser1 = new Laser(createVector(width / 2 - starWidth - 50, height / 2 - sliders["laser_height_1"].instance.value()), radians(sliders["laser_angle_1"].instance.value()), sliders["attenuation"].instance.value(), colorPickers["laser_color_1"].instance.color().levels);
  const laser2 = new Laser(createVector(width / 2 + starWidth + 50, height / 2 - sliders["laser_height_2"].instance.value()), radians(180 + sliders["laser_angle_2"].instance.value()), sliders["attenuation"].instance.value(), colorPickers["laser_color_2"].instance.color().levels);
  const wheel1 = new Wheel(selectors["wheel_type_1"].instance.selected(), width * 0.5, height * 0.5, sliders["inner_1"].instance.value(), sliders["outer_1"].instance.value(), sliders["segments_1"].instance.value(), sliders["ratio_1"].instance.value(), sliders["speed_1"].instance.value(), radians(sliders["phase_1"].instance.value()), wallColorSelected1);
  const wheel2 = new Wheel(selectors["wheel_type_2"].instance.selected(), width * 0.5, height * 0.5, sliders["inner_2"].instance.value(), sliders["outer_2"].instance.value(), sliders["segments_2"].instance.value(), sliders["ratio_2"].instance.value(), sliders["speed_2"].instance.value(), radians(sliders["phase_2"].instance.value()), wallColorSelected2);

  if (checkboxes["laser_1"].instance.checked()) {
    wheel1.forEach(w => w.show());
    laser1.show();
    laser1.look(wheel1);
  }

  if (checkboxes["laser_2"].instance.checked()) {
    wheel2.forEach(w => w.show());
    laser2.show();
    laser2.look(wheel2);
  }

  frameRate(60);
  const fps = frameRate();
  fill(200, 100, 0);
  noStroke();
  text("fps: " + parseInt(fps), width - 45, 20);
  // noLoop();
}
