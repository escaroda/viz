const RELECTIONS_LIMIT = 50;

class Laser {
  constructor(pos, angle, attenuation, color) {
    this.pos = pos
    this.angle = angle
    this.attenuation = attenuation;
    this.ray = new Ray(this.pos, this.angle, 255, true);
    this.reflections = RELECTIONS_LIMIT;
    this.power = 255;
    this.color = color.slice(0, 3);
  }

  look(walls) {
    let collision = null;
    let nextDir = null;
    let record = 0;
    let ray = this.ray;

    for (let i = 0; i < this.reflections + 1; i++) {
      record = ray.passThrough ? 0 : Infinity;

      for (const wall of walls) {
        const pt = ray.cast(wall);

        if (pt) {
          // Check angle between laser and normal
          // const angle = ray.dir.angleBetween(wall.n);
          // console.log("angle", angle, degrees(angle), PI / 2);

          // if (Math.abs(angle) < PI / 2) { // Doesn"t work
          //     continue;
          // }

          const distance = p5.Vector.dist(ray.pos, pt);
          // console.log("distance", distance);
          if (distance < 0.01) { // TODO: Why this even happens?
            continue;
          }

          if (ray.passThrough) {
            if (distance > record) {
              record = distance;
              collision = pt;
              nextDir = p5.Vector.reflect(ray.dir, wall.n);
            }
          } else {
            if (distance < record) {
              record = distance;
              collision = pt;
              nextDir = p5.Vector.reflect(ray.dir, wall.n);
            }
          }
        }
      }

      stroke(...this.color, 255 - i * this.attenuation);
      strokeWeight(sliders["laser_weight"].instance.value());

      if (collision && i * this.attenuation < 255) {
        line(ray.pos.x, ray.pos.y, collision.x, collision.y);
        ray = new Ray(collision, nextDir.heading(), 255 - i * 30);
      } else if (i === 0) {
        const diagonal = new p5.Vector(width, height).mag();
        const rayEnd = p5.Vector.add(ray.pos, p5.Vector.copy(ray.dir).setMag(diagonal));
        line(ray.pos.x, ray.pos.y, rayEnd.x, rayEnd.y);
        break;
      } else {
        break;
      }
    }
  }

  show() {
    fill(255, 100, 0, 255);
    this.ray.show();
  }
}