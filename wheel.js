let resolution = 6000;

class Wheel {
    constructor(type, x, y, radius1, radius2, npoints, speed, phase, color) {
        return this[type](x, y, radius1, radius2, npoints, speed, phase, color);
    }

    star(x, y, radius1, radius2, npoints, speed, phase, color) {
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

    wave(x, y, radius1, radius2, npoints, speed, phase, color) {
        const walls = [];
        const points = [];
        const angle = TWO_PI / resolution;
      
        const shiftAngle = frameCount * speed;
      
        for (let a = shiftAngle + phase; a < TWO_PI + shiftAngle + phase; a += angle) {
          const c = map(sin(a * npoints), -1, 1, radius1, radius2);
          let x1 = x + cos(a + shiftAngle) * c;
          let y1 = y + sin(a + shiftAngle) * c;
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