const gameEngine = new GameEngine();
const ASSET_MANAGER = new AssetManager();
const PERSIST_UNLOCKS = true; // set true if you want progress saved between launches

// -------------------- LEVEL UNLOCK PROGRESS --------------------
const PROGRESS_KEY = "mini_oneironaut_progress_v1";

function loadUnlocked() {
  const base = { "1-1": true, "2-1": false, "3-1": false };
  if (!PERSIST_UNLOCKS) return base;

  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return { ...base, ...parsed, "1-1": true };
  } catch {
    return base;
  }
}

function saveUnlocked(unlocked) {
  if (!PERSIST_UNLOCKS) return;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(unlocked));
  } catch { }
}

// -------------------- Assets --------------------
// NOTE: GitHub Pages is case-sensitive.
// Your other files load ".png" (ex: Level uses "./assets/terrains/FloorTerrainLeft.png") :contentReference[oaicite:3]{index=3}
// so we queue ".png" here too (avoid ".PNG" mismatches) :contentReference[oaicite:4]{index=4}

ASSET_MANAGER.queueDownload("./assets/background/OneironantBrothersWake.png"); // MENU background
ASSET_MANAGER.queueDownload("./assets/background/DayDream.png");              // 1-1
ASSET_MANAGER.queueDownload("./assets/background/NightFall.png");             // 2-1
ASSET_MANAGER.queueDownload("./assets/background/Lucid.png");                 // 3-1

ASSET_MANAGER.queueDownload("./assets/items/Star.png");

ASSET_MANAGER.queueDownload("./assets/entities/HeroIdle.png");
ASSET_MANAGER.queueDownload("./assets/entities/HeroWalk.png");
ASSET_MANAGER.queueDownload("./assets/entities/HeroJump.png");
ASSET_MANAGER.queueDownload("./assets/entities/HeroSprint.png");
ASSET_MANAGER.queueDownload("./assets/entities/HeroDamage.png");

ASSET_MANAGER.queueDownload("./assets/entities/ghost1.png");
ASSET_MANAGER.queueDownload("./assets/entities/ghost2.png");
ASSET_MANAGER.queueDownload("./assets/entities/ghost3.png");

ASSET_MANAGER.queueDownload("./assets/terrains/FloorTerrainLeft.png");
ASSET_MANAGER.queueDownload("./assets/terrains/FloorTerrainRight.png");
ASSET_MANAGER.queueDownload("./assets/terrains/LongTerrain.png");
ASSET_MANAGER.queueDownload("./assets/terrains/MediumTerrain.png");
ASSET_MANAGER.queueDownload("./assets/terrains/SmallTerrain.png");
ASSET_MANAGER.queueDownload("./assets/terrains/FloorTerrainLeftNightFall.png");
ASSET_MANAGER.queueDownload("./assets/terrains/FloorTerrainRightNightFall.png");
ASSET_MANAGER.queueDownload("./assets/terrains/SmallTerrainNightFall.png");
ASSET_MANAGER.queueDownload("./assets/terrains/MediumTerrainNightFall.png");
ASSET_MANAGER.queueDownload("./assets/terrains/LongTerrainNightFall.png");
ASSET_MANAGER.queueDownload("./assets/terrains/FloorTerrainLeftLucid.png");
ASSET_MANAGER.queueDownload("./assets/terrains/FloorTerrainRightLucid.png");
ASSET_MANAGER.queueDownload("./assets/terrains/SmallTerrainLucid.png");
ASSET_MANAGER.queueDownload("./assets/terrains/MediumTerrainLucid.png");
ASSET_MANAGER.queueDownload("./assets/terrains/LongTerrainLucid.png");

ASSET_MANAGER.downloadAll(() => {
  const canvas = document.getElementById("gameWorld");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  canvas.focus();

  // --- Music ---
  const music = new MusicManager("./assets/music/Mini-Oneironant.mp3", { loop: true, volume: 0.35 });
  gameEngine.music = music;
  music.installUnlock(canvas);

  // --- Load progress ---
  gameEngine.unlocked = loadUnlocked();

  // Called by HUD when the level is completed
  gameEngine.onLevelComplete = (levelId) => {
    const u = gameEngine.unlocked || loadUnlocked();

    // unlock chain
    if (levelId === "1-1") u["2-1"] = true;
    if (levelId === "2-1") u["3-1"] = true;

    u["1-1"] = true;
    gameEngine.unlocked = u;
    saveUnlocked(u);
  };

  const clearScene = () => {
    gameEngine.entities = [];
    gameEngine.cameraX = 0;
    gameEngine.player = null;
    gameEngine.level = null;

    for (const k in gameEngine.keys) gameEngine.keys[k] = false;
  };

  const showMenu = async () => {
    gameEngine.scene = "MENU";
    clearScene();
    // NEW RUN starts when you go back to Main Menu
    gameEngine.runActive = false;
    gameEngine.score = 0;
    gameEngine.levelStartScore = 0;
    // switch back to menu music when entering Main Menu
    if (gameEngine.music) {
      gameEngine.music.setTrack("./assets/music/Mini-Oneironant.mp3");
    }

    // menu music
    if (gameEngine.music) gameEngine.music.setTrack("./assets/music/Mini-Oneironant.mp3");

    // background only (NO HUD on menu)
    gameEngine.addEntity(new Background(gameEngine, "./assets/background/OneironantBrothersWake.png"));

    // menu UI
    gameEngine.addEntity(new MainMenu(gameEngine, {
      onPlay: showLevelSelect,
      onOptions: showOptions,
      onHelp: showHelp,
      onCredits: showCredits
    }));
  };

  gameEngine.goToMenu = showMenu;

  const showOptions = () => {
    gameEngine.scene = "OPTIONS";
    clearScene();

    gameEngine.addEntity(new Background(gameEngine, "./assets/background/OneironantBrothersWake.png"));
    gameEngine.addEntity(new OptionsMenu(gameEngine, { onBack: showMenu }));
  };

  const showHelp = () => {
    gameEngine.scene = "HELP";
    clearScene();

    gameEngine.addEntity(new Background(gameEngine, "./assets/background/OneironantBrothersWake.png"));
    gameEngine.addEntity(new HelpMenu(gameEngine, { onBack: showMenu }));
  };

  const showCredits = () => {
    gameEngine.scene = "CREDITS";
    clearScene();

    gameEngine.addEntity(new Background(gameEngine, "./assets/background/OneironantBrothersWake.png"));
    gameEngine.addEntity(new CreditsMenu(gameEngine, { onBack: showMenu }));
  };

  const showLevelSelect = () => {
    gameEngine.scene = "LEVEL_SELECT";
    clearScene();
    // switch back to menu music when entering Main Menu
    if (gameEngine.music) {
      gameEngine.music.setTrack("./assets/music/Mini-Oneironant.mp3");
    }

    gameEngine.addEntity(new Background(gameEngine, "./assets/background/OneironantBrothersWake.png"));

    // use real unlock progress (not hard-coded false)
    gameEngine.addEntity(new LevelSelectMenu(gameEngine, {
      unlocked: gameEngine.unlocked,
      onBack: showMenu,
      onSelect: (levelId) => startGame(levelId)
    }));
  };

  gameEngine.goToLevelSelect = showLevelSelect;

  const startGame = (levelId = "1-1") => {
    gameEngine.currentLevelId = levelId;
    // per-level timer (seconds)
    gameEngine.levelTimeLimit =
      (levelId === "2-1") ? 120 :
        (levelId === "3-1") ? 180 :
          60;

    // music per level (optional: add these mp3s if you have them)
    if (gameEngine.music) {
      if (levelId === "1-1") gameEngine.music.setTrack("./assets/music/Level 1-1.mp3");
      else if (levelId === "2-1") gameEngine.music.setTrack("./assets/music/Level 2-1.mp3");
      else if (levelId === "3-1") gameEngine.music.setTrack("./assets/music/Level 3-1.mp3");
      else gameEngine.music.setTrack("./assets/music/Mini-Oneironant.mp3");
    }

    const bgByLevel = {
      "1-1": "./assets/background/DayDream.png",
      "2-1": "./assets/background/NightFall.png",
      "3-1": "./assets/background/Lucid.png"
    };

    gameEngine.scene = "GAME";
    clearScene();

    // Level now takes levelId
    const level = new Level(gameEngine, levelId);
    gameEngine.level = level;

    // --- HUD stats reset per level ---
    gameEngine.starsCollected = 0;
    gameEngine.starsTotal = level.stars.length;

    // carry score across levels (only reset on a NEW RUN)
    if (gameEngine.score == null || !gameEngine.runActive) gameEngine.score = 0;
    gameEngine.runActive = true;

    // baseline score when entering this level (used for replay)
    gameEngine.levelStartScore = gameEngine.score;

    gameEngine.maxHP = 3;
    gameEngine.hp = gameEngine.maxHP;

    // floating text popups (ex: "+1 ♥")
    gameEngine.uiPopups = [];

    gameEngine.fellOff = false;

    // allow HUD to restart the current level
    gameEngine.restartLevel = () => {
      gameEngine.score = gameEngine.levelStartScore ?? gameEngine.score ?? 0;
      startGame(levelId);
    };

    const hero = new Hero(gameEngine);

    // spawn point per level (optional)
    if (typeof level.spawnX === "number") hero.spawnX = level.spawnX;
    if (typeof level.spawnY === "number") hero.spawnY = level.spawnY;
    hero.x = hero.spawnX;
    hero.y = hero.spawnY;

    gameEngine.player = hero;

    gameEngine.addEntity(new Background(gameEngine, bgByLevel[levelId] || "./assets/background/DayDream.png"));
    gameEngine.addEntity(level);
    gameEngine.addEntity(hero);

    // Spawn enemies defined by the level
    for (const e of level.spawnEnemies(gameEngine)) {
      gameEngine.addEntity(e);
    }

    // HUD only during GAME
    const hud = new HUD(gameEngine);
    hud.isUI = true;
    gameEngine.addEntity(hud);
  };

  gameEngine.init(ctx);
  showMenu();
  gameEngine.start();
});