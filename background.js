class Background {
  constructor(game, path) {
    this.isBackground = true;   // lets the engine draw it in a special pass
    this.game = game;
    this.img = ASSET_MANAGER.getAsset(path);
  }

  update() {}

  draw(ctx) {
    // draw full screen background (no camera scrolling)
    ctx.drawImage(this.img, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}