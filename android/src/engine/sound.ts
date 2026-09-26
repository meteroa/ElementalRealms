class SoundManager {
  private currentTrack: string = '';
  private bgmAudio: HTMLAudioElement | null = null;
  public enabled: boolean = true;
  public bgmEnabled: boolean = true;

  constructor() {
    this.setupUnlockListener();
    this.playBgm('menu1');
  }

  private setupUnlockListener() {
    const unlock = () => {
      if (this.bgmEnabled && this.enabled && this.bgmAudio && this.bgmAudio.paused) {
        this.bgmAudio.play().catch(() => {});
      }
    };

    ['click', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, unlock, { passive: true });
    });
  }

  public playBgm(track: string = 'menu1') {
    if (this.currentTrack === track && this.bgmAudio && !this.bgmAudio.paused) return;
    this.currentTrack = track;
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio = null;
    }
    try {
      this.bgmAudio = new Audio(`/audio/${track}.ogg`);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.35;
      if (this.enabled && this.bgmEnabled) {
        const p = this.bgmAudio.play();
        if (p !== undefined) {
          p.catch(() => {
            // Autoplay restricted until user interaction
          });
        }
      }
    } catch {}
  }

  public play(name: string) {
    if (!this.enabled) return;
    try {
      const soundFiles: Record<string, string> = {
        click: '/audio/btn1.ogg',
        btn: '/audio/btn2.ogg',
        summon: '/audio/summon1.ogg',
        summondrop: '/audio/summondrop.ogg',
        attack: '/audio/attack.ogg',
        boom: '/audio/boom.ogg',
        victory: '/audio/trumpet.ogg',
        defeat: '/audio/doombolt.ogg',
        flamewave: '/audio/flamewave.ogg',
        lightning: '/audio/lightningbolt.ogg',
        thunder: '/audio/calltothunder.ogg',
        acidicrain: '/audio/acidicrain.ogg',
        stonerain: '/audio/stonerain.ogg',
        heal: '/audio/healing.ogg',
        poison: '/audio/poison.ogg',
        ritual: '/audio/darkritual.ogg',
        armageddon: '/audio/Armageddon2.ogg',
        bloodritual: '/audio/BloodRitual.OGG',
        cursedfog: '/audio/CursedFog.OGG',
        disintegrate: '/audio/Disintegrate.ogg',
        divinejustice: '/audio/divJustice.ogg',
        divineintervention: '/audio/divineint.ogg',
        cannonade: '/audio/cannonade.ogg',
        chaowave: '/audio/chaowave.ogg',
        rats: '/audio/Army_Of_Rats.ogg',
      };

      const file = soundFiles[name] || `/audio/${name}.ogg`;
      const audio = new Audio(file);
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch {}
  }

  public startBgm() {
    if (!this.bgmAudio) {
      this.playBgm('combat1');
    } else if (this.enabled && this.bgmEnabled) {
      this.bgmAudio.play().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled && this.bgmAudio) {
      this.bgmAudio.pause();
    } else if (this.enabled && this.bgmAudio && this.bgmEnabled) {
      this.bgmAudio.play().catch(() => {});
    }
    return this.enabled;
  }

  public toggleBgm(): boolean {
    this.bgmEnabled = !this.bgmEnabled;
    if (!this.bgmEnabled && this.bgmAudio) {
      this.bgmAudio.pause();
    } else if (this.bgmEnabled && this.bgmAudio && this.enabled) {
      this.bgmAudio.play().catch(() => {});
    }
    return this.bgmEnabled;
  }
}

export const sound = new SoundManager();
