class Animator {
  constructor(
    spriteSheet,
    xStart,
    yStart,
    frameWidth,
    frameHeight,
    frameCount,
    frameDuration,
    loop = true,
    frameGap = 0 // NEW: pixels between frames
  ) {
    this.spriteSheet = spriteSheet;
    this.xStart = xStart;
    this.yStart = yStart;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.frameCount = frameCount;
    this.frameDuration = frameDuration;

    this.loop = loop;
    this.frameGap = frameGap; // NEW

    this.elapsedTime = 0;
    this.totalTime = frameCount * frameDuration;
  }

  reset() {
    this.elapsedTime = 0;
  }

  currentFrame() {
    let frame = Math.floor(this.elapsedTime / this.frameDuration);
    if (frame < 0) frame = 0;
    if (frame > this.frameCount - 1) frame = this.frameCount - 1;
    return frame;
  }

  drawFrame(tick, ctx, x, y, scale) {
    this.elapsedTime += tick;

    if (this.loop) {
      if (this.elapsedTime >= this.totalTime) {
        this.elapsedTime -= this.totalTime;
      }
    } else {
      if (this.elapsedTime >= this.totalTime) {
        this.elapsedTime = this.totalTime - 0.000001;
      }
    }

    const frame = this.currentFrame();
    const sx = this.xStart + frame * (this.frameWidth + this.frameGap); // UPDATED
    const sy = this.yStart;

    ctx.drawImage(
      this.spriteSheet,
      sx, sy, this.frameWidth, this.frameHeight,
      Math.floor(x), Math.floor(y),
      this.frameWidth * scale, this.frameHeight * scale
    );
  }
}