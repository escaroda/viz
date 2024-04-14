class Laser {
    constructor(pos, angle, attenuation) {
        this.pos = pos
        this.attenuation = attenuation;
        this.ray = new Ray(this.pos, angle, 255, true);
        this.reflections = 50;
        this.power = 255;
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
                    // console.log('angle', angle, degrees(angle), PI / 2);
    
                    // if (Math.abs(angle) < PI / 2) { // Doesn't work
                    //     continue;
                    // }
    
                    const distance = p5.Vector.dist(ray.pos, pt);
                    // console.log('distance', distance);
                    if (distance < 1) { // TODO: Why this even happens?
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
            
            if (collision && i * this.attenuation < 255) {
                stroke(255, 50, 50, 255 - i * this.attenuation);
                line(ray.pos.x, ray.pos.y, collision.x, collision.y);
                ray = new Ray(collision, nextDir.heading(), 255 - i * 30);
            } else {
                // console.log('break');
                break;
            }
        }
    }

    show() {
        fill(255, 100, 0, 255);
        this.ray.show();
    }
}