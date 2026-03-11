class Ghost2 {
  constructor(game, x, y, opts = {}) {
    this.game = game;

    this.sheet = ASSET_MANAGER.getAsset("./assets/entities/ghost2.png");
    this.cell = 128;

    // -------------------- Animations (by row) --------------------
    // Row 0: IDLE (5 frames)
    // Row 2: RUN  (7 frames)  <- faster-looking run row
    // Row 3: ATTACK (4 frames)
    // Row 8: DEATH_START (3 frames)
    // Row 9: DEATH (5 frames)

    this.animIdle = new Animator(this.sheet, 0, 0 * this.cell, this.cell, this.cell, 5, 0.12, true);
    this.animRun = new Animator(this.sheet, 0, 2 * this.cell, this.cell, this.cell, 7, 0.08, true);
    this.animAttack = new Animator(this.sheet, 0, 3 * this.cell, this.cell, this.cell, 4, 0.09, false);

    this.animDeathStart = new Animator(this.sheet, 0, 8 * this.cell, this.cell, this.cell, 3, 0.08, false);
    this.animDeath = new Animator(this.sheet, 0, 9 * this.cell, this.cell, this.cell, 5, 0.09, false);

    this.state = "RUN"; // IDLE | RUN | ATTACK | DEATH_START | DEATH

    // ---- SLEEP / WAKE (optional) ----
    this.asleep = !!opts.startAsleep;          // default false
    this.wakeRange = opts.wakeRange ?? 0;      // pixels (0 = always awake)
    this.wakeYMin = opts.wakeYMin;            // optional: heroBottom must be >= this
    this.wakeYMax = opts.wakeYMax;            // optional: heroBottom must be <= this

    // -------------------- Tuning --------------------
    this.scale = opts.scale ?? 1.8;

    this.patrolMinX = opts.patrolMinX ?? (x - 220);
    this.patrolMaxX = opts.patrolMaxX ?? (x + 220);

    // Faster than Ghost1 by default
    this.patrolSpeed = opts.patrolSpeed ?? 130;
    this.chaseSpeed = opts.chaseSpeed ?? 220;

    this.chaseRange = opts.chaseRange ?? 520;
    this.stopChaseRange = opts.stopChaseRange ?? 650;

    this.attackRange = opts.attackRange ?? 105;
    this.attackHitFrame = opts.attackHitFrame ?? 2;

    // If true, ghost can pass through platforms while chasing (only X)
    this.phaseOnChase = (opts.phaseOnChase ?? false);

    // Pause idle at patrol turnarounds (makes idle actually visible)
    this.idlePauseTime = opts.idlePauseTime ?? 0.35;
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

    // -------------------- Combat --------------------
    this.hitCooldown = 0;
    this.hitCooldownTime = 0.55;

    this.attacking = false;
    this.attackDidHit = false;

    // death state
    this.dying = false;

    this.removeFromWorld = false;

    // bonus score if this ghost falls off the world
    this.fallBonus = opts.fallBonus ?? 300;
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

  setState(next) {
    if (this.state === next) return;
    this.state = next;

    if (next === "IDLE") this.animIdle.reset();
    if (next === "RUN") this.animRun.reset();
    if (next === "ATTACK") this.animAttack.reset();
    if (next === "DEATH_START") this.animDeathStart.reset();
    if (next === "DEATH") this.animDeath.reset();
  }

  currentAnim() {
    switch (this.state) {
      case "DEATH_START": return this.animDeathStart;
      case "DEATH": return this.animDeath;
      case "ATTACK": return this.animAttack;
      case "IDLE": return this.animIdle;
      case "RUN":
      default: return this.animRun;
    }
  }

  animIsDone(anim) {
    return !anim.loop && anim.elapsedTime >= anim.totalTime - 0.00001;
  }

  // Slightly chunkier hitbox than Ghost1
  getHitbox() {
    const drawW = this.cell * this.scale;
    const drawH = this.cell * this.scale;

    const w = 58 * this.scale;
    const h = 86 * this.scale;

    return {
      x: this.x + (drawW - w) / 2,
      y: this.y + (drawH - h),
      w,
      h
    };
  }

  getAttackBox() {
    const hb = this.getHitbox();
    const extraW = 60 * this.scale;
    const extraH = 22 * this.scale;

    if (this.dir === 1) {
      return { x: hb.x, y: hb.y - extraH * 0.25, w: hb.w + extraW, h: hb.h + extraH };
    } else {
      return { x: hb.x - extraW, y: hb.y - extraH * 0.25, w: hb.w + extraW, h: hb.h + extraH };
    }
  }

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

    this.game.score = (this.game.score ?? 0) + 150; // a bit more than Ghost1
    this.setState("DEATH_START");
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

    hero.vx = 320 * (hero.x < this.x ? -1 : 1);
    hero.vy = -280;
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

    // Death animation chain
    if (this.dying) {
      if (this.state === "DEATH_START") {
        this.animDeathStart.elapsedTime += dt;
        if (this.animIsDone(this.animDeathStart)) this.setState("DEATH");
      } else {
        this.animDeath.elapsedTime += dt;
        if (this.animIsDone(this.animDeath)) this.removeFromWorld = true;
      }
      return;
    }

    // ---- FALL BONUS + POPUP (show from the gap where it fell) ----
    const canvas = this.game.ctx?.canvas;
    const canvasW = canvas?.width ?? 1024;
    const canvasH = canvas?.height ?? 724;

    const cam = this.game.cameraX ?? 0;
    const hbNow = this.getHitbox();
    const centerX = hbNow.x + hbNow.w / 2;
    const centerY = hbNow.y + hbNow.h / 2;

    // Only update popup anchor while ghost is on-screen
    const sx = centerX - cam;
    const onScreen =
      sx >= -50 && sx <= canvasW + 50 &&
      centerY >= -50 && centerY <= canvasH + 50;

    if (onScreen) {
      this._lastPopupX = centerX;
      this._lastPopupY = centerY;
    }

    // Trigger shortly after it falls below the screen
    const fellOffScreenY = canvasH + 60;

    if (!this._fallAwarded && hbNow.y > fellOffScreenY) {
      this._fallAwarded = true;

      this.game.score = (this.game.score ?? 0) + this.fallBonus;

      if (!Array.isArray(this.game.uiPopups)) this.game.uiPopups = [];
      this.game.uiPopups.push({
        x: this._lastPopupX ?? centerX,
        y: this._lastPopupY ?? (canvasH - 120),
        text: `+${this.fallBonus}`,
        dur: 1.55,
        rise: 145
      });

      this.removeFromWorld = true;
      return;
    }

    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    const hero = this.game.player;
    if (!hero) {
      // no hero => patrol
      this._patrol(dt);
      return;
    }

    // If hero is invulnerable, ignore them (transparent to enemies)
    if ((hero.invulnTimer ?? 0) > 0) {
      this.attacking = false;
      this.attackDidHit = false;
      this._wasChasing = false;
      this._patrol(dt);
      return;
    }

    // ---- SLEEP GATE: do nothing until player is near + on correct "terrain" ----
    if (this.asleep) {
      const heroHb = hero.getHitbox();
      const heroBottom = heroHb.y + heroHb.h;

      const nearX = (this.wakeRange <= 0) ? true : Math.abs(hero.x - this.x) <= this.wakeRange;

      const minY = (this.wakeYMin == null) ? -Infinity : this.wakeYMin;
      const maxY = (this.wakeYMax == null) ? Infinity : this.wakeYMax;
      const nearY = heroBottom >= minY && heroBottom <= maxY;

      if (nearX && nearY) {
        this.asleep = false; // WAKE UP
      } else {
        // stay idle (standing) + stay grounded
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
          hero.vy = -650;
          return;
        }

        if (this.hitCooldown === 0 && (hero.hurtTimer ?? 0) === 0 && (hero.invulnTimer ?? 0) === 0 && this.rectsOverlap(atk, heroHb)) {
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

    // Start attack when very close & aligned
    const heroHb = hero.getHitbox();
    const hb = this.getHitbox();
    const overlapY = Math.min(hb.y + hb.h, heroHb.y + heroHb.h) - Math.max(hb.y, heroHb.y);

    if (chasing && adx < this.attackRange && overlapY > 18 * this.scale &&
      this.hitCooldown === 0 && (hero.hurtTimer ?? 0) === 0 && (hero.invulnTimer ?? 0) === 0) {
      this.attacking = true;
      this.attackDidHit = false;
      this.setState("ATTACK");
      this.vx = 0;
      this._applyGravityAndCollide(dt);
      return;
    }

    // Patrol idle pause at endpoints so IDLE is visible
    if (!chasing) {
      if (this.idleTimer > 0) {
        this.idleTimer -= dt;
        this.vx = 0;
        this.setState("IDLE");
        this._applyGravityAndCollide(dt);
        return;
      }
    }

    // Movement state
    this.setState(chasing ? "RUN" : "RUN");

    const speed = chasing ? this.chaseSpeed : this.patrolSpeed;

    if (!chasing) {
      if (this.x < this.patrolMinX) { this.dir = 1; this.idleTimer = this.idlePauseTime; }
      if (this.x > this.patrolMaxX) { this.dir = -1; this.idleTimer = this.idlePauseTime; }
    }


    this.vx = speed * this.dir;
    this.x += this.vx * dt;

    if (!(chasing && this.phaseOnChase)) {
      this.resolveCollisions("x");
    }

    this._applyGravityAndCollide(dt);

    // Stomp check
    const ghostHb = this.getHitbox();
    const heroHbStomp = hero.getHitbox();
    if (this.rectsOverlap(ghostHb, heroHbStomp) && this.stompedBy(heroHbStomp)) {
      this.killByStomp();
      hero.vy = -650;
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
    this.vx = this.patrolSpeed * this.dir;

    this.x += this.vx * dt;
    this.resolveCollisions("x");
    this._applyGravityAndCollide(dt);
  }

  // -------------------- Draw --------------------
  draw(ctx) {
    const drawW = this.cell * this.scale;
    const anim = this.currentAnim();
    const tick = (this.dying) ? 0 : this.game.clockTick;

    const yDraw = this.y; // no bobbing

    if (this.dir === -1) {
      ctx.save();
      ctx.translate(this.x + drawW, yDraw);
      ctx.scale(-1, 1);
      anim.drawFrame(tick, ctx, 0, 0, this.scale);
      ctx.restore();
    } else {
      anim.drawFrame(tick, ctx, this.x, yDraw, this.scale);
    }
  }
}