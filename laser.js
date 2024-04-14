class Laser {
    constructor(pos, angle, attenuation) {
        this.pos = pos
        this.attenuation = attenuation;
        this.ray = new Ray(this.pos, angle);
        this.reflections = 50;
        this.power = 255;
    }

    look(walls) {
        let closest = null;
        let nextDir = null;
        let record = 0;
        let ray = this.ray;

        for (let i = 0; i < this.reflections + 1; i++) {
            record = 0;

            for (const wall of walls) {
                const pt = ray.cast(wall);
    
                if (pt) {
                    // Check angle between laser and normal
                    const angle = ray.dir.angleBetween(wall.n);
                    console.log('angle', angle, degrees(angle), PI / 2);
    
                    // if (Math.abs(angle) < PI / 2) { // FIXME!
                    //     continue;
                    // }
    
                    const d = p5.Vector.dist(ray.pos, pt);

                    if (d > record) {
                        record = d;
                        closest = pt;
                        nextDir = p5.Vector.reflect(ray.dir, wall.n);
                    }
                }
            }
            
            if (closest && i * this.attenuation < 255) {
                stroke(255, 50, 100, 255 - i * this.attenuation);
                line(ray.pos.x, ray.pos.y, closest.x, closest.y);
                ray = new Ray(closest, nextDir.heading(), 255 - i * 30);
            } else {
                console.log('break');
                break;
            }
        }
    }

    show() {
        fill(255, 100, 0, 255);
        this.ray.show();
    }
}