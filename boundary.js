class Boundary {
  constructor(x1, y1, x2, y2, color) {
    this.a = createVector(x1, y1);
    this.b = createVector(x2, y2);
    this.c = createVector((x1 + x2) / 2, (y1 + y2) / 2); // center
    this.color = color;

    const dx = x2 - x1;
    const dy = y2 - y1;

    this.n = createVector(-dy, dx); // normal
    this.n.normalize();
    this.n.setMag(20);

    // print(p5.Vector.angleBetween(createVector(1, 0), createVector(this.b.x - this.a.x, this.b.y - this.a.y)));
  }

  show() {
    stroke(...this.color);
    strokeWeight(sliders["wall_weight"].instance.value());

    line(this.a.x, this.a.y, this.b.x, this.b.y);

    // Draw Normals
    if (checkboxes["normals"].instance.checked()) {
      stroke(50, 255, 100, 100);
      strokeWeight(1);
      line(this.c.x, this.c.y, this.c.x + this.n.x, this.c.y + this.n.y);
    }
  }
}