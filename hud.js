// hud.js
// In-game HUD: hamburger button (top-left) + pause menu overlay
// + Top-right stats panel: Time, Stars, Score
// Pause menu buttons: Options, Help, Return to Main Menu
// - Uses OptionsMenu + HelpMenu classes from menu.js
// - Freezes gameplay via gameEngine.paused (GameEngine.update skips non-UI entities)

class HUD {
  constructor(game) {
    this.isUI = true;
    this.game = game;

    // ---- LEVEL RULES / HUD ----
    this.levelTimeLimit =
      (typeof this.game.levelTimeLimit === "number") ? this.game.levelTimeLimit : 60;

    this.timeLeft = this.levelTimeLimit;

    // ---- LOW TIME WARNING (30s) ----
    this.timeWarnAt = 30;        // seconds left to start warning
    this.prevTimeLeft = this.timeLeft;

    // ---- SCORE POP (every +1000) ----
    this.prevScore = this.game.score ?? 0;

    // one-shot pop when score crosses a +1000 boundary
    this.scorePulseT = 999;
    this.scorePulseDur = 0.45;
    this.scorePulseAmp = 0.60;

    // green highlight lasts 3 seconds after the pop
    this.scoreGreenT = 0;
    this.scoreGreenDur = 3.0;

    // one-shot pulse when crossing 30s
    this.timePulseT = 999;       // timer for pulse anim (inactive when large)
    this.timePulseDur = 0.30;    // seconds
    this.timePulseAmp = 0.80;    // scale amount (0.60 = up to 1.60x)

    // ---- HP ----
    this.maxHP = (typeof this.game.maxHP === "number") ? this.game.maxHP : 3;
    this.game.maxHP = this.maxHP;

    if (this.game.hp == null) this.game.hp = this.maxHP;
    this.hp = this.game.hp;

    // HP animations + floating popups
    this.prevHp = this.hp;
    this.hpPulses = []; // { idx, t, dur }  (heal pulse)
    this.hpBreaks = []; // { idx, t, dur }  (damage break)
    if (!Array.isArray(this.game.uiPopups)) this.game.uiPopups = [];

    // score goal to pass (change per level later)
    this.scoreGoal = 1900;

    // initialize shared game vars if missing
    if (this.game.starsCollected == null) this.game.starsCollected = 0;
    if (this.game.starsTotal == null) this.game.starsTotal = 0;
    if (this.game.score == null) this.game.score = 0;
    if (this.game.hp == null) this.game.hp = this.maxHP;

    // Hamburger (top-left)
    this.menuBtn = { x: 16, y: 16, w: 44, h: 44 };

    // pause menu state
    this.menuOpen = false;

    // pause menu buttons
    this.optionsBtn = { x: 0, y: 0, w: 0, h: 0 };
    this.helpBtn = { x: 0, y: 0, w: 0, h: 0 };
    this.mainMenuBtn = { x: 0, y: 0, w: 0, h: 0 };

    // ---- WIN overlay ----
    this.winOpen = false;
    this.nextLevelById = { "1-1": "2-1", "2-1": "3-1" };
    this.winSubtitle = "";
    this.winSubtitleColor = "rgba(255,255,255,0.85)";
    this.winBtnLevelSelect = { x: 0, y: 0, w: 0, h: 0 };
    this.winBtnReplay = { x: 0, y: 0, w: 0, h: 0 };

    // ---- DEATH overlay ----
    this.deathOpen = false;
    this.deathReason = ""; // "hp" or "time"
    this.deathBtnReplay = { x: 0, y: 0, w: 0, h: 0 };
    this.deathBtnLevelSelect = { x: 0, y: 0, w: 0, h: 0 };
    this.deathBtnMainMenu = { x: 0, y: 0, w: 0, h: 0 };
    // ---- DEATH fade-in ----
    this.deathFade = 0;          // 0..1
    this.deathFadeDuration = 0.6; // seconds

    // overlays (entities) we may add
    this.optionsOverlay = null;
    this.helpOverlay = null;

    // key edge tracking (so Escape doesn't toggle repeatedly)
    this.prevKeys = { ...game.keys };

    // ---- HUD stats ----
    this.elapsed = 0; // seconds (paused time does NOT count)

    // defaults (so HUD doesn't crash if you haven't wired these yet)
    if (this.game.starsCollected == null) this.game.starsCollected = 0;
    if (this.game.starsTotal == null) this.game.starsTotal = 0;
    if (this.game.score == null) this.game.score = 0;
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

  formatTime(seconds) {
    const s = Math.ceil(seconds);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
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

  drawButton(ctx, rect, text) {
    const { x, y, w, h } = rect;
    const base = ctx.globalAlpha ?? 1;

    ctx.save();

    ctx.globalAlpha = base * 0.80;
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    this.roundedRectPath(ctx, x, y, w, h, 36);
    ctx.fill();

    ctx.globalAlpha = base * 0.70;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    this.roundedRectPath(ctx, x, y, w, h, 36);
    ctx.stroke();

    ctx.globalAlpha = base * 1.0;
    ctx.font = "34px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.90)";
    ctx.fillText(text, x + w / 2 + 2, y + h / 2 + 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(text, x + w / 2, y + h / 2);

    ctx.restore();
  }

  openPauseMenu() {
    this.menuOpen = true;
    this.game.paused = true;
  }

  closePauseMenu() {
    this.menuOpen = false;
    // only unpause if no overlays are open
    if (!this.optionsOverlay && !this.helpOverlay) {
      this.game.paused = false;
    }
  }

  openOptionsOverlay() {
    if (this.optionsOverlay) return;

    this.game.paused = true;

    this.optionsOverlay = new OptionsMenu(this.game, {
      onBack: () => {
        this.optionsOverlay.removeFromWorld = true;
        this.optionsOverlay = null;

        // return to pause menu
        this.menuOpen = true;
        this.game.paused = true;
      }
    });

    this.optionsOverlay.isUI = true;
    this.game.addEntity(this.optionsOverlay);
  }

  openHelpOverlay() {
    if (this.helpOverlay) return;

    this.game.paused = true;

    this.helpOverlay = new HelpMenu(this.game, {
      onBack: () => {
        this.helpOverlay.removeFromWorld = true;
        this.helpOverlay = null;

        // return to pause menu
        this.menuOpen = true;
        this.game.paused = true;
      }
    });

    this.helpOverlay.isUI = true;
    this.game.addEntity(this.helpOverlay);
  }

  update() {
    if (this.game.scene !== "GAME") {
      this.syncKeys();
      return;
    }

    // ---- countdown timer (pause-safe) ----
    if (!this.game.paused) {
      this.timeLeft -= this.game.clockTick;
      if (this.timeLeft < 0) this.timeLeft = 0;
    }

    // ---- SCORE: pop + green for 3s whenever score crosses +1000 ----
    const curScore = this.game.score ?? 0;
    const prevBucket = Math.floor((this.prevScore ?? 0) / 1000);
    const curBucket = Math.floor(curScore / 1000);

    if (curBucket > prevBucket) {
      this.scorePulseT = 0;
      this.scoreGreenT = this.scoreGreenDur;
    }
    this.prevScore = curScore;

    // advance score timers
    {
      const dt = this.game.clockTick;
      if (this.scorePulseT < this.scorePulseDur) this.scorePulseT += dt;
      if (this.scoreGreenT > 0) this.scoreGreenT = Math.max(0, this.scoreGreenT - dt);
    }

    // ---- 30s warning: pulse once when crossing to <= 30 ----
    if (this.prevTimeLeft > this.timeWarnAt && this.timeLeft <= this.timeWarnAt) {
      this.timePulseT = 0;
    }
    this.prevTimeLeft = this.timeLeft;

    if (this.timePulseT < this.timePulseDur) {
      this.timePulseT += this.game.clockTick;
    }

    // keep local hp synced with game hp
    const newHp = (typeof this.game.hp === "number") ? this.game.hp : this.hp;

    // detect hp changes to drive HUD animations
    if (newHp !== this.prevHp) {
      if (newHp > this.prevHp) {
        for (let i = this.prevHp; i < newHp; i++) {
          this.hpPulses.push({ idx: i, t: 0, dur: 0.30 });
        }
      } else {
        for (let i = newHp; i < this.prevHp; i++) {
          this.hpBreaks.push({ idx: i, t: 0, dur: 0.38 });
        }
      }
      this.prevHp = newHp;
    }
    this.hp = newHp;

    // advance hp animations + popups (only while gameplay is running)
    if (!this.game.paused) {
      const dt = this.game.clockTick;

      for (const a of this.hpPulses) a.t += dt;
      this.hpPulses = this.hpPulses.filter(a => a.t < a.dur);

      for (const b of this.hpBreaks) b.t += dt;
      this.hpBreaks = this.hpBreaks.filter(b => b.t < b.dur);

      if (!Array.isArray(this.game.uiPopups)) this.game.uiPopups = [];
      for (const p of this.game.uiPopups) p.t = (p.t ?? 0) + dt;
      this.game.uiPopups = this.game.uiPopups.filter(p => (p.t ?? 0) < (p.dur ?? 0.75));
    }

    // ---- lose condition -> open DEATH overlay ----
    if (!this.game.paused && !this.winOpen && !this.deathOpen) {
      if (this.game.fellOff) {
        this.deathOpen = true;
        this.deathReason = "fall";
        this.deathFade = 0;
        this.game.paused = true;
        this.menuOpen = false;
        this.game.fellOff = false;
      } else if (this.hp <= 0) {
        this.deathOpen = true;
        this.deathReason = "hp";
        this.deathFade = 0;
        this.game.paused = true;
        this.menuOpen = false;
      } else if (this.timeLeft <= 0) {
        this.deathOpen = true;
        this.deathReason = "time";
        this.deathFade = 0;
        this.game.paused = true;
        this.menuOpen = false;
      }
    }

    // ---- WIN condition: collect all stars ----
    if (!this.game.paused && !this.winOpen && !this.deathOpen) {
      const total = this.game.starsTotal ?? 0;
      const got = this.game.starsCollected ?? 0;

      if (total > 0 && got >= total) {
        this.winOpen = true;
        this.game.paused = true;
        this.menuOpen = false;

        // unlock next level
        if (typeof this.game.onLevelComplete === "function") {
          this.game.onLevelComplete(this.game.currentLevelId);
        }

        // subtitle message
        const id = this.game.currentLevelId;
        const next = this.nextLevelById?.[id];

        if (id === "3-1") {
          this.winSubtitle = "Congratulations! You have completed the LucidJourney!\nThank you for playing!";
          this.winSubtitleColor = "rgba(255,220,140,0.95)";
        } else if (next) {
          this.winSubtitle = `A new level is unlocked! (${next})`;
          this.winSubtitleColor = "rgba(90,255,120,0.95)";
        } else {
          this.winSubtitle = "";
          this.winSubtitleColor = "rgba(255,255,255,0.85)";
        }
      }
    }

    // ---- animate death fade-in ----
    if (this.deathOpen) {
      const step = this.game.clockTick / this.deathFadeDuration;
      this.deathFade = Math.min(1, this.deathFade + step);
    }

    // ESC toggles pause menu
    if (!this.optionsOverlay && !this.helpOverlay && !this.winOpen && !this.deathOpen && this.pressed("Escape")) {
      if (this.menuOpen) this.closePauseMenu();
      else this.openPauseMenu();
    }

    // layout pause + win + death buttons
    const c = this.game.ctx.canvas;
    const cx = c.width / 2;
    const cy = c.height / 2;

    const bw = 520;
    const bh = 76;

    // pause menu buttons
    this.optionsBtn = { x: cx - bw / 2, y: cy - 90, w: bw, h: bh };
    this.helpBtn = { x: cx - bw / 2, y: cy, w: bw, h: bh };
    this.mainMenuBtn = { x: cx - bw / 2, y: cy + 90, w: bw, h: bh };

    // win overlay buttons
    this.winBtnReplay = { x: cx - 220, y: cy + 5, w: 440, h: 72 };
    this.winBtnLevelSelect = { x: cx - 220, y: cy + 90, w: 440, h: 72 };

    // death overlay buttons (match draw panel: 760x500)
    const deathPanelW = 760;
    const deathPanelH = 500;
    const deathPanelX = cx - deathPanelW / 2;
    const deathPanelY = cy - deathPanelH / 2;

    const btnPadX = 90;
    const btnW = deathPanelW - btnPadX * 2;
    const btnH = 72;
    const btnGap = 18;

    const firstBtnY = deathPanelY + 190;

    this.deathBtnReplay = { x: deathPanelX + btnPadX, y: firstBtnY, w: btnW, h: btnH };
    this.deathBtnLevelSelect = { x: deathPanelX + btnPadX, y: firstBtnY + btnH + btnGap, w: btnW, h: btnH };
    this.deathBtnMainMenu = { x: deathPanelX + btnPadX, y: firstBtnY + (btnH + btnGap) * 2, w: btnW, h: btnH };

    // ---- DEATH overlay clicks ----
    if (this.deathOpen && this.game.click) {
      const click = this.game.click;

      if (this.pointInRect(click, this.deathBtnReplay)) {
        this.deathOpen = false;
        this.game.paused = false;
        if (typeof this.game.restartLevel === "function") this.game.restartLevel();
        this.game.click = null;
        this.syncKeys();
        return;
      }

      if (this.pointInRect(click, this.deathBtnLevelSelect)) {
        this.deathOpen = false;
        this.game.paused = false;
        if (typeof this.game.goToLevelSelect === "function") this.game.goToLevelSelect();
        else if (typeof this.game.goToMenu === "function") this.game.goToMenu();
        this.game.click = null;
        this.syncKeys();
        return;
      }

      if (this.pointInRect(click, this.deathBtnMainMenu)) {
        this.deathOpen = false;
        this.game.paused = false;
        if (typeof this.game.goToMenu === "function") this.game.goToMenu();
        this.game.click = null;
        this.syncKeys();
        return;
      }

      this.game.click = null;
      this.syncKeys();
      return;
    }

    // ---- WIN overlay clicks ----
    if (this.winOpen && this.game.click) {
      const click = this.game.click;

      if (this.pointInRect(click, this.winBtnReplay)) {
        this.winOpen = false;
        this.game.paused = false;
        if (typeof this.game.restartLevel === "function") this.game.restartLevel();
        this.game.click = null;
        this.syncKeys();
        return;
      }

      if (this.pointInRect(click, this.winBtnLevelSelect)) {
        this.winOpen = false;
        this.game.paused = false;
        if (typeof this.game.goToLevelSelect === "function") this.game.goToLevelSelect();
        else if (typeof this.game.goToMenu === "function") this.game.goToMenu();
        this.game.click = null;
        this.syncKeys();
        return;
      }

      this.game.click = null;
      this.syncKeys();
      return;
    }

    // ---- normal clicks (hamburger / pause menu) ----
    if (this.game.click) {
      const click = this.game.click;

      if (this.pointInRect(click, this.menuBtn) && !this.optionsOverlay && !this.helpOverlay && !this.winOpen && !this.deathOpen) {
        if (this.menuOpen) this.closePauseMenu();
        else this.openPauseMenu();

        this.game.click = null;
        this.syncKeys();
        return;
      }

      if (this.menuOpen && !this.optionsOverlay && !this.helpOverlay) {
        if (this.pointInRect(click, this.optionsBtn)) {
          this.menuOpen = false;
          this.openOptionsOverlay();
          this.game.click = null;
          this.syncKeys();
          return;
        }

        if (this.pointInRect(click, this.helpBtn)) {
          this.menuOpen = false;
          this.openHelpOverlay();
          this.game.click = null;
          this.syncKeys();
          return;
        }

        if (this.pointInRect(click, this.mainMenuBtn)) {
          this.menuOpen = false;
          this.game.paused = false;
          if (typeof this.game.goToMenu === "function") this.game.goToMenu();
          this.game.click = null;
          this.syncKeys();
          return;
        }
      }
    }

    this.syncKeys();
  }

  draw(ctx) {
    if (this.game.scene !== "GAME") return;

    // ---------------- HAMBURGER ICON ----------------
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "black";
    ctx.fillRect(this.menuBtn.x, this.menuBtn.y, this.menuBtn.w, this.menuBtn.h);

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(this.menuBtn.x, this.menuBtn.y, this.menuBtn.w, this.menuBtn.h);

    ctx.fillStyle = "white";
    ctx.font = "28px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("≡", this.menuBtn.x + this.menuBtn.w / 2, this.menuBtn.y + this.menuBtn.h / 2 + 1);
    ctx.restore();

    // ---------------- TOP HUD (left / center / right) ----------------
    const timeValue = this.formatTime(this.timeLeft);
    const starsText = `${this.game.starsCollected}/${this.game.starsTotal}`;
    const scoreValue = this.game.score ?? 0;

    const y = 18;
    const h = 44;
    const pad = 12;

    const hpBox = { x: this.menuBtn.x + this.menuBtn.w + 12, y, w: 120, h };
    const timeBox = { x: ctx.canvas.width / 2 - 90, y, w: 130, h };
    const rightBox = { x: ctx.canvas.width - 330 - 18, y, w: 330, h };

    const drawBox = (r) => {
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = "black";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    };

    drawBox(hpBox);
    drawBox(timeBox);
    drawBox(rightBox);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "white";
    ctx.font = "18px system-ui";
    ctx.textBaseline = "middle";

    // HP label
    ctx.textAlign = "left";
    ctx.fillText("HP:", hpBox.x + pad, hpBox.y + hpBox.h / 2);

    // animated hearts
    const heartY = hpBox.y + hpBox.h / 2;
    let hx = hpBox.x + pad + 46;
    const stepX = 20;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "22px system-ui";

    const pulseScaleFor = (idx) => {
      let s = 1;
      for (const a of this.hpPulses) {
        if (a.idx !== idx) continue;
        const t = Math.min(1, a.t / a.dur);
        const p = 1 - t;
        s = Math.max(s, 1 + (p * p) * 0.85);
      }
      return s;
    };

    const breakFor = (idx) => {
      for (const b of this.hpBreaks) if (b.idx === idx) return b;
      return null;
    };

    for (let i = 0; i < this.maxHP; i++) {
      const filled = i < this.hp;
      const s = filled ? pulseScaleFor(i) : 1;

      // base heart
      ctx.save();
      ctx.translate(hx, heartY);
      ctx.scale(s, s);
      ctx.fillStyle = filled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)";
      ctx.fillText("♥", 0, 0);
      ctx.restore();

      // break overlay
      const br = breakFor(i);
      if (br) {
        const t = Math.min(1, br.t / br.dur);
        const alpha = 1 - t;
        const bs = 1 + t * 0.45;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(hx, heartY);
        ctx.scale(bs, bs);
        ctx.fillStyle = "rgba(255,120,120,1)";
        ctx.fillText("💔", 0, 0);
        ctx.restore();
      }

      hx += stepX;
    }

    // TIME centered (label + big number + pulse + red at <= 30s)
    {
      const timeCx = timeBox.x + timeBox.w / 2;
      const timeCy = timeBox.y + timeBox.h / 2;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = "12px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("Time", timeCx, timeCy - 10);

      let timeScale = 1;
      if (this.timePulseT < this.timePulseDur) {
        const u = Math.min(1, this.timePulseT / this.timePulseDur);
        const bump = Math.sin(Math.PI * u);
        timeScale = 1 + bump * this.timePulseAmp;
      }

      const danger = this.timeLeft <= this.timeWarnAt;
      const timeColor = danger ? "rgba(255,80,80,0.95)" : "rgba(255,255,255,0.95)";

      ctx.translate(timeCx, timeCy + 8);
      ctx.scale(timeScale, timeScale);

      ctx.font = "22px system-ui";
      ctx.fillStyle = "rgba(0,0,0,0.90)";
      ctx.fillText(timeValue, 1, 1);
      ctx.fillStyle = timeColor;
      ctx.fillText(timeValue, 0, 0);

      ctx.restore();
    }

    // RIGHT: star icon + count
    ctx.textAlign = "left";
    const starSize = 22;
    const starX = rightBox.x + pad;
    const starY = rightBox.y + (rightBox.h - starSize) / 2;

    const starImg = (typeof ASSET_MANAGER !== "undefined")
      ? ASSET_MANAGER.getAsset("./assets/items/Star.png")
      : null;

    if (starImg) {
      ctx.drawImage(starImg, starX, starY, starSize, starSize);
    } else {
      ctx.font = "22px system-ui";
      ctx.fillText("★", starX, rightBox.y + rightBox.h / 2);
      ctx.font = "18px system-ui";
    }

    ctx.fillStyle = "white";
    ctx.fillText(starsText, starX + starSize + 8, rightBox.y + rightBox.h / 2);

    // SCORE (right side): label + big number + pulse + green for 3 seconds
    {
      const scoreX = rightBox.x + rightBox.w - pad;
      const scoreY = rightBox.y + rightBox.h / 2;

      ctx.save();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      ctx.font = "12px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("Score", scoreX, scoreY - 10);

      let scoreScale = 1;
      if (this.scorePulseT < this.scorePulseDur) {
        const u = Math.min(1, this.scorePulseT / this.scorePulseDur);
        const bump = Math.sin(Math.PI * u);
        scoreScale = 1 + bump * this.scorePulseAmp;
      }

      const scoreColor =
        (this.scoreGreenT > 0)
          ? "rgba(90,255,120,0.95)"
          : "rgba(255,255,255,0.95)";

      ctx.translate(scoreX, scoreY + 8);
      ctx.scale(scoreScale, scoreScale);

      ctx.font = "22px system-ui";
      ctx.fillStyle = "rgba(0,0,0,0.90)";
      ctx.fillText(String(scoreValue), 1, 1);

      ctx.fillStyle = scoreColor;
      ctx.fillText(String(scoreValue), 0, 0);

      ctx.restore();
    }

    ctx.restore(); // end TOP HUD save

    // ---------------- Floating pickup popups ----------------
    if (Array.isArray(this.game.uiPopups) && this.game.uiPopups.length) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "26px system-ui";

      const cam = this.game.cameraX ?? 0;

      for (const p of this.game.uiPopups) {
        const t = Math.min(1, (p.t ?? 0) / (p.dur ?? 0.75));
        const alpha = 1 - t;
        const rise = p.rise ?? 55;

        const sx = (p.x ?? 0) - cam;
        const sy = (p.y ?? 0) - rise * t;

        if (sx < -150 || sx > ctx.canvas.width + 150) continue;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillText(p.text ?? "", sx + 2, sy + 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillText(p.text ?? "", sx, sy);
      }

      ctx.restore();
    }

    // ---------------- WIN OVERLAY ----------------
    if (this.winOpen) {
      ctx.save();
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();

      const panel = {
        x: ctx.canvas.width / 2 - 360,
        y: ctx.canvas.height / 2 - 180,
        w: 720,
        h: 360
      };

      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "black";
      this.roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 30);
      ctx.fill();

      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      this.roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 30);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = "44px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText("Level Complete!", ctx.canvas.width / 2, panel.y + 22);
      ctx.restore();

      ctx.save();
      ctx.font = "22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(
        `Stars: ${this.game.starsCollected}/${this.game.starsTotal}   Score: ${this.game.score}`,
        ctx.canvas.width / 2,
        panel.y + 82
      );
      ctx.restore();

      // ✅ subtitle message (unlock / final) — supports multiple lines
      if (this.winSubtitle) {
        ctx.save();
        ctx.font = "20px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const lines = String(this.winSubtitle).split("\n");
        const subY = panel.y + 118;
        const lineHeight = 28;

        for (let i = 0; i < lines.length; i++) {
          const lineY = subY + i * lineHeight;

          ctx.fillStyle = "rgba(0,0,0,0.90)";
          ctx.fillText(lines[i], ctx.canvas.width / 2 + 2, lineY + 2);

          ctx.fillStyle = this.winSubtitleColor || "rgba(255,255,255,0.85)";
          ctx.fillText(lines[i], ctx.canvas.width / 2, lineY);
        }

        ctx.restore();
      }

      this.drawButton(ctx, this.winBtnReplay, "Replay");
      this.drawButton(ctx, this.winBtnLevelSelect, "Level Select");
      return;
    }

    // ---------------- DEATH OVERLAY (FADE-IN) ----------------
    if (this.deathOpen) {
      const f = Math.max(0, Math.min(1, this.deathFade ?? 1));

      ctx.save();
      ctx.globalAlpha = 0.35 * f;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();

      const panel = {
        x: ctx.canvas.width / 2 - 380,
        y: ctx.canvas.height / 2 - 250,
        w: 760,
        h: 500
      };

      ctx.save();
      ctx.globalAlpha = 0.78 * f;
      ctx.fillStyle = "black";
      this.roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 30);
      ctx.fill();

      ctx.globalAlpha = 0.65 * f;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      this.roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 30);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = f;
      ctx.font = "52px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillText("You Drifted Away…", ctx.canvas.width / 2, panel.y + 24);
      ctx.restore();

      const msg =
        (this.deathReason === "time")
          ? "The dream faded before you could reach the stars."
          : (this.deathReason === "fall")
            ? "You fell beyond the edge of the dream."
            : "Nightmares pulled you under.";

      ctx.save();
      ctx.globalAlpha = f;
      ctx.font = "22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(msg, ctx.canvas.width / 2, panel.y + 92);
      ctx.fillText(
        `Stars: ${this.game.starsCollected}/${this.game.starsTotal}   Score: ${this.game.score}`,
        ctx.canvas.width / 2,
        panel.y + 130
      );
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = f;
      this.drawButton(ctx, this.deathBtnReplay, "Try Again");
      this.drawButton(ctx, this.deathBtnLevelSelect, "Level Select");
      this.drawButton(ctx, this.deathBtnMainMenu, "Main Menu");
      ctx.restore();

      return;
    }

    // ---------------- PAUSE MENU OVERLAY ----------------
    if (this.menuOpen && !this.optionsOverlay && !this.helpOverlay) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();

      const panel = {
        x: ctx.canvas.width / 2 - 360,
        y: ctx.canvas.height / 2 - 170,
        w: 720,
        h: 360
      };

      ctx.save();
      ctx.globalAlpha = 0.70;
      ctx.fillStyle = "black";
      this.roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 30);
      ctx.fill();

      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      this.roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 30);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = "40px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText("Menu", ctx.canvas.width / 2, panel.y + 18);
      ctx.restore();

      this.drawButton(ctx, this.optionsBtn, "Options");
      this.drawButton(ctx, this.helpBtn, "Help");
      this.drawButton(ctx, this.mainMenuBtn, "Return to Main Menu");
    }
  }
}