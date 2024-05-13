let resolution = 6000;

class Wheel {
  constructor(type, x, y, radius1, radius2, npoints, ratio = 0.5, speed, phase, color) {
    return this[type](x, y, radius1, radius2, npoints, ratio, speed, phase, color);
  }

  star(x, y, radius1, radius2, npoints, ratio, speed, phase, color) {
    const walls = [];
    const points = [];
    const angle = TWO_PI / npoints;
    const halfAngle = angle * ratio;
    const shiftAngle = frameCount * speed;

    for (let a = 0; a < TWO_PI; a += angle) {
      let x1 = x + cos(a + shiftAngle + phase) * radius2;
      let y1 = y + sin(a + shiftAngle + phase) * radius2;
      points.push([x1, y1]);
      let x2 = x + cos(a + halfAngle + shiftAngle + phase) * radius1;
      let y2 = y + sin(a + halfAngle + shiftAngle + phase) * radius1;
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

  wave(x, y, radius1, radius2, npoints, ratio, speed, phase, color) {
    const walls = [];
    const points = [];
    const angle = TWO_PI / resolution;

    const shiftAngle = frameCount * speed;

    for (let a = 0; a < TWO_PI; a += angle) {
      const c = map(sin(a * npoints), -1, 1, radius1, radius2);
      let x1 = x + cos(a + shiftAngle + phase) * c;
      let y1 = y + sin(a + shiftAngle + phase) * c;
      points.push([x1, y1]);
      // let x2 = x + cos(a + halfAngle) * radius1;
      // let y2 = y + sin(a + halfAngle) * radius1;
      // points.push([x2, y2]);
    }

    for (let i = 0; i < resolution; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % resolution];
      walls.push(new Boundary(x1, y1, x2, y2, color));
      // stroke('orange');
      // strokeWeight(4);
      // point(x1, y1);
    }

    return walls;
  }
}