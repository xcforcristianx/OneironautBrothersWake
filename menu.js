// menu.js (v3)
// Dark, readable UI (gray buttons, black panels) that stays BELOW the title.
// Screens: Main Menu, Options (Volume + Mute), Help, Credits

class UIScreen {
  constructor(game) {
    this.game = game;
    this.isUI = true;
    this.prevKeys = { ...game.keys };
  }

  pressed(key) {
    const now = !!this.game.keys[key];
    const prev = !!this.prevKeys[key];
    return now && !prev;
  }

  syncKeys() {
    this.prevKeys = { ...this.game.keys };
  }

  pointInRect(p, r) {
    return p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  // Keep UI from overlapping the title/subtitle artwork.
  // If it STILL overlaps on your canvas, increase this (ex: 0.40).
  uiTopSafeY(canvasH) {
    return canvasH * 0.36;
  }

  roundedRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  // Black translucent panel (readable)
  drawDarkPanel(ctx, rect, radius = 28) {
    const { x, y, w, h } = rect;
    ctx.save();

    ctx.globalAlpha = 0.65;
    ctx.fillStyle = "black";
    this.roundedRectPath(ctx, x, y, w, h, radius);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.60)";
    this.roundedRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "white";
    this.roundedRectPath(ctx, x + 6, y + 6, w - 12, h * 0.26, radius);
    ctx.fill();

    ctx.restore();
  }

  // Dark gray pill button + white text
  drawDarkButton(ctx, rect, label, selected) {
    const { x, y, w, h } = rect;
    const r = 40;

    ctx.save();

    // fill
    ctx.globalAlpha = selected ? 0.80 : 0.62;
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    this.roundedRectPath(ctx, x, y, w, h, r);
    ctx.fill();

    // outline
    ctx.globalAlpha = selected ? 0.90 : 0.55;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)";
    this.roundedRectPath(ctx, x, y, w, h, r);
    ctx.stroke();

    // text shadow
    ctx.globalAlpha = 1;
    ctx.font = "46px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.90)";
    ctx.fillText(label, x + w / 2 + 2, y + h / 2 + 2);

    // text
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(label, x + w / 2, y + h / 2);

    ctx.restore();
  }

  drawSmallHint(ctx, text, y) {
    ctx.save();
    ctx.font = "20px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,0.90)";
    ctx.fillText(text, ctx.canvas.width / 2 + 2, y + 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(text, ctx.canvas.width / 2, y);
    ctx.restore();
  }

  drawPanelTitle(ctx, text, y) {
    ctx.save();
    ctx.font = "38px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,0.90)";
    ctx.fillText(text, ctx.canvas.width / 2 + 2, y + 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(text, ctx.canvas.width / 2, y);
    ctx.restore();
  }
}

// ------------------------- MAIN MENU -------------------------
class MainMenu extends UIScreen {
  constructor(game, { onPlay, onOptions, onHelp, onCredits } = {}) {
    super(game);

    this.items = ["Play", "Options", "Help", "Credits"];
    this.selected = 0;

    this.onPlay = onPlay || (() => { });
    this.onOptions = onOptions || (() => { });
    this.onHelp = onHelp || (() => { });
    this.onCredits = onCredits || (() => { });
  }

  buildRects() {
    const canvas = this.game.ctx.canvas;
    const cx = canvas.width / 2;

    this.btnW = 520;
    this.btnH = 78;
    this.gap = 18;

    const totalH = this.items.length * this.btnH + (this.items.length - 1) * this.gap;

    // Push DOWN so it never overlaps the title
    const desiredCenterY = canvas.height * 0.70;
    let top = desiredCenterY - totalH / 2;

    const safeTop = this.uiTopSafeY(canvas.height);
    if (top < safeTop) top = safeTop;

    this.rects = this.items.map((_, i) => ({
      x: cx - this.btnW / 2,
      y: top + i * (this.btnH + this.gap),
      w: this.btnW,
      h: this.btnH
    }));

    this.hintY = top + totalH + 12;
  }

  activate(index) {
    const label = this.items[index];
    if (label === "Play") this.onPlay();
    else if (label === "Options") this.onOptions();
    else if (label === "Help") this.onHelp();
    else if (label === "Credits") this.onCredits();
  }

  update() {
    if (!this.game.ctx) return;
    this.buildRects();

    if (this.game.mouse) {
      for (let i = 0; i < this.rects.length; i++) {
        if (this.pointInRect(this.game.mouse, this.rects[i])) {
          this.selected = i;
          break;
        }
      }
    }

    if (this.pressed("ArrowUp")) this.selected = (this.selected - 1 + this.items.length) % this.items.length;
    if (this.pressed("ArrowDown")) this.selected = (this.selected + 1) % this.items.length;

    if (this.pressed("Enter") || this.pressed(" ")) this.activate(this.selected);

    if (this.game.click) {
      const c = this.game.click;
      for (let i = 0; i < this.rects.length; i++) {
        if (this.pointInRect(c, this.rects[i])) {
          this.activate(i);
          break;
        }
      }
      this.game.click = null;
    }

    this.syncKeys();
  }

  draw(ctx) {
    if (!this.rects) return;

    for (let i = 0; i < this.rects.length; i++) {
      this.drawDarkButton(ctx, this.rects[i], this.items[i], i === this.selected);
    }

    this.drawSmallHint(ctx, "Click / Enter to select", this.hintY);
  }
}

// ------------------------- OPTIONS -------------------------
class OptionsMenu extends UIScreen {
  constructor(game, { onBack } = {}) {
    super(game);
    this.onBack = onBack || (() => { });

    const m = this.game.music;
    this.volume = m ? (m.audio ? m.audio.volume : 0.35) : 0.35;

    this.selected = 0; // 0=volume, 1=mute, 2=back
  }

  clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  applyVolume() {
    this.volume = this.clamp01(this.volume);
    if (this.game.music) this.game.music.setVolume(this.volume);
  }

  buildLayout() {
    const c = this.game.ctx.canvas;
    const cx = c.width / 2;

    const panelW = 780;
    const panelH = 360;

    let panelY = c.height * 0.44;
    panelY = Math.max(panelY, this.uiTopSafeY(c.height));

    this.panel = { x: cx - panelW / 2, y: panelY, w: panelW, h: panelH };

    this.slider = { x: cx - 260, y: this.panel.y + 118, w: 520, h: 16 };
    this.sliderHit = { x: this.slider.x, y: this.slider.y - 18, w: this.slider.w, h: 52 };

    this.muteBtn = { x: cx - 260, y: this.panel.y + 170, w: 520, h: 72 };
    this.backBtn = { x: cx - 260, y: this.panel.y + 252, w: 520, h: 72 };

    // Put hint ABOVE the Back button (prevents overlap)
    this.hintY = this.backBtn.y - 28;
  }

  update() {
    if (!this.game.ctx) return;
    this.buildLayout();

    const m = this.game.mouse;
    if (m) {
      if (this.pointInRect(m, this.sliderHit)) this.selected = 0;
      else if (this.pointInRect(m, this.muteBtn)) this.selected = 1;
      else if (this.pointInRect(m, this.backBtn)) this.selected = 2;
    }

    if (this.pressed("ArrowUp")) this.selected = (this.selected - 1 + 3) % 3;
    if (this.pressed("ArrowDown")) this.selected = (this.selected + 1) % 3;

    if (this.selected === 0) {
      if (this.pressed("ArrowLeft")) { this.volume -= 0.05; this.applyVolume(); }
      if (this.pressed("ArrowRight")) { this.volume += 0.05; this.applyVolume(); }
    }

    if (this.game.click) {
      const c = this.game.click;

      if (this.pointInRect(c, this.sliderHit)) {
        const t = (c.x - this.slider.x) / this.slider.w;
        this.volume = t;
        this.applyVolume();
      } else if (this.pointInRect(c, this.muteBtn)) {
        if (this.game.music) this.game.music.toggleMute();
      } else if (this.pointInRect(c, this.backBtn)) {
        this.onBack();
      }

      this.game.click = null;
    }

    if (this.pressed("Enter") || this.pressed(" ")) {
      if (this.selected === 1) {
        if (this.game.music) this.game.music.toggleMute();
      } else if (this.selected === 2) {
        this.onBack();
      }
    }
    if (this.pressed("Escape")) this.onBack();

    this.syncKeys();
  }

  draw(ctx) {
    if (!this.panel) return;

    this.drawDarkPanel(ctx, this.panel, 30);
    this.drawPanelTitle(ctx, "Options", this.panel.y + 18);

    const pct = Math.round(this.volume * 100);
    ctx.save();
    ctx.font = "24px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(`Volume: ${pct}%`, ctx.canvas.width / 2, this.slider.y - 14);
    ctx.restore();

    // slider
    ctx.save();
    const selected = this.selected === 0;

    ctx.globalAlpha = selected ? 0.95 : 0.75;
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    this.roundedRectPath(ctx, this.slider.x, this.slider.y, this.slider.w, this.slider.h, 10);
    ctx.fill();

    const fillW = Math.max(0, Math.min(this.slider.w, this.slider.w * this.volume));
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    this.roundedRectPath(ctx, this.slider.x, this.slider.y, fillW, this.slider.h, 10);
    ctx.fill();

    const knobX = this.slider.x + fillW;
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    this.roundedRectPath(ctx, knobX - 10, this.slider.y - 12, 20, this.slider.h + 24, 10);
    ctx.fill();
    ctx.restore();

    const muted = !this.game.music || this.game.music.enabled === false;
    this.drawDarkButton(ctx, this.muteBtn, muted ? "Unmute" : "Mute", this.selected === 1);
    this.drawDarkButton(ctx, this.backBtn, "Back", this.selected === 2);

    this.drawSmallHint(ctx, "Esc to go back", this.hintY);
  }
}

// ------------------------- HELP -------------------------
class HelpMenu extends UIScreen {
  constructor(game, { onBack } = {}) {
    super(game);
    this.onBack = onBack || (() => { });
  }

  buildLayout() {
    const c = this.game.ctx.canvas;
    const cx = c.width / 2;

    const panelW = 900;
    const panelH = 430;
    let panelY = c.height * 0.40;
    panelY = Math.max(panelY, this.uiTopSafeY(c.height));

    this.panel = { x: cx - panelW / 2, y: panelY, w: panelW, h: panelH };
    this.backBtn = { x: cx - 220, y: this.panel.y + this.panel.h - 96, w: 440, h: 72 };
  }

  update() {
    if (!this.game.ctx) return;
    this.buildLayout();

    if (this.game.click) {
      const c = this.game.click;
      if (this.pointInRect(c, this.backBtn)) this.onBack();
      this.game.click = null;
    }

    if (this.pressed("Enter") || this.pressed(" ") || this.pressed("Escape")) this.onBack();
    this.syncKeys();
  }

  draw(ctx) {
    if (!this.panel) return;

    this.drawDarkPanel(ctx, this.panel, 30);
    this.drawPanelTitle(ctx, "Help", this.panel.y + 18);

    const lines = [
      "Move: Arrow Keys or A / D",
      "Run: Hold Shift while moving",
      "Jump: Space or W or ↑",,
      "Hurt: H",
      "Mute: M (or use Options)",
      "",
      "Goal: Collect stars and reach the end!"
    ];

    ctx.save();
    ctx.font = "24px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.92)";

    let x = this.panel.x + 60;
    let y = this.panel.y + 86;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * 32);
    }
    ctx.restore();

    this.drawDarkButton(ctx, this.backBtn, "Back", true);
  }
}

// ------------------------- CREDITS -------------------------
class CreditsMenu extends UIScreen {
  constructor(game, { onBack } = {}) {
    super(game);
    this.onBack = onBack || (() => { });
  }

  buildLayout() {
    const c = this.game.ctx.canvas;
    const cx = c.width / 2;

    const panelW = 900;
    const panelH = 430;
    let panelY = c.height * 0.40;
    panelY = Math.max(panelY, this.uiTopSafeY(c.height));

    this.panel = { x: cx - panelW / 2, y: panelY, w: panelW, h: panelH };
    this.backBtn = { x: cx - 220, y: this.panel.y + this.panel.h - 96, w: 440, h: 72 };
  }

  update() {
    if (!this.game.ctx) return;
    this.buildLayout();

    if (this.game.click) {
      const c = this.game.click;
      if (this.pointInRect(c, this.backBtn)) this.onBack();
      this.game.click = null;
    }

    if (this.pressed("Enter") || this.pressed(" ") || this.pressed("Escape")) this.onBack();
    this.syncKeys();
  }

  draw(ctx) {
    if (!this.panel) return;

    this.drawDarkPanel(ctx, this.panel, 30);
    this.drawPanelTitle(ctx, "Credits", this.panel.y + 18);

    const lines = [
      "Mini-game: Oneironaut: Brother's Wake",
      "Created by",
      "Cristian Acevedo-Villasana",
      "Composer and Software Instruments:",
      "Cristian Acevedo-Villasana",
      "SoundTrap",
      "Side Minigame Made from the Oneironaut group project."
    ];

    ctx.save();
    ctx.font = "22px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.92)";

    let x = this.panel.x + 60;
    let y = this.panel.y + 86;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * 30);
    }
    ctx.restore();

    this.drawDarkButton(ctx, this.backBtn, "Back", true);
  }
}

// ------------------------- LEVEL SELECT -------------------------
class LevelSelectMenu extends UIScreen {
  constructor(game, { unlocked, onSelect, onBack } = {}) {
    super(game);
    this.onSelect = onSelect || (() => { });
    this.onBack = onBack || (() => { });
    this.unlocked = unlocked || { "1-1": true, "2-1": false, "3-1": false };

    this.previewByLevel = {
      "1-1": "./assets/background/DayDream.png",
      "2-1": "./assets/background/NightFall.png",
      "3-1": "./assets/background/Lucid.png"
    };

    this.levels = ["1-1", "2-1", "3-1"];
    this.selected = 0;
  }

  buildLayout() {
    const c = this.game.ctx.canvas;
    const cx = c.width / 2;

    // square boxes
    this.boxSize = 170;
    this.gap = 40;

    const totalW = this.levels.length * this.boxSize + (this.levels.length - 1) * this.gap;

    // push below title
    let top = c.height * 0.55;
    top = Math.max(top, this.uiTopSafeY(c.height) + 30);

    const startX = cx - totalW / 2;

    this.boxes = this.levels.map((id, i) => ({
      id,
      x: startX + i * (this.boxSize + this.gap),
      y: top,
      w: this.boxSize,
      h: this.boxSize
    }));

    this.backBtn = { x: cx - 220, y: top + this.boxSize + 70, w: 440, h: 72 };
    this.hintY = this.backBtn.y - 28;
  }

  activate(i) {
    const id = this.levels[i];
    if (this.unlocked[id]) this.onSelect(id);
  }

  drawBox(ctx, b, selected) {
    const unlocked = !!this.unlocked[b.id];

    ctx.save();

    // --- Base panel ---
    ctx.globalAlpha = selected ? 0.85 : 0.65;
    ctx.fillStyle = unlocked ? "rgba(0,0,0,0.90)" : "rgba(60,60,60,0.90)";
    this.roundedRectPath(ctx, b.x, b.y, b.w, b.h, 22);
    ctx.fill();

    // --- Preview image (clipped to rounded rect) ---
    const path = this.previewByLevel?.[b.id];
    const img = path ? ASSET_MANAGER.getAsset(path) : null;

    if (img) {
      ctx.save();
      this.roundedRectPath(ctx, b.x, b.y, b.w, b.h, 22);
      ctx.clip();

      // "cover" fit (fills the square)
      const iw = img.width, ih = img.height;
      const scale = Math.max(b.w / iw, b.h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = b.x + (b.w - dw) / 2;
      const dy = b.y + (b.h - dh) / 2;

      ctx.globalAlpha = unlocked ? 0.95 : 0.55; // locked previews look dimmer
      ctx.drawImage(img, dx, dy, dw, dh);

      // subtle dark gradient to help the text pop
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "black";
      ctx.fillRect(b.x, b.y + b.h * 0.55, b.w, b.h * 0.45);

      ctx.restore();
    }

    // --- Outline ---
    ctx.globalAlpha = selected ? 0.95 : 0.60;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)";
    this.roundedRectPath(ctx, b.x, b.y, b.w, b.h, 22);
    ctx.stroke();

    // --- Label ---
    ctx.globalAlpha = 1;
    ctx.font = "40px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(b.id, b.x + b.w / 2, b.y + b.h / 2 + 45);

    // --- Lock overlay if locked (keeps your lock behavior) ---
    if (!unlocked) {
      ctx.font = "46px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText("🔒", b.x + b.w / 2, b.y + 42);

      ctx.globalAlpha = 0.30;  // extra dim so it clearly looks locked
      ctx.fillStyle = "black";
      this.roundedRectPath(ctx, b.x, b.y, b.w, b.h, 22);
      ctx.fill();
    }

    ctx.restore();
  }

  update() {
    if (!this.game.ctx) return;
    this.buildLayout();

    // mouse hover selects
    if (this.game.mouse) {
      for (let i = 0; i < this.boxes.length; i++) {
        if (this.pointInRect(this.game.mouse, this.boxes[i])) {
          this.selected = i;
          break;
        }
      }
    }

    // keyboard left/right
    if (this.pressed("ArrowLeft")) this.selected = (this.selected - 1 + this.levels.length) % this.levels.length;
    if (this.pressed("ArrowRight")) this.selected = (this.selected + 1) % this.levels.length;

    // Enter selects (only if unlocked)
    if (this.pressed("Enter") || this.pressed(" ")) this.activate(this.selected);

    // click boxes / back
    if (this.game.click) {
      const c = this.game.click;

      for (let i = 0; i < this.boxes.length; i++) {
        if (this.pointInRect(c, this.boxes[i])) {
          this.activate(i);
          this.game.click = null;
          this.syncKeys();
          return;
        }
      }

      if (this.pointInRect(c, this.backBtn)) this.onBack();
      this.game.click = null;
    }

    if (this.pressed("Escape")) this.onBack();

    this.syncKeys();
  }

  draw(ctx) {
    if (!this.boxes) return;

    this.drawSmallHint(ctx, "Select a Level", this.uiTopSafeY(ctx.canvas.height) + 10);

    for (let i = 0; i < this.boxes.length; i++) {
      this.drawBox(ctx, this.boxes[i], i === this.selected);
    }

    this.drawDarkButton(ctx, this.backBtn, "Back", true);
    this.drawSmallHint(ctx, "Click / Enter to select • Esc to go back", this.hintY);
  }
}