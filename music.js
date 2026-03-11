// music.js
class MusicManager {
  constructor(src, { loop = true, volume = 0.35 } = {}) {
    this.currentTrack = encodeURI(src);

    this.audio = new Audio(this.currentTrack);
    this.audio.loop = loop;
    this.audio.volume = volume;
    this.audio.preload = "auto";

    this.enabled = true;
    this.unlocked = false;
  }

  async play() {
    if (!this.enabled) return;
    try {
      await this.audio.play();
    } catch (e) {
      // autoplay blocked until unlock
    }
  }

  pause() {
    this.audio.pause();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  setVolume(v) {
    this.audio.volume = Math.max(0, Math.min(1, v));
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.pause();
    else this.play();
  }

  // ✅ reliable: won't restart same track when returning to menu
  async setTrack(src) {
    const safeSrc = encodeURI(src);

    // If already on this track, do NOT restart
    if (this.currentTrack === safeSrc) {
      if (this.unlocked && this.enabled && this.audio.paused) {
        await this.play();
      }
      return;
    }

    const wasUnlocked = this.unlocked;
    const wasEnabled = this.enabled;

    const loop = this.audio.loop;
    const vol = this.audio.volume;

    this.stop();

    this.currentTrack = safeSrc;
    this.audio = new Audio(safeSrc);
    this.audio.loop = loop;
    this.audio.volume = vol;
    this.audio.preload = "auto";

    if (wasUnlocked && wasEnabled) {
      await this.play();
    }
  }

  installUnlock(target = window) {
    const unlock = async () => {
      if (this.unlocked) return;
      this.unlocked = true;
      await this.play();
      target.removeEventListener("pointerdown", unlock);
      target.removeEventListener("keydown", unlock);
    };

    target.addEventListener("pointerdown", unlock, { once: true });
    target.addEventListener("keydown", unlock, { once: true });

    window.addEventListener("keydown", (e) => {
      if (e.key === "m" || e.key === "M") this.toggleMute();
    });
  }
}