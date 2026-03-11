class Ghost3 {
  constructor(game, x, y, opts = {}) {
    this.game = game;

    this.sheet = ASSET_MANAGER.getAsset("./assets/entities/ghost3.png");
    this.cell = 128;

    // -------------------- Animations (by row) --------------------
    // ghost3.png is a 10x10 grid of 128x128.
    // Row 0: IDLE (6 frames)
    // Row 2: RUN  (7 frames)
    // Row 7: JUMP (3 frames)  (your sheet uses row 7 here)
    // Row 4: ATTACK (4 frames)
    // Row 9: DEATH (6 frames)

    this.animIdle = new Animator(this.sheet, 0, 0 * this.cell, this.cell, this.cell, 6, 0.12, true);
    this.animRun = new Animator(this.sheet, 0, 2 * this.cell, this.cell, this.cell, 7, 0.07, true);
    this.animJump = new Animator(this.sheet, 0, 7 * this.cell, this.cell, this.cell, 3, 0.08, true);
    this.animAttack = new Animator(this.sheet, 0, 4 * this.cell, this.cell, this.cell, 4, 0.09, false);
    this.animDeath = new Animator(this.sheet, 0, 9 * this.cell, this.cell, this.cell, 6, 0.08, false);

    this.state = "RUN"; // IDLE | RUN | JUMP | ATTACK | DEATH

    // ---- SLEEP / WAKE ----
    this.asleep = !!opts.startAsleep;
    this.wakeRange = opts.wakeRange ?? 0;
    this.wakeYMin = opts.wakeYMin;
    this.wakeYMax = opts.wakeYMax;

    // -------------------- Tuning (hardest) --------------------
    this.scale = opts.scale ?? 2.0;

    // ✅ visual-only offsets (DO NOT affect collisions)
    this.drawOffsetX = opts.drawOffsetX ?? 0;
    // Slight lift by default so feet don't sink into terrain. Tweak: -4..-10 * scale.
    this.drawOffsetY = opts.drawOffsetY ?? -Math.round(-5 * this.scale);

    this.patrolMinX = opts.patrolMinX ?? (x - 260);
    this.patrolMaxX = opts.patrolMaxX ?? (x + 260);

    // Faster than Ghost2
    this.patrolSpeed = opts.patrolSpeed ?? 190;
    this.chaseSpeed = opts.chaseSpeed ?? 290;

    this.chaseRange = opts.chaseRange ?? 650;
    this.stopChaseRange = opts.stopChaseRange ?? 850;

    // Attack
    this.attackRange = opts.attackRange ?? 120;
    this.attackHitFrame = opts.attackHitFrame ?? 2;
    this.hitCooldown = 0;
    this.hitCooldownTime = opts.hitCooldownTime ?? 0.45;

    // Jumping
    this.jumpVelocity = opts.jumpVelocity ?? -920;
    this.jumpCooldown = 0;
    this.jumpCooldownTime = opts.jumpCooldownTime ?? 0.85;

    // how much higher the player must be to trigger a "jump up"
    this.jumpUpThreshold = opts.jumpUpThreshold ?? (55 * this.scale);

    // Keep this FALSE so it actually lands on platforms
    this.phaseOnChase = (opts.phaseOnChase ?? false);

    // Little idle pause at endpoints
    this.idlePauseTime = opts.idlePauseTime ?? 0.20;
    this.idleTimer = 0;

    // -------------------- Physics --------------------
    this.x = x;
    this.y = y;

    this.vx = 0;
    this.vy = 0;
    this.dir = 1;

    this.gravity = 2400;
    this.maxFall = 1500;
    this.onGround = false;

    // Attack state
    this.attacking = false;
    this.attackDidHit = false;

    // Death state
    this.dying = false;

    this.removeFromWorld = false;

    this.fallBonus = opts.fallBonus ?? 500;
    this._fallAwarded = false;

    this._lastPopupX = x;
    this._lastPopupY = y;
  }

  // -------------------- Helpers --------------------
  rectsOverlap(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  animIsDone(anim) {
    return !anim.loop && anim.elapsedTime >= anim.totalTime - 0.00001;
  }

  setState(next) {
    if (this.state === next) return;
    this.state = next;

    if (next === "IDLE") this.animIdle.reset();
    if (next === "RUN") this.animRun.reset();
    if (next === "JUMP") this.animJump.reset();
    if (next === "ATTACK") this.animAttack.reset();
    if (next === "DEATH") this.animDeath.reset();
  }

  currentAnim() {
    switch (this.state) {
      case "DEATH": return this.animDeath;
      case "ATTACK": return this.animAttack;
      case "JUMP": return this.animJump;
      case "IDLE": return this.animIdle;
      case "RUN":
      default: return this.animRun;
    }
  }

  getHitbox() {
    const drawW = this.cell * this.scale;
    const drawH = this.cell * this.scale;

    const w = 58 * this.scale;
    const h = 88 * this.scale;

    return {
      x: this.x + (drawW - w) / 2,
      y: this.y + (drawH - h),
      w,
      h
    };
  }

  getAttackBox() {
    const hb = this.getHitbox();
    const extraW = 70 * this.scale;
    const extraH = 22 * this.scale;

    if (this.dir === 1) {
      return { x: hb.x, y: hb.y - extraH * 0.25, w: hb.w + extraW, h: hb.h + extraH };
    } else {
      return { x: hb.x - extraW, y: hb.y - extraH * 0.25, w: hb.w + extraW, h: hb.h + extraH };
    }
  }

  // “Wall ahead” probe
  isWallAhead() {
    const plats = this.game.level?.platforms ?? [];
    const hb = this.getHitbox();

    const probeW = 8 * this.scale;
    const probeH = hb.h * 0.65;
    const px = (this.dir === 1) ? (hb.x + hb.w) : (hb.x - probeW);
    const py = hb.y + hb.h * 0.20;

    const probe = { x: px, y: py, w: probeW, h: probeH };

    for (const p of plats) {
      const s = p.scale ?? 1;
      const pb = { x: p.x, y: p.y, w: p.w * s, h: p.h * s };
      if (this.rectsOverlap(probe, pb)) return true;
    }
    return false;
  }

  // “Support ahead” check (detect ledges/gaps)
  hasSupportAt(px, py) {
    const plats = this.game.level?.platforms ?? [];
    for (const p of plats) {
      const s = p.scale ?? 1;
      const left = p.x;
      const right = p.x + p.w * s;
      const top = p.y;
      const bot = p.y + p.h * s;

      if (px >= left && px <= right && py >= top && py <= bot) return true;
    }
    return false;
  }

  resolveCollisions(axis) {
    const plats = this.game.level?.platforms ?? [];
    for (const p of plats) {
      const s = p.scale ?? 1;
      const pb = { x: p.x, y: p.y, w: p.w * s, h: p.h * s };

      const hb = this.getHitbox();
      if (!this.rectsOverlap(hb, pb)) continue;

      if (axis === "x") {
        const overlapY = Math.min(hb.y + hb.h, pb.y + pb.h) - Math.max(hb.y, pb.y);
        if (overlapY < 6) continue;

        if (this.vx > 0) {
          const overlap = (hb.x + hb.w) - pb.x;
          this.x -= overlap;
        } else if (this.vx < 0) {
          const overlap = (pb.x + pb.w) - hb.x;
          this.x += overlap;
        }
        this.vx = 0;
      } else {
        if (this.vy > 0) {
          const overlap = (hb.y + hb.h) - pb.y;
          this.y -= overlap;
          this.vy = 0;
          this.onGround = true;
        } else if (this.vy < 0) {
          const overlap = (pb.y + pb.h) - hb.y;
          this.y += overlap;
          this.vy = 0;
        }
      }
    }
  }

  stompedBy(heroHb) {
    const hb = this.getHitbox();
    const hero = this.game.player;
    if (!hero || hero.vy <= 0) return false;

    const heroBottom = heroHb.y + heroHb.h;
    const ghostTop = hb.y;

    const mustBeAbove = heroBottom <= ghostTop + (10 * this.scale);
    const stompWindow = heroBottom >= ghostTop - (8 * this.scale);

    return mustBeAbove && stompWindow;
  }

  killByStomp() {
    if (this.dying) return;

    this.dying = true;
    this.vx = 0;
    this.vy = 0;
    this.attacking = false;
    this.attackDidHit = false;

    this.game.score = (this.game.score ?? 0) + 250;
    this.setState("DEATH");
  }

  hurtHero() {
    const hero = this.game.player;
    if (!hero) return;

    if (typeof this.game.hp === "number") {
      this.game.hp = Math.max(0, this.game.hp - 1);
    }

    hero.hurtTimer = hero.hurtDuration ?? 0.35;
    if (hero.hurt?.reset) hero.hurt.reset();
    hero.state = "HURT";

    hero.invulnTimer = hero.invulnDuration ?? 3.0;

    hero.vx = 360 * (hero.x < this.x ? -1 : 1);
    hero.vy = -300;
  }

  doJump() {
    this.vy = this.jumpVelocity;
    this.onGround = false;
    this.jumpCooldown = this.jumpCooldownTime;
    this.setState("JUMP");
  }

  _applyGravityAndCollide(dt) {
    this.vy += this.gravity * dt;
    if (this.vy > this.maxFall) this.vy = this.maxFall;

    this.y += this.vy * dt;
    this.onGround = false;
    this.resolveCollisions("y");
  }

  // -------------------- Update --------------------
  update() {
    const dt = this.game.clockTick;

    // Death playback (advance in update, draw uses tick=0)
    if (this.dying) {
      this.animDeath.elapsedTime += dt;
      if (this.animIsDone(this.animDeath)) this.removeFromWorld = true;
      return;
    }



    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    const hero = this.game.player;
    if (!hero) {
      this._patrol(dt);
      return;
    }

    // ---- FALL BONUS + POPUP (when ghost leaves the screen) ----
    const canvas = this.game.ctx?.canvas;
    const canvasW = canvas?.width ?? 1024;
    const canvasH = canvas?.height ?? 724;

    const cam = this.game.cameraX ?? 0;
    const hbNow = this.getHitbox();

    // ✅ only update lastPopup position while the ghost is actually on-screen
    const centerX = hbNow.x + hbNow.w / 2;
    const centerY = hbNow.y + hbNow.h / 2;

    const sx = centerX - cam; // HUD converts world->screen by subtracting cameraX
    const onScreen =
      sx >= -50 && sx <= canvasW + 50 &&
      centerY >= -50 && centerY <= canvasH + 50;

    if (onScreen) {
      this._lastPopupX = centerX;
      this._lastPopupY = centerY;
    }

    // ✅ trigger as soon as it falls below the screen (not 300px later)
    const fellOffScreenY = canvasH + 60;

    if (!this._fallAwarded && hbNow.y > fellOffScreenY) {
      this._fallAwarded = true;

      // score bonus
      this.game.score = (this.game.score ?? 0) + this.fallBonus;

      // popup
      if (!Array.isArray(this.game.uiPopups)) this.game.uiPopups = [];
      this.game.uiPopups.push({
        x: this._lastPopupX ?? centerX,
        y: this._lastPopupY ?? (canvasH - 120), // safe fallback
        text: `+${this.fallBonus}`,
        t: 0,
        dur: 1.55,
        rise: 145
      });

      this.removeFromWorld = true;
      return;
    }

    // If hero is invulnerable, ignore them
    if ((hero.invulnTimer ?? 0) > 0) {
      this.attacking = false;
      this.attackDidHit = false;
      this._wasChasing = false;
      this._patrol(dt);
      return;
    }

    // ---- SLEEP GATE ----
    if (this.asleep) {
      const heroHb = hero.getHitbox();
      const heroBottom = heroHb.y + heroHb.h;

      const nearX = (this.wakeRange <= 0) ? true : Math.abs(hero.x - this.x) <= this.wakeRange;

      const minY = (this.wakeYMin == null) ? -Infinity : this.wakeYMin;
      const maxY = (this.wakeYMax == null) ? Infinity : this.wakeYMax;
      const nearY = heroBottom >= minY && heroBottom <= maxY;

      if (nearX && nearY) {
        this.asleep = false;
      } else {
        this.attacking = false;
        this.attackDidHit = false;
        this._wasChasing = false;

        this.vx = 0;
        this.setState("IDLE");
        this._applyGravityAndCollide(dt);
        return;
      }
    }

    const dx = hero.x - this.x;
    const adx = Math.abs(dx);

    const chasing = adx < this.chaseRange || (this._wasChasing && adx < this.stopChaseRange);
    this._wasChasing = chasing;

    if (chasing) this.dir = dx >= 0 ? 1 : -1;

    // use the ledge-safe patrol when NOT chasing
    if (!chasing) {
      this.attacking = false;
      this.attackDidHit = false;
      this._patrol(dt);

      // stomp check even while patrolling
      const hb2 = this.getHitbox();
      const heroHb2 = hero.getHitbox();
      if (this.rectsOverlap(hb2, heroHb2) && this.stompedBy(heroHb2)) {
        this.killByStomp();
        hero.vy = -700;
      }
      return;
    }

    // Attack flow
    if (this.attacking) {
      this.vx = 0;
      this._applyGravityAndCollide(dt);

      const frame = this.animAttack.currentFrame();
      if (!this.attackDidHit && frame >= this.attackHitFrame) {
        const heroHb = hero.getHitbox();
        const atk = this.getAttackBox();

        // stomp still wins
        const hb = this.getHitbox();
        if (this.rectsOverlap(hb, heroHb) && this.stompedBy(heroHb)) {
          this.killByStomp();
          hero.vy = -700;
          return;
        }

        if (
          this.hitCooldown === 0 &&
          (hero.hurtTimer ?? 0) === 0 &&
          (hero.invulnTimer ?? 0) === 0 &&
          this.rectsOverlap(atk, heroHb)
        ) {
          this.hurtHero();
          this.hitCooldown = this.hitCooldownTime;
        }
        this.attackDidHit = true;
      }

      if (this.animIsDone(this.animAttack)) {
        this.attacking = false;
        this.attackDidHit = false;
        this.setState("RUN");
      }
      return;
    }

    // Start attack only when on ground and close/aligned
    const heroHb = hero.getHitbox();
    const hb = this.getHitbox();
    const overlapY = Math.min(hb.y + hb.h, heroHb.y + heroHb.h) - Math.max(hb.y, heroHb.y);

    if (
      this.onGround && chasing && adx < this.attackRange &&
      overlapY > 18 * this.scale &&
      this.hitCooldown === 0 &&
      (hero.hurtTimer ?? 0) === 0 &&
      (hero.invulnTimer ?? 0) === 0
    ) {
      this.attacking = true;
      this.attackDidHit = false;
      this.setState("ATTACK");
      this.vx = 0;
      this._applyGravityAndCollide(dt);
      return;
    }

    // Jump logic (platform capable)
    if (this.onGround && this.jumpCooldown === 0) {
      const playerAbove = (heroHb.y + heroHb.h) < (hb.y - this.jumpUpThreshold);
      const wallAhead = this.isWallAhead();

      const footY = hb.y + hb.h + 6;
      const footX = (this.dir === 1) ? (hb.x + hb.w + 12) : (hb.x - 12);
      const gapAhead = !this.hasSupportAt(footX, footY);

      if (playerAbove || wallAhead || gapAhead) {
        this.doJump();
      }
    }

    // Anim state
    if (!this.onGround && !this.attacking) this.setState("JUMP");
    else if (!this.attacking) this.setState("RUN");

    // Movement (chasing only here)
    const speed = this.chaseSpeed;
    this.vx = speed * this.dir;
    this.x += this.vx * dt;

    if (!(this.phaseOnChase)) {
      this.resolveCollisions("x");
    }

    this._applyGravityAndCollide(dt);

    // Stomp check
    const hb2 = this.getHitbox();
    const heroHb2 = hero.getHitbox();
    if (this.rectsOverlap(hb2, heroHb2) && this.stompedBy(heroHb2)) {
      this.killByStomp();
      hero.vy = -700;
      return;
    }
  }

  _patrol(dt) {
    if (this.idleTimer > 0) {
      this.idleTimer -= dt;
      this.vx = 0;
      this.setState("IDLE");
      this._applyGravityAndCollide(dt);
      return;
    }

    if (this.x < this.patrolMinX) { this.dir = 1; this.idleTimer = this.idlePauseTime; }
    if (this.x > this.patrolMaxX) { this.dir = -1; this.idleTimer = this.idlePauseTime; }

    this.setState("RUN");

    // ✅ LEDGE GUARD: turn around BEFORE walking off
    const hb = this.getHitbox();
    const footY = hb.y + hb.h + 6;
    const footX = (this.dir === 1) ? (hb.x + hb.w + 12) : (hb.x - 12);

    if (!this.hasSupportAt(footX, footY)) {
      // snap back a tiny bit so we don't hang off the edge
      const snap = 10 * this.scale;
      this.x -= this.dir * snap;

      this.dir *= -1;
      this.idleTimer = this.idlePauseTime;
      this.vx = 0;
      this.setState("IDLE");
      this._applyGravityAndCollide(dt);
      return;
    }

    this.vx = this.patrolSpeed * this.dir;
    this.x += this.vx * dt;

    this.resolveCollisions("x");
    this._applyGravityAndCollide(dt);
  }

  draw(ctx) {
    const drawW = this.cell * this.scale;
    const anim = this.currentAnim();

    const tick = (this.dying) ? 0 : this.game.clockTick;

    const dx = this.drawOffsetX ?? 0;
    const dy = this.drawOffsetY ?? 0;

    const baseX = this.x + dx;
    const baseY = this.y + dy;

    if (this.dir === -1) {
      ctx.save();
      ctx.translate(baseX + drawW, baseY);
      ctx.scale(-1, 1);
      anim.drawFrame(tick, ctx, 0, 0, this.scale);
      ctx.restore();
    } else {
      anim.drawFrame(tick, ctx, baseX, baseY, this.scale);
    }
  }
}