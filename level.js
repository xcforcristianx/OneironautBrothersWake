class Level {
  constructor(game, levelId = "1-1") {
    this.game = game;
    this.id = levelId;

    this.platforms = [];
    this.stars = [];
    this.hearts = [];
    this.enemyDefs = [];

    // spawn (main.js will read these)
    this.spawnX = 120;
    this.spawnY = 200;

    const STAR_SIZE = 40;

    const HEART_SIZE = 34;

    // Heart helper (3 per level)
    const addHeartOnPlatform = (platform, xOffset, yOffset = 12) => {
      const baseY = platform.y - HEART_SIZE - yOffset;
      const px = platform.x + xOffset;

      this.hearts.push({
        x: px,
        y: baseY,       // keep y for convenience
        baseY: baseY,   // bobbing uses this
        w: HEART_SIZE,
        h: HEART_SIZE,
        taken: false,
        heal: 1,
        floatAmp: 7,    // bob amount (pixels)
        floatSpeed: 3,  // bob speed
        phase: px * 0.02
      });
    };

    // -------- Terrain sets --------
    const DAY = {
      floorLeft: "./assets/terrains/FloorTerrainLeft.png",
      floorRight: "./assets/terrains/FloorTerrainRight.png",
      small: "./assets/terrains/SmallTerrain.png",
      medium: "./assets/terrains/MediumTerrain.png",
      long: "./assets/terrains/LongTerrain.png"
    };

    const NIGHTFALL = {
      floorLeft: "./assets/terrains/FloorTerrainLeftNightFall.png",
      floorRight: "./assets/terrains/FloorTerrainRightNightFall.png",
      small: "./assets/terrains/SmallTerrainNightFall.png",
      medium: "./assets/terrains/MediumTerrainNightFall.png",
      long: "./assets/terrains/LongTerrainNightFall.png"
    };

    const LUCID = {
      floorLeft: "./assets/terrains/FloorTerrainLeftLucid.png",
      floorRight: "./assets/terrains/FloorTerrainRightLucid.png",
      small: "./assets/terrains/SmallTerrainLucid.png",
      medium: "./assets/terrains/MediumTerrainLucid.png",
      long: "./assets/terrains/LongTerrainLucid.png"
    };

    // pick which terrain set to use
    if (this.id === "2-1") this.terrain = NIGHTFALL;
    else if (this.id === "3-1") this.terrain = LUCID;
    else this.terrain = DAY;

    // Alternate ground sprites a bit (makes floor less repetitive for 2-1 & 3-1)
    let groundIndex = 0;

    const addGround = (x, w) => {
      const useImg =
        (this.id === "2-1" || this.id === "3-1")
          ? (groundIndex++ % 2 === 0 ? this.terrain.floorLeft : this.terrain.floorRight)
          : this.terrain.floorLeft;

      const p = {
        x,
        y: 650,
        w,
        h: 120,
        img: useImg,
        scale: 1.0
      };
      this.platforms.push(p);
      return p;
    };

    const addStarOnPlatform = (platform, xOffset, yOffset = 10) => {
      this.stars.push({
        x: platform.x + xOffset,
        y: platform.y - STAR_SIZE - yOffset,
        w: STAR_SIZE,
        h: STAR_SIZE,
        taken: false
      });
    };

    const addPlat = (x, y, type) => {
      let p;
      if (type === "S") p = { x, y, w: 147, h: 74, img: this.terrain.small, scale: 1.0 };
      if (type === "M") p = { x, y, w: 213, h: 74, img: this.terrain.medium, scale: 1.0 };
      if (type === "L") p = { x, y, w: 378, h: 100, img: this.terrain.long, scale: 1.0 };
      this.platforms.push(p);
      return p;
    };

    // -------------------- BUILD PER LEVEL --------------------
    if (this.id === "3-1") {
      this.width = 20000;
      this.build3_1(addGround, addPlat, addStarOnPlatform, addHeartOnPlatform);
    } else if (this.id === "2-1") {
      this.width = 19000;
      this.build2_1(addGround, addPlat, addStarOnPlatform, addHeartOnPlatform);
    } else {
      // default = 1-1
      this.width = 12000;
      this.build1_1(addGround, addPlat, addStarOnPlatform, addHeartOnPlatform);
    }

    // -------------------- WORLD BORDERS (no falling off the map edges) --------------------
    let minX = Infinity;
    let maxX = -Infinity;

    for (const p of this.platforms) {
      const s = p.scale ?? 1;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + p.w * s);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      minX = 0;
      maxX = this.width;
    }

    // Make camera/world end at the real content edge
    this.width = maxX;

    // Invisible side walls (no img, collision-only)
    const WALL_W = 60;
    const WALL_H = 4000;

    this.platforms.push({ x: minX - WALL_W, y: 0, w: WALL_W, h: WALL_H, img: null, scale: 1 });
    this.platforms.push({ x: maxX, y: 0, w: WALL_W, h: WALL_H, img: null, scale: 1 });
  }

  // -------------------- LEVEL 1-1 --------------------
  build1_1(addGround, addPlat, addStarOnPlatform, addHeartOnPlatform) {
    //#region TERRAIN (Ground + Platforms + Pickups)
    // ----- Ground layout (with gaps) -----
    addGround(0, 1200);
    addGround(1550, 850);
    addGround(2900, 1450);
    addGround(4700, 800);
    addGround(6400, 1750);
    addGround(8500, 1400);
    addGround(10000, 1800);

    let p;

    // 1) Stair steps (warm-up)
    p = addPlat(600, 560, "S");
    addStarOnPlatform(p, 40);
    addPlat(760, 520, "S");
    p = addPlat(920, 480, "S");
    addStarOnPlatform(p, 40);

    // 2) Mid-air chain (timing jumps)
    p = addPlat(1750, 520, "M");
    addStarOnPlatform(p, 80);
    addPlat(2100, 480, "S");
    p = addPlat(2350, 380, "S");
    addStarOnPlatform(p, 40);

    // 3) Long platform “star trail” (reward line)
    p = addPlat(3200, 520, "L");
    addStarOnPlatform(p, 60);
    addStarOnPlatform(p, 160);
    addStarOnPlatform(p, 260);
    addHeartOnPlatform(p, 20);            // ❤️ Heart #1

    // 4) Vertical tower climb (harder)
    addPlat(5000, 560, "S");
    p = addPlat(5200, 480, "S");
    addStarOnPlatform(p, 40);
    addPlat(5400, 400, "S");
    p = addPlat(5600, 320, "S");
    addStarOnPlatform(p, 40);

    // 5) Over the big ground gap (forces sprint jump feel)
    p = addPlat(6150, 520, "M");
    addStarOnPlatform(p, 80);
    p = addPlat(6600, 480, "M");
    addStarOnPlatform(p, 80);
    addHeartOnPlatform(p, 90);            // ❤️ Heart #2
    p = addPlat(7050, 520, "M");
    addStarOnPlatform(p, 80);

    // 6) End zig-zag (keeps player moving)
    p = addPlat(9000, 520, "M");
    addStarOnPlatform(p, 80);
    p = addPlat(9350, 440, "S");
    addStarOnPlatform(p, 40);
    p = addPlat(9650, 520, "M");
    addStarOnPlatform(p, 80);

    // 7) Goal platform (final reward cluster)
    p = addPlat(11200, 520, "L");
    addStarOnPlatform(p, 120);
    addStarOnPlatform(p, 180);
    addStarOnPlatform(p, 240);
    addHeartOnPlatform(p, 20);            // ❤️ Heart #3
    //#endregion

    //#region ENEMIES
    // ----- Enemies -----
    const S = 2.3;

    this.enemyDefs.push({ type: "ghost1", x: 520, y: 650 - 128 * S, patrolMinX: 300, patrolMaxX: 760, scale: S });
    this.enemyDefs.push({ type: "ghost1", x: 3600, y: 520 - 128 * S, patrolMinX: 3300, patrolMaxX: 3950, scale: S, chaseRange: 480 });
    this.enemyDefs.push({ type: "ghost1", x: 2100, y: 480 - 128 * S, patrolMinX: 1850, patrolMaxX: 2400, scale: S, chaseRange: 420 });
    this.enemyDefs.push({ type: "ghost1", x: 7050, y: 520 - 128 * S, patrolMinX: 6800, patrolMaxX: 7400, scale: S, chaseRange: 520 });
    this.enemyDefs.push({ type: "ghost1", x: 10650, y: 650 - 128 * S, patrolMinX: 10450, patrolMaxX: 10950, scale: S, chaseRange: 520, stopChaseRange: 620 });
    this.enemyDefs.push({ type: "ghost1", x: 11050, y: 650 - 128 * S, patrolMinX: 10880, patrolMaxX: 11200, scale: S, chaseRange: 520, stopChaseRange: 650 });
    //#endregion
  }

  // -------------------- LEVEL 2-1 (NightFall) --------------------
  build2_1(addGround, addPlat, addStarOnPlatform, addHeartOnPlatform) {
    //#region TERRAIN (Ground + Platforms + Pickups)
    // Level 2-1 is now a longer puzzle-run (intended for ~2:00 timer)
    // More stars, more stair / rhythm chains like your 3-1 style.

    // -------------------- Ground layout (extended) --------------------
    addGround(0, 950);        // 0..950
    addGround(1320, 920);     // 1320..2240
    addGround(2600, 1100);    // 2600..3700
    addGround(4050, 950);     // 4050..5000
    addGround(5350, 1200);    // 5400..6600
    addGround(8300, 1600);    // 8300..9900
    addGround(13000, 1100);   // 13000..14100
    addGround(14450, 950);    // 14550..15500
    addGround(15900, 1200);   // 15900..17100
    addGround(17500, 1350);   // 17500..18850

    let p;

    // -------------------- Puzzle sections --------------------

    // 1) “Moon steps” (warmup)
    p = addPlat(520, 560, "S"); addStarOnPlatform(p, 40);
    addPlat(690, 520, "S");
    p = addPlat(860, 480, "S"); addStarOnPlatform(p, 40);

    // 2) Shadow hop chain (over early gap)
    p = addPlat(1180, 500, "M"); addStarOnPlatform(p, 80);
    p = addPlat(1480, 440, "S"); addStarOnPlatform(p, 40);
    p = addPlat(1720, 380, "S"); addStarOnPlatform(p, 40);
    addHeartOnPlatform(p, 40);

    // 3) Long “night bridge” star trail
    p = addPlat(2850, 520, "L");
    addStarOnPlatform(p, 60);
    addStarOnPlatform(p, 160);
    addStarOnPlatform(p, 260);

    // 4) “Falling comet” stagger (YOUR STYLE)
    p = addPlat(4200, 250, "M"); addStarOnPlatform(p, 80);
    p = addPlat(4550, 300, "S"); addStarOnPlatform(p, 40);
    p = addPlat(4800, 300, "S"); addStarOnPlatform(p, 40);
    p = addPlat(5050, 200, "S"); addStarOnPlatform(p, 40);

    // 5) Dark tower climb
    addPlat(5370, 200, "S");
    addPlat(5750, 265, "S");
    p = addPlat(5950, 520, "S"); addStarOnPlatform(p, 40);
    addPlat(6100, 400, "S");
    p = addPlat(6350, 320, "S"); addStarOnPlatform(p, 40);
    addHeartOnPlatform(p, 40);

    // 6) Big gap triple (clean sprint-jump chain)
    p = addPlat(6850, 450, "M"); addStarOnPlatform(p, 80);
    p = addPlat(7150, 520, "M"); addStarOnPlatform(p, 80);
    p = addPlat(7600, 470, "M"); addStarOnPlatform(p, 80);
    p = addPlat(7750, 520, "M"); addStarOnPlatform(p, 80);

    // 7) End zig-zag (tight rhythm)
    p = addPlat(9500, 520, "M"); addStarOnPlatform(p, 80);
    p = addPlat(9850, 440, "S"); addStarOnPlatform(p, 40);
    p = addPlat(10150, 360, "S"); addStarOnPlatform(p, 40);
    p = addPlat(10450, 440, "S"); addStarOnPlatform(p, 40);
    p = addPlat(10800, 520, "M"); addStarOnPlatform(p, 80);
    p = addPlat(11200, 480, "M"); addStarOnPlatform(p, 80);
    p = addPlat(11600, 460, "M"); addStarOnPlatform(p, 80);
    p = addPlat(12000, 460, "M");

    // 8) Mid “reward” platform (NOT the end anymore)
    p = addPlat(12400, 520, "L");
    addStarOnPlatform(p, 60);
    addStarOnPlatform(p, 160);
    addStarOnPlatform(p, 260);
    addHeartOnPlatform(p, 20);

    // -------------------- NEW puzzle extension --------------------

    // 9) Gap-bridge ladder (makes the new gap feel “puzzle”, not just distance)
    p = addPlat(12750, 560, "S"); addStarOnPlatform(p, 40);
    p = addPlat(12920, 520, "S"); addStarOnPlatform(p, 40);
    p = addPlat(13110, 480, "S"); addStarOnPlatform(p, 40);
    p = addPlat(13290, 390, "S"); addStarOnPlatform(p, 40);
    p = addPlat(14430, 200, "S"); addStarOnPlatform(p, 40);

    // 10) High runway (reward for climbing)
    p = addPlat(13680, 200, "L");
    addStarOnPlatform(p, 60);
    addStarOnPlatform(p, 160);
    addStarOnPlatform(p, 260);

    // 11) “Puzzle weave” (same vibe as your snippet)
    p = addPlat(14650, 320, "S");
    p = addPlat(14850, 590, "M"); addStarOnPlatform(p, 80);
    p = addPlat(14980, 410, "S"); addStarOnPlatform(p, 40);
    p = addPlat(15230, 350, "S"); addStarOnPlatform(p, 40);
    p = addPlat(15480, 410, "S"); addStarOnPlatform(p, 40);
    p = addPlat(15710, 480, "M"); addStarOnPlatform(p, 80);

    // 12) Second tower climb (bigger “puzzle” moment)
    addPlat(16050, 560, "S");
    p = addPlat(16240, 500, "S"); addStarOnPlatform(p, 40);
    p = addPlat(16430, 440, "S"); addStarOnPlatform(p, 40);
    p = addPlat(16620, 380, "S"); addStarOnPlatform(p, 40);
    p = addPlat(16810, 320, "S"); addStarOnPlatform(p, 40);
    p = addPlat(17000, 260, "M"); addStarOnPlatform(p, 80);

    // 13) Final reward cluster (end of the longer level)
    p = addPlat(18350, 520, "L");
    addStarOnPlatform(p, 60);
    addStarOnPlatform(p, 140);
    addStarOnPlatform(p, 220);
    addStarOnPlatform(p, 300);
    //#endregion

    //#region ENEMIES
    // -------------------- Enemies (keep your old pacing + add a couple new ones) --------------------
    const S = 2.3;

    // early patrol
    this.enemyDefs.push({
      type: "ghost1",
      x: 650,
      y: 650 - 128 * S,
      patrolMinX: 420,
      patrolMaxX: 880,
      scale: S,
      chaseRange: 420
    });

    // long bridge guard
    this.enemyDefs.push({
      type: "ghost1",
      x: 3100,
      y: 520 - 128 * S,
      patrolMinX: 2850,
      patrolMaxX: 3400,
      scale: S,
      chaseRange: 520,
      stopChaseRange: 620
    });

    // 1) Mid stretch (around the 5350..6600 land)
    this.enemyDefs.push({
      type: "ghost2",
      x: 4300,
      y: 650 - 128 * S,
      patrolMinX: 5450,
      patrolMaxX: 6550,
      scale: S,
      patrolSpeed: 150,
      chaseSpeed: 270,
      chaseRange: 620,
      stopChaseRange: 820,
      attackRange: 115
    });

    // long bridge guard
    this.enemyDefs.push({
      type: "ghost1",
      x: 5700,
      y: 520 - 128 * S,
      patrolMinX: 5750,
      patrolMaxX: 5800,
      scale: S,
      chaseRange: 520,
      stopChaseRange: 620
    });

    this.enemyDefs.push({
      type: "ghost2",
      x: 9100,
      y: 650 - 128 * S,
      patrolMinX: 8450,
      patrolMaxX: 9750,
      scale: S,
      chaseRange: 680,
      stopChaseRange: 820
    });

    // 2) Big long land (8300..9900)
    this.enemyDefs.push({
      type: "ghost2",
      x: 9100,
      y: 650 - 128 * S,
      patrolMinX: 8450,
      patrolMaxX: 9750,
      scale: S,
      patrolSpeed: 155,
      chaseSpeed: 320,
      chaseRange: 650,
      stopChaseRange: 850,
      attackRange: 115
    });


    // mid ground hunter
    this.enemyDefs.push({
      type: "ghost1",
      x: 8950,
      y: 650 - 128 * S,
      patrolMinX: 8950,
      patrolMaxX: 8800,
      scale: S,
      chaseRange: 520
    });

    // NEW: ghost2 mid-section (adds action around the big gap chain)
    this.enemyDefs.push({
      type: "ghost2",
      x: 8950,
      y: 650 - 128 * S,
      patrolMinX: 6800,
      patrolMaxX: 7600,
      scale: S,
      chaseRange: 650,
      stopChaseRange: 780
    });

    // NEW: ghost2 near the end tower / final push
    this.enemyDefs.push({
      type: "ghost2",
      x: 16220,
      y: 650 - 128 * S,
      patrolMinX: 16250,
      patrolMaxX: 16850,
      scale: S,
      chaseRange: 650
    });

    // Optional final “guardian” (remove if too hard)
    this.enemyDefs.push({
      type: "ghost2",
      x: 18350,
      y: 650 - 128 * S,
      patrolMinX: 17950,
      patrolMaxX: 18600,
      scale: S,
      chaseRange: 700
    });

    // Optional final “guardian” (remove if too hard)
    this.enemyDefs.push({
      type: "ghost2",
      x: 18250,
      y: 650 - 128 * S,
      patrolMinX: 18250,
      patrolMaxX: 18300,
      scale: S,
      chaseRange: 700
    });

    // ghost2 on the left medium platform
    this.enemyDefs.push({
      type: "ghost2",
      x: 9490,
      y: 520 - 128 * 1.8,
      patrolMinX: 9450,
      patrolMaxX: 9530,
      scale: 1.8,
      chaseRange: 600,
      stopChaseRange: 760
    });

    // ghost2 on the right medium platform
    this.enemyDefs.push({
      type: "ghost2",
      x: 11190,
      y: 480 - 128 * 1.8,
      patrolMinX: 11150,
      patrolMaxX: 11230,
      scale: 1.8,
      chaseRange: 600,
      stopChaseRange: 760
    });
    //#endregion
  }

  // -------------------- LEVEL 3-1 (Lucid) MIXED LAND + VOID + PUZZLES --------------------
  build3_1(addGround, addPlat, addStarOnPlatform, addHeartOnPlatform) {
    //#region TERRAIN (Ground + Platforms + Pickups)
    // 3-1 goal: 3:00 timer (set in main.js) and 64 stars
    // Mix of land + void + puzzle chains inspired by 2-1 & 3-1.

    // -------------------- Ground layout (LAND chunks with VOID gaps) --------------------
    addGround(0, 1200);       // start land
    // gap
    addGround(1600, 1200);    // land
    // gap
    addGround(3400, 1600);    // land (supports your 3350 staircase section)
    // gap
    addGround(5500, 1400);    // land (supports mid puzzle)
    // gap
    addGround(7600, 1700);    // land
    // gap
    addGround(9800, 1600);    // land
    // addGround(14600, 1900);   // land
    // gap
    addGround(17200, 2600);   // final land runway

    let p;

    // -------------------- Star counter helpers (guarantee EXACT 64) --------------------
    let starCount = 0;
    const STAR = (plat, off, yOff = 10) => {
      addStarOnPlatform(plat, off, yOff);
      starCount++;
    };
    const TRAIL = (plat, offsets, yOff = 10) => {
      for (const o of offsets) STAR(plat, o, yOff);
    };

    // ============================================================
    // SECTION A (8 stars): intro soft steps (land)
    // ============================================================
    p = addPlat(520, 560, "S"); STAR(p, 40);
    p = addPlat(700, 520, "S"); STAR(p, 40);
    p = addPlat(880, 480, "S"); STAR(p, 40);

    p = addPlat(1150, 520, "M"); STAR(p, 40); STAR(p, 130);
    p = addPlat(1450, 520, "M"); STAR(p, 80);
    p = addPlat(1750, 480, "S"); STAR(p, 40);

    // Heart #1 (early)
    addHeartOnPlatform(p, 40);

    // ============================================================
    // SECTION B (8 stars): your 3-1 staircase snippet (land -> gap vibe)
    // (this is EXACTLY the one you asked for)
    // ============================================================
    p = addPlat(3050, 520, "M"); STAR(p, 80);
    p = addPlat(3700, 520, "S"); STAR(p, 40);
    p = addPlat(3950, 390, "S"); STAR(p, 40);
    p = addPlat(3950, 650, "S"); STAR(p, 40);
    p = addPlat(4450, 650, "S"); STAR(p, 40);
    p = addPlat(4200, 340, "S"); STAR(p, 40);
    p = addPlat(4200, 650, "S"); STAR(p, 40);

    // add 4 more stars on nearby platforms to make this section 8 total
    p = addPlat(4500, 420, "M"); STAR(p, 40); STAR(p, 130);
    p = addPlat(4900, 520, "M"); STAR(p, 80);

    // ============================================================
    // SECTION C (12 stars): 2-1 “Falling comet” + mini tower (VOID skill)
    // (your exact pattern + a few extra to reach 12)
    // ============================================================
    p = addPlat(6200, 200, "M"); STAR(p, 80);
    p = addPlat(6550, 200, "S"); STAR(p, 40);
    p = addPlat(6800, 230, "S"); STAR(p, 40);
    p = addPlat(7050, 200, "S"); STAR(p, 40);

    addPlat(7320, 200, "S");
    addPlat(7220, 650, "S");
    addPlat(7750, 265, "S");

    p = addPlat(7950, 520, "S"); STAR(p, 40);
    addPlat(8100, 400, "S");
    p = addPlat(8350, 320, "S"); STAR(p, 40);
    p = addPlat(8350, 650, "S"); STAR(p, 40);

    // extra stars to make the section feel rewarding
    p = addPlat(8600, 470, "M"); STAR(p, 80);
    p = addPlat(8900, 520, "M"); STAR(p, 80);
    p = addPlat(9200, 470, "M"); STAR(p, 80);
    p = addPlat(9500, 520, "M"); STAR(p, 80);

    // ============================================================
    // SECTION D (16 stars): long mixed chain + zig-zag (land + void mix)
    // (uses your big chain style; stars are controlled)
    // ============================================================
    p = addPlat(10200, 520, "M"); STAR(p, 80);
    p = addPlat(10550, 480, "S"); STAR(p, 40);
    p = addPlat(10850, 360, "S"); STAR(p, 40);
    p = addPlat(10850, 650, "S"); STAR(p, 40);
    p = addPlat(11150, 480, "S"); STAR(p, 40);
    p = addPlat(11480, 520, "M"); STAR(p, 80);

    addHeartOnPlatform(p, 90);

    p = addPlat(11820, 480, "M"); STAR(p, 80);
    p = addPlat(12300, 670, "M"); STAR(p, 80);
    p = addPlat(12820, 670, "M"); STAR(p, 80);

    // reward long platform (3 stars)
    p = addPlat(12900, 200, "L");
    TRAIL(p, [60, 160, 260]);

    p = addPlat(12775, 10, "S");
    p = addPlat(12775, 75, "S");
    p = addPlat(12775, 150, "S");

    // ladder into high runway (4 stars)
    p = addPlat(13350, 680, "S"); STAR(p, 40);
    p = addPlat(13800, 680, "S"); STAR(p, 40);
    p = addPlat(14280, 680, "S"); STAR(p, 40);
    p = addPlat(14680, 680, "S"); STAR(p, 40);

    // high runway (3 stars)
    p = addPlat(14280, 200, "M");
    TRAIL(p, [60, 160, 260]);

    p = addPlat(15050, 680, "M"); STAR(p, 80);
    p = addPlat(15430, 675, "S"); STAR(p, 40);
    p = addPlat(15910, 675, "M"); STAR(p, 80);

    p = addPlat(16440, 675, "S"); STAR(p, 40);
    addHeartOnPlatform(p, 20);
    p = addPlat(16820, 675, "S"); STAR(p, 40);

    // reward platform (4 stars)
    p = addPlat(19050, 520, "L");
    TRAIL(p, [60, 140, 220, 300]);

    addHeartOnPlatform(p, 20);

    // going left
    p = addPlat(19200, 250, "S"); STAR(p, 40);
    p = addPlat(19450, 460, "S");
    p = addPlat(19600, 390, "S"); STAR(p, 40);

    // ------------------------------------------------------------
    // CONSTANT y=200 PATH from ~12900 -> 18750 (mix of S and M)
    // (Paste this after: p = addPlat(12900, 200, "M"); ...)
    // ------------------------------------------------------------
    p = addPlat(13180, 200, "S");
    p = addPlat(13300, 200, "M");
    p = addPlat(13700, 200, "S");
    p = addPlat(13800, 200, "M");
    p = addPlat(14080, 200, "S");
    p = addPlat(14200, 200, "S");
    p = addPlat(14500, 200, "M");
    p = addPlat(14800, 200, "S");
    p = addPlat(15080, 200, "M");
    p = addPlat(15400, 200, "S");
    p = addPlat(15700, 200, "M");
    p = addPlat(16000, 200, "S");
    p = addPlat(16380, 200, "M");
    p = addPlat(16700, 200, "M"); // 380
    p = addPlat(17000, 200, "S");
    p = addPlat(17320, 200, "S");
    p = addPlat(17520, 200, "M");
    addHeartOnPlatform(p, 20);
    p = addPlat(17800, 200, "S");
    p = addPlat(18200, 200, "S");
    p = addPlat(18580, 200, "S"); // last connector (small gap into finish pads)

    // your finish pads (keep yours)
    p = addPlat(18750, 200, "S");
    p = addPlat(18850, 200, "S");
    p = addPlat(18950, 200, "S");
    //#endregion

    //#region ENEMIES
    // ------------------------------------------------------------
    // Enemies (keep your Ghost3 boss near late section)
    // ------------------------------------------------------------
    const S = 2.3;
    // ------------------------------------------------------------
    // Extra enemies for 3-1 endgame
    // - 2x Ghost3 on the TWO "3-star" platforms (TRAIL [60,160,260])
    // - 3x Ghost2 on the bottom (ground level)
    // - 1x Ghost1 on the top path at y=200 near the end of the 4-star reward area
    // ------------------------------------------------------------
    const G3 = 2.0;   // ghost3 scale
    const G2 = 2.0;   // ghost2 scale
    const G1 = 2.3;   // ghost1 scale

    // 2x Ghost3 guarding the 3-star platforms
    // 3-star platform #1: p = addPlat(12900, 225, "M"); TRAIL(p,[60,160,260])
    this.enemyDefs.push({
      type: "ghost3",
      x: 12960,
      y: 225 - 128 * G3,
      patrolMinX: 12880,
      patrolMaxX: 13100,
      scale: G3,
      patrolSpeed: 170,
      chaseSpeed: 310,
      chaseRange: 750,
      stopChaseRange: 950,
      attackRange: 130,
      jumpVelocity: -980,
      jumpCooldownTime: 0.80,
      startAsleep: true,
      wakeRange: 600,
      wakeYMin: 160,
      wakeYMax: 260
    });

    this.enemyDefs.push({
      type: "ghost3",
      x: 6510,
      y: 200 - 128 * G3,
      patrolMinX: 6550,
      patrolMaxX: 6600,
      scale: G3,
      patrolSpeed: 170,
      chaseSpeed: 310,
      chaseRange: 750,
      stopChaseRange: 950,
      attackRange: 130,
      jumpVelocity: -980,
      jumpCooldownTime: 0.80,
      startAsleep: true,
      wakeRange: 600,
      wakeYMin: 160,
      wakeYMax: 260
    });

    // 3-star platform #2: p = addPlat(14280, 200, "M"); TRAIL(p,[60,160,260])
    this.enemyDefs.push({
      type: "ghost3",
      x: 14340,
      y: 200 - 128 * G3,
      patrolMinX: 14260,
      patrolMaxX: 14480,
      scale: G3,
      patrolSpeed: 170,
      chaseSpeed: 310,
      chaseRange: 750,
      stopChaseRange: 950,
      attackRange: 130,
      jumpVelocity: -980,
      jumpCooldownTime: 0.80,
      startAsleep: true,
      wakeRange: 600,
      wakeYMin: 160,
      wakeYMax: 260
    });

    this.enemyDefs.push({
      type: "ghost2",
      x: 18250,
      y: 650 - 128 * G2,
      patrolMinX: 17980,
      patrolMaxX: 18650,
      scale: G2,
      patrolSpeed: 150,
      chaseSpeed: 260,
      chaseRange: 600,
      stopChaseRange: 780,
      attackRange: 115
    });

    // 1x Ghost1 on the TOP path at y=200 near the end of the 4-star reward zone
    // (guards the end approach near the finish pads)
    this.enemyDefs.push({
      type: "ghost1",
      x: 18820,
      y: 200 - 128 * G1,
      patrolMinX: 18680,
      patrolMaxX: 19020,
      scale: G1,
      chaseRange: 560,
      stopChaseRange: 720
    });

    this.enemyDefs.push({
      type: "ghost3",
      x: 18750,
      y: 520 - 128 * G3,
      patrolMinX: 18650,
      patrolMaxX: 19550,
      scale: G3,
      patrolMinX: 18650,
      patrolMaxX: 19550,
      scale: G3,
      patrolSpeed: 220,
      chaseSpeed: 420,
      chaseRange: 750,
      stopChaseRange: 950,
      attackRange: 130,
      jumpVelocity: -1180,
      jumpCooldownTime: 0.80
    });

    this.enemyDefs.push({
      type: "ghost1",
      x: 1800,
      y: 650 - 128 * S,
      patrolMinX: 1600,
      patrolMaxX: 2200,
      scale: S,
      chaseRange: 520
    });

    this.enemyDefs.push({
      type: "ghost3",
      x: 19000,
      y: 520 - 128 * G3,
      patrolMinX: 18650,
      patrolMaxX: 19550,
      scale: G3,
      patrolMinX: 18650,
      patrolMaxX: 19550,
      scale: G3,
      patrolSpeed: 220,
      chaseSpeed: 420,
      chaseRange: 750,
      stopChaseRange: 950,
      attackRange: 130,
      jumpVelocity: -1180,
      jumpCooldownTime: 0.80
    });

    this.enemyDefs.push({
      type: "ghost2",
      x: 9800,
      y: 650 - 128 * 1.8,
      patrolMinX: 9500,
      patrolMaxX: 10300,
      scale: 1.8,
      chaseRange: 650
    });

    this.enemyDefs.push({
      type: "ghost3",
      x: 3950,
      y: 390 - 128 * G3,
      patrolMinX: 3950,
      patrolMaxX: 4010,
      scale: G3,
      patrolSpeed: 220,
      chaseSpeed: 420,
      chaseRange: 750,
      stopChaseRange: 950,
      attackRange: 130,
      jumpVelocity: -1180,
      jumpCooldownTime: 0.80
    });

    this.enemyDefs.push({
      type: "ghost3",
      x: 18450,
      y: 520 - 128 * G3,
      patrolMinX: 18650,
      patrolMaxX: 19550,
      scale: G3,
      patrolSpeed: 220,
      chaseSpeed: 420,
      chaseRange: 750,
      stopChaseRange: 950,
      attackRange: 130,
      jumpVelocity: -1180,
      jumpCooldownTime: 0.80
    });

    // FIXED: ghost1 in section C stays on the 6200 medium platform
    this.enemyDefs.push({
      type: "ghost1",
      x: 6150,
      y: 200 - 128 * G1,
      patrolMinX: 6135,
      patrolMaxX: 6190,
      scale: G1,
      chaseRange: 560,
      stopChaseRange: 720
    });

    // FIXED: ghost2 placed safely on the 15050 medium platform
    this.enemyDefs.push({
      type: "ghost2",
      x: 15020,
      y: 680 - 128 * G2,
      patrolMinX: 14995,
      patrolMaxX: 15060,
      scale: G2,
      patrolSpeed: 150,
      chaseSpeed: 260,
      chaseRange: 600,
      stopChaseRange: 780,
      attackRange: 115
    });

    // FIXED: second bottom ghost2 moved from the tiny 16820 S platform
    // to the safer 15910 M platform
    this.enemyDefs.push({
      type: "ghost2",
      x: 15880,
      y: 675 - 128 * G2,
      patrolMinX: 15850,
      patrolMaxX: 15920,
      scale: G2,
      patrolSpeed: 150,
      chaseSpeed: 260,
      chaseRange: 600,
      stopChaseRange: 780,
      attackRange: 115
    });

    // FIXED: ground ghost1 now patrols only on the final runway
    this.enemyDefs.push({
      type: "ghost1",
      x: 18400,
      y: 650 - 128 * 1.8,
      patrolMinX: 17650,
      patrolMaxX: 19450,
      scale: 1.8,
      chaseRange: 650,
      stopChaseRange: 800
    });

    // FIXED: late ghost3 correctly placed on the 12900 high runway
    // (or remove this entirely if you only want one ghost3 there)
    this.enemyDefs.push({
      type: "ghost3",
      x: 12950,
      y: 200 - 128 * G3,
      patrolMinX: 12910,
      patrolMaxX: 13080,
      scale: G3,
      patrolSpeed: 220,
      chaseSpeed: 420,
      chaseRange: 750,
      stopChaseRange: 950,
      attackRange: 130,
      jumpVelocity: -1180,
      jumpCooldownTime: 0.80
    });
    //#endregion
  }

  update() {
    const dt = this.game.clockTick;

    for (const st of this.stars) {
      if (st.taken) continue;

      // one-time init
      if (st.baseY == null) st.baseY = st.y;                 // original placement
      if (st.floatT == null) st.floatT = 0;                 // timer
      if (st.floatPhase == null) st.floatPhase = Math.random() * Math.PI * 2;

      // tweak these for feel
      const amp = st.floatAmp ?? 7;       // pixels up/down
      const speed = st.floatSpeed ?? 3.2; // radians/sec (higher = faster bob)

      st.floatT += dt;
      st.y = st.baseY + Math.sin(st.floatT * speed + st.floatPhase) * amp;
    }
  }

  draw(ctx) {
    // Draw platforms
    for (const p of this.platforms) {
      if (!p.img) continue; // invisible border walls
      const img = ASSET_MANAGER.getAsset(p.img);
      if (!img) continue;
      const s = p.scale ?? 1;
      ctx.drawImage(img, p.x, p.y, p.w * s, p.h * s);
    }

    // Draw stars
    const starImg = ASSET_MANAGER.getAsset("./assets/items/Star.png");
    for (const st of this.stars) {
      if (st.taken) continue;
      if (starImg) ctx.drawImage(starImg, st.x, st.y, st.w, st.h);
    }

    // Draw hearts (floating)
    const t = this.game?.timer?.gameTime ?? 0;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const h of this.hearts) {
      if (h.taken) continue;

      const bob = Math.sin(t * (h.floatSpeed ?? 3) + (h.phase ?? 0)) * (h.floatAmp ?? 7);
      const drawY = (h.baseY ?? h.y) + bob;

      // Use a nice simple heart glyph (no asset needed)
      ctx.font = `${Math.round(h.h)}px Arial`;
      ctx.fillStyle = "rgb(255, 80, 120)";
      ctx.fillText("♥", h.x + h.w / 2, drawY + h.h / 2);
    }

    ctx.restore();
  }

  spawnEnemies(game) {
    const list = [];
    for (const d of this.enemyDefs) {
      if (d.type === "ghost1") list.push(new Ghost1(game, d.x, d.y, d));
      if (d.type === "ghost2") list.push(new Ghost2(game, d.x, d.y, d));
      if (d.type === "ghost3") list.push(new Ghost3(game, d.x, d.y, d));
    }
    return list;
  }
}