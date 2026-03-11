class Hero {
  constructor(game) {
    this.game = game;

    // === SPRITE PATHS ===
    // If your images are inside an Assets/ folder, change these to "./Assets/..."
    const IDLE_PATH = "./assets/entities/HeroIdle.png";
    const WALK_PATH = "./assets/entities/HeroWalk.png";
    const SPRINT_PATH = "./assets/entities/HeroSprint.png";
    const JUMP_PATH = "./assets/entities/HeroJump.png";
    const HURT_PATH = "./assets/entities/HeroDamage.png";

    // Load sheets (fallbacks prevent blank screen if you forgot to queue one)
    this.idleSheet = ASSET_MANAGER.getAsset(IDLE_PATH);
    this.walkSheet = ASSET_MANAGER.getAsset(WALK_PATH) || this.idleSheet;
    this.sprintSheet = ASSET_MANAGER.getAsset(SPRINT_PATH) || this.walkSheet || this.idleSheet;
    this.jumpSheet = ASSET_MANAGER.getAsset(JUMP_PATH) || this.idleSheet;
    this.hurtSheet = ASSET_MANAGER.getAsset(HURT_PATH) || this.idleSheet;

    this.invulnTimer = 0;          // seconds of enemy-invulnerability
    this.invulnDuration = 3.0;     // 3 seconds
    this.invulnAlpha = 0.45;       // transparency while invulnerable

    // === ANIM SETUP ===
    this.scale = 0.75;

    // Helper: create a gapped animator even if your Animator.js doesn't support frame gaps yet.
    const makeGappedAnimator = (sheet, xStart, yStart, frameW, frameH, count, dur, loop, gap) => {
      // If Animator constructor supports a 9th param (frameGap), use it.
      if (typeof Animator === "function" && Animator.length >= 9) {
        return new Animator(sheet, xStart, yStart, frameW, frameH, count, dur, loop, gap);
      }

      // Otherwise, use a tiny local animator that understands gaps.
      return {
        spriteSheet: sheet,
        xStart,
        yStart,
        frameWidth: frameW,
        frameHeight: frameH,
        frameCount: count,
        frameDuration: dur,
        loop,
        gap,
        elapsedTime: 0,
        totalTime: count * dur,
        reset() { this.elapsedTime = 0; },
        currentFrame() {
          let frame = Math.floor(this.elapsedTime / this.frameDuration);
          if (frame < 0) frame = 0;
          if (frame > this.frameCount - 1) frame = this.frameCount - 1;
          return frame;
        },
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
          const sx = this.xStart + frame * (this.frameWidth + this.gap);
          const sy = this.yStart;

          ctx.drawImage(
            this.spriteSheet,
            sx, sy, this.frameWidth, this.frameHeight,
            Math.floor(x), Math.floor(y),
            this.frameWidth * scale, this.frameHeight * scale
          );
        }
      };
    };

    // IDLE strip: 6 frames
    this.idleCols = 6;
    this.idleFrameW = Math.floor(this.idleSheet.width / this.idleCols);
    this.idleFrameH = Math.floor(this.idleSheet.height);
    this.idle = new Animator(this.idleSheet, 0, 0, this.idleFrameW, this.idleFrameH, 6, 0.12, true);

    // WALK strip: 6 frames
    this.walkCols = 6;
    this.walkFrameW = Math.floor(this.walkSheet.width / this.walkCols);
    this.walkFrameH = Math.floor(this.walkSheet.height);
    this.walk = new Animator(this.walkSheet, 0, 0, this.walkFrameW, this.walkFrameH, 6, 0.10, true);

    // SPRINT strip: 6 frames
    this.sprintCols = 6;
    this.sprintFrameW = Math.floor(this.sprintSheet.width / this.sprintCols);
    this.sprintFrameH = Math.floor(this.sprintSheet.height);
    this.sprint = new Animator(this.sprintSheet, 0, 0, this.sprintFrameW, this.sprintFrameH, 6, 0.07, true);

    // JUMP strip: 6 frames (doesn't loop; holds last frame)
    this.jumpCols = 6;
    this.jumpFrameW = Math.floor(this.jumpSheet.width / this.jumpCols);
    this.jumpFrameH = Math.floor(this.jumpSheet.height);
    this.jump = new Animator(this.jumpSheet, 0, 0, this.jumpFrameW, this.jumpFrameH, 6, 0.10, false);

    // HURT strip: 4 frames (doesn't loop; holds last frame)
    this.hurtCols = 4;
    this.hurtFrameW = Math.floor(this.hurtSheet.width / this.hurtCols);
    this.hurtFrameH = Math.floor(this.hurtSheet.height);
    this.hurt = new Animator(this.hurtSheet, 0, 0, this.hurtFrameW, this.hurtFrameH, 4, 0.08, false);

    // Reference size so animation swaps don't "pop"
    this.baseDrawW = this.idleFrameW * this.scale;
    this.baseDrawH = this.idleFrameH * this.scale;

    // FEET alignment (auto scales with hero size)
    const FEET_Y = Math.round(15.5 * this.scale);
    const JUMP_Y = Math.round(15 * this.scale);
    const HURT_Y = -Math.round(3 * this.scale);

    this.offsets = {
      IDLE: { x: 0, y: FEET_Y },
      WALK: { x: 0, y: FEET_Y },
      SPRINT: { x: 0, y: FEET_Y },
      JUMP: { x: 0, y: JUMP_Y },
      HURT: { x: 0, y: HURT_Y },
    };

    // === STATE ===
    this.state = "IDLE"; // IDLE | WALK | SPRINT | JUMP | HURT
    this.facing = 1;     // 1 right, -1 left

    // === SPAWN / SCORE ===
    this.spawnX = 120;
    this.spawnY = 200;
    this.starsCollected = 0;

    // === PHYSICS ===
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;

    // Tweak for feel
    this.gravity = 2400;
    this.jumpV = -980;
    this.accel = 3200;
    this.friction = 2600;
    this.maxWalk = 280;
    this.maxRun = 440;

    // press-once tracking
    this.jumpWasDown = false;

    // hurt press-once + timer
    this.hurtWasDown = false;
    this.hurtTimer = 0;
    this.hurtDuration = 0.35;
  }

  // Stable collision box based on IDLE size
  getHitbox() {
    const baseW = this.idleFrameW * this.scale;
    const baseH = this.idleFrameH * this.scale;

    const w = baseW * 0.55;
    const h = baseH * 0.80;

    return {
      x: this.x + (baseW - w) / 2,
      y: this.y + (baseH - h),
      w,
      h
    };
  }

  rectsOverlap(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  resolveCollisions(axis) {
    const plats = this.game.level?.platforms ?? [];

    for (const p of plats) {
      const s = p.scale ?? 1;
      const pb = { x: p.x, y: p.y, w: p.w * s, h: p.h * s };

      const hb = this.getHitbox();
      if (!this.rectsOverlap(hb, pb)) continue;

      if (axis === "x") {
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
          // landing
          const overlap = (hb.y + hb.h) - pb.y;
          this.y -= overlap;
          this.vy = 0;
          this.onGround = true;
        } else if (this.vy < 0) {
          // head bonk
          const overlap = (pb.y + pb.h) - hb.y;
          this.y += overlap;
          this.vy = 0;
        }
      }
    }
  }

  update() {
    const dt = this.game.clockTick;

    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }

    // --- Hurt timer ---
    if (this.hurtTimer > 0) {
      this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    }

    // Movement keys (Arrow OR WASD)
    const left = this.game.keys["ArrowLeft"] || this.game.keys["a"] || this.game.keys["A"];
    const right = this.game.keys["ArrowRight"] || this.game.keys["d"] || this.game.keys["D"];
    const run = this.game.keys["Shift"];

    // Jump keys (Space OR W OR ArrowUp)
    const jumpDown =
      this.game.keys[" "] || this.game.keys["ArrowUp"] ||
      this.game.keys["w"] || this.game.keys["W"];

    const jumpPressed = jumpDown && !this.jumpWasDown;
    this.jumpWasDown = !!jumpDown;

    // Hurt key: H
    const hurtDown = this.game.keys["h"] || this.game.keys["H"];
    const hurtPressed = hurtDown && !this.hurtWasDown;
    this.hurtWasDown = !!hurtDown;

    // Trigger hurt
    if (hurtPressed && this.hurtTimer === 0) {
      this.hurtTimer = this.hurtDuration;
      this.hurt.reset();
      this.state = "HURT";
    }

    const isHurt = this.hurtTimer > 0;
    const maxSpeed = run ? this.maxRun : this.maxWalk;

    // Horizontal controls (disabled during hurt)
    if (!isHurt) {
      if (left) {
        this.vx -= this.accel * dt;
        this.facing = -1;
      } else if (right) {
        this.vx += this.accel * dt;
        this.facing = 1;
      } else {
        if (this.vx > 0) this.vx = Math.max(0, this.vx - this.friction * dt);
        if (this.vx < 0) this.vx = Math.min(0, this.vx + this.friction * dt);
      }

      // Clamp speed
      this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));

      // Jump
      if (jumpPressed && this.onGround) {
        this.vy = this.jumpV;
        this.onGround = false;
        this.jump.reset();
      }
    } else {
      // During hurt, slow down horizontally
      if (this.vx > 0) this.vx = Math.max(0, this.vx - this.friction * dt);
      if (this.vx < 0) this.vx = Math.min(0, this.vx + this.friction * dt);
    }

    // Gravity
    this.vy += this.gravity * dt;

    // Move + collide
    this.x += this.vx * dt;
    this.resolveCollisions("x");

    this.y += this.vy * dt;
    this.onGround = false;
    this.resolveCollisions("y");

    // --- Collect stars ---
    const stars = this.game.level?.stars ?? [];
    const hb = this.getHitbox();

    for (const st of stars) {
      if (st.taken) continue;

      if (this.rectsOverlap(hb, st)) {
        st.taken = true;
        this.game.starsCollected = (this.game.starsCollected ?? 0) + 1;
        this.game.score = (this.game.score ?? 0) + 100;
      }
    }

    // --- Collect hearts (heal items) ---
    const hearts = this.game.level?.hearts ?? [];
    const maxHP = (typeof this.game.maxHP === "number") ? this.game.maxHP : 3;
    if (typeof this.game.hp !== "number") this.game.hp = maxHP;

    // Match the heart bobbing used by Level.draw()
    const t = this.game?.timer?.gameTime ?? 0;

    for (const h of hearts) {
      if (h.taken) continue;

      // If full HP, do NOT pick it up (leave it on the map)
      if (this.game.hp >= maxHP) continue;

      const bob = Math.sin(t * (h.floatSpeed ?? 3) + (h.phase ?? 0)) * (h.floatAmp ?? 7);
      const hbHeart = {
        x: h.x,
        y: (h.baseY ?? h.y) + bob,
        w: h.w,
        h: h.h
      };

      if (this.rectsOverlap(hb, hbHeart)) {
        h.taken = true;

        const healAmt = h.heal ?? 1;
        this.game.hp = Math.min(maxHP, this.game.hp + healAmt);

        // Floating "+1 ♥" popup (world-space; HUD will draw it)
        this.game.uiPopups = this.game.uiPopups || [];
        const cx = hb.x + hb.w / 2;
        const cy = hb.y - 10;
        this.game.uiPopups.push({
          x: cx,
          y: cy,
          text: "+1 ♥",
          t: 0,
          dur: 0.75,
          rise: 55
        });
      }
    }

    // Animation state priority (NO CROUCH)
    if (this.hurtTimer > 0) {
      this.state = "HURT";
    } else if (!this.onGround) {
      this.state = "JUMP";
    } else if (Math.abs(this.vx) > 15) {
      this.state = run ? "SPRINT" : "WALK";
    } else {
      this.state = "IDLE";
    }

    // Fall death
    const canvasH = this.game.ctx.canvas.height;
    if (this.y > canvasH + 400) {
      this.game.fellOff = true;
      this.vx = 0;
      this.vy = 0;
      return;
    }
  }

  draw(ctx) {
    let anim = this.idle;
    let frameW = this.idleFrameW;
    let frameH = this.idleFrameH;

    if (this.state === "WALK") { anim = this.walk; frameW = this.walkFrameW; frameH = this.walkFrameH; }
    else if (this.state === "SPRINT") { anim = this.sprint; frameW = this.sprintFrameW; frameH = this.sprintFrameH; }
    else if (this.state === "JUMP") { anim = this.jump; frameW = this.jumpFrameW; frameH = this.jumpFrameH; }
    else if (this.state === "HURT") { anim = this.hurt; frameW = this.hurtFrameW; frameH = this.hurtFrameH; }

    const drawW = frameW * this.scale;
    const drawH = frameH * this.scale;

    const drawX = this.x + (this.baseDrawW - drawW) / 2;
    const drawY = this.y + (this.baseDrawH - drawH);

    const off = this.offsets[this.state] || { x: 0, y: 0 };
    const finalX = drawX + off.x;
    const finalY = drawY + off.y;

    const inv = (this.invulnTimer ?? 0) > 0;
    if (inv) {
      ctx.save();
      const t = this.game?.timer?.gameTime ?? 0;
      const flicker = 0.12 * Math.sin(t * 28);
      ctx.globalAlpha = Math.max(0.25, (this.invulnAlpha ?? 0.55) + flicker);
    }

    if (this.facing === -1) {
      ctx.save();
      ctx.translate(finalX + drawW, finalY);
      ctx.scale(-1, 1);
      anim.drawFrame(this.game.clockTick, ctx, 0, 0, this.scale);
      ctx.restore();
    } else {
      anim.drawFrame(this.game.clockTick, ctx, finalX, finalY, this.scale);
    }

    if (inv) ctx.restore();
  }
}
