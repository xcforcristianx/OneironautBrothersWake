class Ghost1 {
  constructor(game, x, y, opts = {}) {
    this.game = game;

    this.sheet = ASSET_MANAGER.getAsset("./assets/entities/ghost1.png");

    // sprite sheet is 1280x1280 with 128x128 tiles
    this.cell = 128;

    // -------------------- Animations (by row) --------------------
    // Row 0: idle (5 frames)
    // Row 1: MOVE (5 frames)   <-- your "2nd row"
    // Row 2: CLOSE (5 frames)  <-- your "3rd row"
    // Row 3: ATTACK (4 frames) <-- your "4th row"
    // Row 8: DEATH_START (3 frames)  <-- "final rows" part 1
    // Row 9: DEATH (4 frames)        <-- "final rows" part 2

    this.animIdle = new Animator(this.sheet, 0, 0 * this.cell, this.cell, this.cell, 5, 0.12, true);
    this.animMove = new Animator(this.sheet, 0, 1 * this.cell, this.cell, this.cell, 5, 0.10, true);
    this.animClose = new Animator(this.sheet, 0, 2 * this.cell, this.cell, this.cell, 5, 0.10, true);
    this.animAttack = new Animator(this.sheet, 0, 3 * this.cell, this.cell, this.cell, 4, 0.10, false);

    // death animations (bottom rows)
    this.animDeathStart = new Animator(this.sheet, 0, 8 * this.cell, this.cell, this.cell, 3, 0.08, false);
    this.animDeath = new Animator(this.sheet, 0, 9 * this.cell, this.cell, this.cell, 4, 0.10, false);

    this.state = "MOVE"; // MOVE | CLOSE | ATTACK | IDLE | DEATH_START | DEATH

    // ---- Options ----
    this.scale = opts.scale ?? 1.6;

    this.patrolMinX = opts.patrolMinX ?? (x - 200);
    this.patrolMaxX = opts.patrolMaxX ?? (x + 200);

    this.patrolSpeed = opts.patrolSpeed ?? 90;
    this.chaseSpeed = opts.chaseSpeed ?? 150;

    this.chaseRange = opts.chaseRange ?? 420;
    this.stopChaseRange = opts.stopChaseRange ?? 520;

    this.closeChaseRange = opts.closeChaseRange ?? 220;
    this.attackRange = opts.attackRange ?? 90;

    this.phaseOnChase = (opts.phaseOnChase ?? true);

    // ---- Movement / physics ----
    this.x = x;
    this.y = y;

    this.vx = 0;
    this.vy = 0;
    this.dir = 1;

    this.gravity = 2400;
    this.maxFall = 1500;
    this.onGround = false;

    // ---- Combat ----
    this.hitCooldown = 0;
    this.hitCooldownTime = 0.6;

    this.attacking = false;
    this.attackDidHit = false;
    this.attackHitFrame = opts.attackHitFrame ?? 2;

    // death state
    this.dying = false;

    this.removeFromWorld = false;

    // bonus score if this ghost falls off the world
    this.fallBonus = opts.fallBonus ?? 200;
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

    if (next === "ATTACK") this.animAttack.reset();
    if (next === "MOVE") this.animMove.reset();
    if (next === "CLOSE") this.animClose.reset();
    if (next === "IDLE") this.animIdle.reset();

    // ✅ NEW
    if (next === "DEATH_START") this.animDeathStart.reset();
    if (next === "DEATH") this.animDeath.reset();
  }

  currentAnim() {
    switch (this.state) {
      case "DEATH_START": return this.animDeathStart;
      case "DEATH": return this.animDeath;
      case "ATTACK": return this.animAttack;
      case "CLOSE": return this.animClose;
      case "IDLE": return this.animIdle;
      case "MOVE":
      default: return this.animMove;
    }
  }

  animIsDone(anim) {
    return !anim.loop && anim.elapsedTime >= anim.totalTime - 0.00001;
  }

  getHitbox() {
    const drawW = this.cell * this.scale;
    const drawH = this.cell * this.scale;

    const w = 52 * this.scale;
    const h = 78 * this.scale;

    return {
      x: this.x + (drawW - w) / 2,
      y: this.y + (drawH - h),
      w,
      h
    };
  }

  getAttackBox() {
    const hb = this.getHitbox();
    const extraW = 55 * this.scale;
    const extraH = 20 * this.scale;

    if (this.dir === 1) {
      return { x: hb.x, y: hb.y - extraH * 0.3, w: hb.w + extraW, h: hb.h + extraH };
    } else {
      return { x: hb.x - extraW, y: hb.y - extraH * 0.3, w: hb.w + extraW, h: hb.h + extraH };
    }
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

  _isHeroSamePlatform(heroHb) {
    const hb = this.getHitbox();
    const overlapY = Math.min(hb.y + hb.h, heroHb.y + heroHb.h) - Math.max(hb.y, heroHb.y);
    return overlapY > 18 * this.scale;
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

  // ✅ NEW: start death animation instead of fading
  killByStomp() {
    if (this.dying) return;

    this.dying = true;
    this.vx = 0;
    this.vy = 0;
    this.attacking = false;
    this.attackDidHit = false;

    // score reward
    this.game.score = (this.game.score ?? 0) + 100;

    // start bottom-row death animation chain
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

    hero.vx = 260 * (hero.x < this.x ? -1 : 1);
    hero.vy = -260;
  }

  // -------------------- Update --------------------
  update() {
    const dt = this.game.clockTick;

    // Death animation playback (advance time here, draw uses tick=0)
    if (this.dying) {
      this.vx = 0;
      this.vy = 0;

      if (this.state === "DEATH_START") {
        this.animDeathStart.elapsedTime += dt;
        if (this.animIsDone(this.animDeathStart)) {
          this.setState("DEATH");
        }
      } else {
        this.animDeath.elapsedTime += dt;
        if (this.animIsDone(this.animDeath)) {
          this.removeFromWorld = true;
        }
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

    // Trigger shortly after it falls below the screen (not 300px later)
    const fellOffScreenY = canvasH + 60;

    if (!this._fallAwarded && hbNow.y > fellOffScreenY) {
      this._fallAwarded = true;

      // score bonus
      this.game.score = (this.game.score ?? 0) + this.fallBonus;

      // popup at last seen position (gap edge)
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

    const dx = (hero.x - this.x);
    const adx = Math.abs(dx);

    const chasing = adx < this.chaseRange || (this._wasChasing && adx < this.stopChaseRange);
    this._wasChasing = chasing;

    if (chasing) this.dir = dx >= 0 ? 1 : -1;

    // ---- ATTACK logic ----
    if (this.attacking) {
      this.vx = 0;
      this._applyGravityAndCollide(dt);

      const frame = this.animAttack.currentFrame();
      if (!this.attackDidHit && frame >= this.attackHitFrame) {
        const heroHb = hero.getHitbox();
        const atk = this.getAttackBox();

        const hb = this.getHitbox();
        if (this.rectsOverlap(hb, heroHb) && this.stompedBy(heroHb)) {
          this.killByStomp();
          hero.vy = -600;
          return;
        }

        if (this.hitCooldown === 0 &&
          (hero.hurtTimer ?? 0) === 0 &&
          (hero.invulnTimer ?? 0) === 0 &&
          this.rectsOverlap(atk, heroHb)) {
          this.hurtHero();
          this.hitCooldown = this.hitCooldownTime;
        }
        this.attackDidHit = true;
      }

      if (this.animIsDone(this.animAttack)) {
        this.attacking = false;
        this.attackDidHit = false;

        if (adx < this.closeChaseRange) this.setState("CLOSE");
        else this.setState("MOVE");
      }

      return;
    }

    const heroHb = hero.getHitbox();
    const hb = this.getHitbox();
    const overlapY = Math.min(hb.y + hb.h, heroHb.y + heroHb.h) - Math.max(hb.y, heroHb.y);

    const canAttack = chasing && adx < this.attackRange && overlapY > 18 * this.scale;

    if (canAttack &&
      this.hitCooldown === 0 &&
      (hero.hurtTimer ?? 0) === 0 &&
      (hero.invulnTimer ?? 0) === 0) {
      this.attacking = true;
      this.attackDidHit = false;
      this.setState("ATTACK");
      this.vx = 0;
      this._applyGravityAndCollide(dt);
      return;
    }

    if (chasing) {
      if (adx < this.closeChaseRange) this.setState("CLOSE");
      else this.setState("MOVE");
    } else {
      this.setState("MOVE");
    }

    let speed = chasing ? this.chaseSpeed : this.patrolSpeed;

    if (!chasing) {
      if (this.x < this.patrolMinX) this.dir = 1;
      if (this.x > this.patrolMaxX) this.dir = -1;
    }


    this.vx = speed * this.dir;

this.x += this.vx * dt;

if (!(chasing && this.phaseOnChase)) {
  this.resolveCollisions("x");
}

this._applyGravityAndCollide(dt);

const hb2 = this.getHitbox();
const heroHb2 = hero.getHitbox();

if (this.rectsOverlap(hb2, heroHb2) && this.stompedBy(heroHb2)) {
  this.killByStomp();
  hero.vy = -600;
  return;
}
  }

_patrol(dt) {
  this.setState("MOVE");

  if (this.x < this.patrolMinX) this.dir = 1;
  if (this.x > this.patrolMaxX) this.dir = -1;

  this.vx = this.patrolSpeed * this.dir;

  this.x += this.vx * dt;
  this.resolveCollisions("x");

  this._applyGravityAndCollide(dt);
}

_applyGravityAndCollide(dt) {
  this.vy += this.gravity * dt;
  if (this.vy > this.maxFall) this.vy = this.maxFall;

  this.y += this.vy * dt;
  this.onGround = false;
  this.resolveCollisions("y");
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