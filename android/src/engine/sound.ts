// Authentic Spectromancer Sound Engine ported from PC Sounds.ctl

interface SoundDef {
  file: string;
  volume?: number;
}

class SoundManager {
  private currentTrack: string = '';
  private bgmAudio: HTMLAudioElement | null = null;
  private plusBgmPlayer: any = null;
  private bgmSourceNode: AudioBufferSourceNode | null = null;
  private bgmGainNode: GainNode | null = null;
  private isWebAudioBgmPlaying: boolean = false;
  public enabled: boolean = true;
  public bgmEnabled: boolean = true;
  public bgmVolume: number = 0.65;
  public sfxVolume: number = 0.8;
  public combatBgmRate: number = 0.92;

  private audioPool: Map<string, HTMLAudioElement[]> = new Map();
  private audioCtx: AudioContext | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private bufferLoading: Map<string, Promise<AudioBuffer | null>> = new Map();

  // Master definitions mapped 1:1 from PC Sounds.ctl.
  // volume = PC "vol=" / 100 (PC default when omitted is 100). Values above 1 are
  // the PC boost requests (Blood Ritual 500, Nature's Fury 200, Inferno/Armageddon 150,
  // Stone Rain 120, Drain Souls 120); playback clamps them, exactly as the PC engine does.
  private readonly soundCatalog: Record<string, SoundDef> = {
    // UI & System
    click: { file: 'btn1.ogg', volume: 0.5 },
    btn: { file: 'btn2.ogg', volume: 0.5 },
    btn1: { file: 'btn1.ogg', volume: 0.5 },
    btn2: { file: 'btn2.ogg', volume: 0.5 },
    btn3: { file: 'btn3.ogg', volume: 0.6 },
    btn4: { file: 'btn4.ogg', volume: 0.25 },
    btn5: { file: 'btn5.ogg', volume: 0.3 },
    btnm: { file: 'btnm.ogg', volume: 0.9 },
    showeff1: { file: 'showeff1.ogg', volume: 1 },
    showeff2: { file: 'showeff2.ogg', volume: 0.3 },
    hideeff1: { file: 'hideeff1.ogg', volume: 1 },
    hideeff2: { file: 'hideeff2.ogg', volume: 0.3 },
    turntime: { file: 'turntime.ogg', volume: 1 },

    // Combat Basics
    summon: { file: 'summon1.ogg', volume: 0.5 },
    summon1: { file: 'summon1.ogg', volume: 0.5 },
    summondrop: { file: 'summondrop.ogg', volume: 1 },
    attack: { file: 'attack.ogg', volume: 1 },
    boom: { file: 'boom.ogg', volume: 1 },
    victory: { file: 'ritual_of_glory.ogg', volume: 0.85 },
    defeat: { file: 'doombolt.ogg', volume: 0.8 },

    // Authentic PC Spell Sounds (pc/Sounds.ctl)
    flamewave: { file: 'flamewave.ogg', volume: 1 },
    inferno: { file: 'inferno.ogg', volume: 1.5 },
    armageddon: { file: 'armageddon2.ogg', volume: 1.5 },
    armageddon2: { file: 'armageddon2.ogg', volume: 1.5 },
    calltothunder: { file: 'calltothunder.ogg', volume: 0.75 },
    lightningbolt: { file: 'lightningbolt.ogg', volume: 0.7 },
    lightning: { file: 'lightningbolt.ogg', volume: 0.7 },
    thunder: { file: 'calltothunder.ogg', volume: 0.75 },
    chainlightning: { file: 'chainlightning.ogg', volume: 1 },
    meditation: { file: 'meditation.ogg', volume: 0.35 },
    naturalfury: { file: 'naturalfury.ogg', volume: 2 },
    rejuvenation: { file: 'rejuvenation.ogg', volume: 1 },
    stonerain: { file: 'stonerain.ogg', volume: 1.2 },
    tornado: { file: 'tornado.ogg', volume: 1 },
    acidicrain: { file: 'acidicrain.ogg', volume: 1 },
    bloodritual: { file: 'bloodritual.ogg', volume: 5 },
    darkritual: { file: 'darkritual.ogg', volume: 0.9 },
    cursedfog: { file: 'cursedfog.ogg', volume: 1 },
    drainsoul: { file: 'drainsouls.ogg', volume: 1.2 },
    drainsouls: { file: 'drainsouls.ogg', volume: 1.2 },
    divineint: { file: 'divineint.ogg', volume: 0.25 },
    divineintervention: { file: 'divineint.ogg', volume: 0.25 },
    wrathofgod: { file: 'wrathofgod.ogg', volume: 1 },
    overtime: { file: 'overtime.ogg', volume: 0.4 },
    cannonade: { file: 'cannonade.ogg', volume: 0.8 },
    weakness: { file: 'weakness.ogg', volume: 0.5 },
    poisoncloud: { file: 'poisoncloud.ogg', volume: 0.5 },
    poisonouscloud: { file: 'poisoncloud.ogg', volume: 0.5 },
    doombolt: { file: 'doombolt.ogg', volume: 0.8 },
    madness: { file: 'madness.ogg', volume: 1 },
    madness2: { file: 'madness2.ogg', volume: 1 },
    hypnosys: { file: 'hypnosys.ogg', volume: 1 },
    hypnosis: { file: 'hypnosys.ogg', volume: 1 },
    naturerit: { file: 'naturerit.ogg', volume: 1 },
    naturesritual: { file: 'naturerit.ogg', volume: 1 },
    divjustice: { file: 'divjustice.ogg', volume: 1 },
    divinejustice: { file: 'divjustice.ogg', volume: 1 },
    chaowave: { file: 'chaowave.ogg', volume: 0.3 },
    chaoticwave: { file: 'chaowave.ogg', volume: 0.3 },
    rageofsouls: { file: 'rage_of_souls.ogg', volume: 1 },
    rage_of_souls: { file: 'rage_of_souls.ogg', volume: 1 },
    explosion: { file: 'explosion.ogg', volume: 0.35 },
    powerchains: { file: 'power_chains.ogg', volume: 1 },
    power_chains: { file: 'power_chains.ogg', volume: 1 },
    hellfire: { file: 'hellfire.ogg', volume: 0.4 },
    healingspray: { file: 'healing_spray.ogg', volume: 1 },
    healing_spray: { file: 'healing_spray.ogg', volume: 1 },
    fireball: { file: 'fireball.ogg', volume: 0.4 },
    stealessence: { file: 'steal_essence.ogg', volume: 0.4 },
    steal_essence: { file: 'steal_essence.ogg', volume: 0.4 },
    sacrifice: { file: 'sacrifice.ogg', volume: 1 },
    manaburn: { file: 'mana_burn.ogg', volume: 0.3 },
    mana_burn: { file: 'mana_burn.ogg', volume: 0.3 },
    ritualofglory: { file: 'ritual_of_glory.ogg', volume: 1 },
    ritual_of_glory: { file: 'ritual_of_glory.ogg', volume: 1 },
    sonicboom: { file: 'sonic_boom.ogg', volume: 0.5 },
    sonic_boom: { file: 'sonic_boom.ogg', volume: 0.5 },
    disintegrate: { file: 'disintegrate.ogg', volume: 0.35 },
    naturalhealing: { file: 'natural_healing.ogg', volume: 1 },
    natural_healing: { file: 'natural_healing.ogg', volume: 1 },
    poison: { file: 'poison.ogg', volume: 1 },
    enrage: { file: 'enrage.ogg', volume: 0.35 },
    pumpenergy: { file: 'pump_energy.ogg', volume: 0.3 },
    pump_energy: { file: 'pump_energy.ogg', volume: 0.3 },
    trumpet: { file: 'trumpet.ogg', volume: 0.4 },
    gaze: { file: 'gaze.ogg', volume: 0.5 },
    breathefire: { file: 'breathe_fire.ogg', volume: 1 },
    breathe_fire: { file: 'breathe_fire.ogg', volume: 1 },
    movefalcon: { file: 'move_falcon.ogg', volume: 0.4 },
    move_falcon: { file: 'move_falcon.ogg', volume: 0.4 },
    hasten: { file: 'hasten.ogg', volume: 0.5 },
    timestop: { file: 'time_stop.ogg', volume: 0.5 },
    time_stop: { file: 'time_stop.ogg', volume: 0.5 },
    rescueoperation: { file: 'rescue_operation.ogg', volume: 0.5 },
    rescue_operation: { file: 'rescue_operation.ogg', volume: 0.5 },
    armyofrats: { file: 'army_of_rats.ogg', volume: 0.5 },
    army_of_rats: { file: 'army_of_rats.ogg', volume: 0.5 },
    rats: { file: 'army_of_rats.ogg', volume: 0.5 },
    ritualoftheforest: { file: 'ritual_of_the_forest.ogg', volume: 0.5 },
    ritual_of_the_forest: { file: 'ritual_of_the_forest.ogg', volume: 0.5 },
    divinemeddling: { file: 'divinemed.ogg', volume: 0.6 },
    divinemed: { file: 'divinemed.ogg', volume: 0.6 },
    rageofgod: { file: 'rageofgod.ogg', volume: 1 },
    bloodboil: { file: 'bloodboil.ogg', volume: 1 },
    ancientspirits: { file: 'ancientspirits.ogg', volume: 0.6 },
    golemsfrenzy: { file: 'golemsfrenzy.ogg', volume: 1 },
    golemsjustice: { file: 'golemsjustice.ogg', volume: 1 },
    armyupgrade: { file: 'armyupgrade.ogg', volume: 1 },
    strenghtening: { file: 'strenghtening.ogg', volume: 0.8 },
    healing: { file: 'healing.ogg', volume: 1 },
    heal: { file: 'healing.ogg', volume: 1 },
    healingmini: { file: 'healingmini.ogg', volume: 0.8 },
    negativeeffect: { file: 'negativeeffect.ogg', volume: 0.8 },
    // PC fires PositiveEffect for stat/power increases that have no dedicated sample
    cast: { file: 'positiveeffect.ogg', volume: 0.8 },
    mana: { file: 'positiveeffect.ogg', volume: 0.8 },
    positiveeffect: { file: 'positiveeffect.ogg', volume: 0.8 },

    // Card ID Direct Mappings
    fire_flame_wave: { file: 'flamewave.ogg', volume: 1 },
    fire_inferno: { file: 'inferno.ogg', volume: 1.5 },
    water_acidic_rain: { file: 'acidicrain.ogg', volume: 1 },
    air_call_to_thunder: { file: 'calltothunder.ogg', volume: 0.75 },
    air_lightning_bolt: { file: 'lightningbolt.ogg', volume: 0.7 },
    air_chain_lightning: { file: 'chainlightning.ogg', volume: 1 },
    earth_natures_ritual: { file: 'naturerit.ogg', volume: 1 },
    earth_rejuvenation: { file: 'rejuvenation.ogg', volume: 1 },
    earth_stone_rain: { file: 'stonerain.ogg', volume: 1.2 },
    spec_healing_spray: { file: 'healing_spray.ogg', volume: 1 },
    spec_fireball: { file: 'fireball.ogg', volume: 0.4 },
    spec_steal_essence: { file: 'steal_essence.ogg', volume: 0.4 },
    spec_mana_burn: { file: 'mana_burn.ogg', volume: 0.3 },
    spec_disintegrate: { file: 'disintegrate.ogg', volume: 0.35 },
    spec_ritual_of_glory: { file: 'ritual_of_glory.ogg', volume: 1 },
    death_dark_ritual: { file: 'darkritual.ogg', volume: 0.9 },
    death_cursed_fog: { file: 'cursedfog.ogg', volume: 1 },
    death_blood_ritual: { file: 'bloodritual.ogg', volume: 5 },
    holy_divine_justice: { file: 'divjustice.ogg', volume: 1 },
    holy_divine_intervention: { file: 'divineint.ogg', volume: 0.25 },
    mech_cannonade: { file: 'cannonade.ogg', volume: 0.8 },
    ctrl_weakness: { file: 'weakness.ogg', volume: 0.5 },
    chaos_doom_bolt: { file: 'doombolt.ogg', volume: 0.8 },
    chaos_wave: { file: 'chaowave.ogg', volume: 0.3 },
    illus_madness: { file: 'madness.ogg', volume: 1 },
    demon_explosion: { file: 'explosion.ogg', volume: 0.35 },
    demon_power_chains: { file: 'power_chains.ogg', volume: 1 },
    demon_hellfire: { file: 'hellfire.ogg', volume: 0.4 },
    time_hasten: { file: 'hasten.ogg', volume: 0.5 },
    time_time_stop: { file: 'time_stop.ogg', volume: 0.5 },
    goblin_rescue_operation: { file: 'rescue_operation.ogg', volume: 0.5 },
    goblin_army_of_rats: { file: 'army_of_rats.ogg', volume: 0.5 },
  };

  constructor() {
    this.loadSettings();
    this.setupUnlockListener();
    this.preloadCoreSounds();
    this.playBgm('menu1');
  }

  private loadSettings() {
    try {
      const savedBgmVol = localStorage.getItem('sm_bgm_volume');
      if (savedBgmVol !== null) {
        const val = parseFloat(savedBgmVol);
        if (!isNaN(val) && val >= 0 && val <= 1) this.bgmVolume = val;
      }
      const savedSfxVol = localStorage.getItem('sm_sfx_volume');
      if (savedSfxVol !== null) {
        const val = parseFloat(savedSfxVol);
        if (!isNaN(val) && val >= 0 && val <= 1) this.sfxVolume = val;
      }
      const savedRate = localStorage.getItem('sm_combat_bgm_rate');
      if (savedRate !== null) {
        const val = parseFloat(savedRate);
        if (!isNaN(val) && val >= 0.7 && val <= 1.3) this.combatBgmRate = val;
      }
    } catch {}
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    return this.audioCtx;
  }

  private setupUnlockListener() {
    const unlock = () => {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (this.bgmEnabled && this.enabled) {
        if (!this.isWebAudioBgmPlaying && !this.plusBgmPlayer && (!this.bgmAudio || this.bgmAudio.paused)) {
          this.playBgm(this.currentTrack || 'menu1', true);
        }
      }
    };

    if (typeof window !== 'undefined') {
      ['click', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
        window.addEventListener(evt, unlock, { passive: true });
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          unlock();
        }
      });
    }

    if (typeof window !== 'undefined') {
      const onReady = () => {
        if (this.bgmEnabled && this.enabled) {
          this.playBgm(this.currentTrack || 'menu1');
        }
      };
      if ((window as any).plus) {
        onReady();
      } else {
        document.addEventListener('plusready', onReady, false);
      }

      // Auto-recovery watchdog: checks every 2.5s if BGM unexpectedly stopped or was muted by OS
      setInterval(() => {
        if (this.enabled && this.bgmEnabled && this.currentTrack) {
          const ctx = this.getAudioContext();
          if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          if (!this.isWebAudioBgmPlaying && !this.plusBgmPlayer && (!this.bgmAudio || this.bgmAudio.paused)) {
            this.playBgm(this.currentTrack, true);
          }
        }
      }, 2500);
    }
  }

  private getAudioUrl(filename: string): string {
    return `./audio/${filename.toLowerCase()}`;
  }

  private playWithPlus(file: string, vol?: number, isBgm: boolean = false): boolean {
    const w = typeof window !== 'undefined' ? (window as any) : null;
    if (!w || !w.plus || !w.plus.audio) return false;

    try {
      const cleanFile = file.toLowerCase();
      const primaryPath = `_www/audio/${cleanFile}`;
      const player = w.plus.audio.createPlayer(primaryPath);
      if (!player) return false;

      const effectiveVol = vol !== undefined ? vol : (isBgm ? ((this.enabled && this.bgmEnabled) ? this.bgmVolume : 0) : (0.8 * this.sfxVolume));
      if (typeof player.setVolume === 'function') {
        player.setVolume(effectiveVol);
      }

      if (isBgm) {
        if (this.plusBgmPlayer) {
          try { this.plusBgmPlayer.stop(); } catch {}
          try { this.plusBgmPlayer.close(); } catch {}
          this.plusBgmPlayer = null;
        }
        this.plusBgmPlayer = player;
        const onBgmEnd = () => {
          if (this.plusBgmPlayer === player && this.enabled && this.bgmEnabled) {
            try {
              try { player.stop(); } catch {}
              try { player.close(); } catch {}
            } catch {}
            this.plusBgmPlayer = null;
            setTimeout(() => {
              if (this.enabled && this.bgmEnabled && !this.plusBgmPlayer) {
                this.playWithPlus(file, undefined, true);
              }
            }, 50);
          }
        };
        player.play(onBgmEnd, () => {
          const altPlayer = w.plus.audio.createPlayer(`audio/${cleanFile}`);
          if (altPlayer) {
            this.plusBgmPlayer = altPlayer;
            altPlayer.play(onBgmEnd, () => {
              try { altPlayer.close(); } catch {}
              this.plusBgmPlayer = null;
              this.playHtml5Bgm(cleanFile);
            });
          } else {
            this.plusBgmPlayer = null;
            this.playHtml5Bgm(cleanFile);
          }
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  private playHtml5Bgm(fileWithExt: string) {
    if (this.bgmAudio) {
      try { this.bgmAudio.pause(); } catch {}
      this.bgmAudio = null;
    }
    try {
      this.bgmAudio = new Audio(this.getAudioUrl(fileWithExt));
      this.bgmAudio.loop = true;
      const effectiveVol = (this.enabled && this.bgmEnabled) ? this.bgmVolume : 0;
      this.bgmAudio.volume = effectiveVol;
      this.bgmAudio.playbackRate = this.getCurrentPlaybackRate();
      this.bgmAudio.addEventListener('ended', () => {
        if (this.enabled && this.bgmEnabled && this.bgmAudio) {
          this.bgmAudio.currentTime = 0;
          this.bgmAudio.play().catch(() => {});
        }
      });
      if (this.enabled && this.bgmEnabled) {
        const p = this.bgmAudio.play();
        if (p !== undefined) {
          p.catch(() => {});
        }
      }
    } catch {}
  }

  private async loadAudioArrayBuffer(url: string): Promise<ArrayBuffer | null> {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      return new Promise((resolve) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.responseType = 'arraybuffer';
          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 0) {
              resolve(xhr.response as ArrayBuffer);
            } else {
              resolve(null);
            }
          };
          xhr.onerror = () => resolve(null);
          xhr.send();
        } catch {
          resolve(null);
        }
      });
    }

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch {
      return null;
    }
  }

  private async loadBuffer(file: string): Promise<AudioBuffer | null> {
    if (this.audioBuffers.has(file)) return this.audioBuffers.get(file)!;
    if (this.bufferLoading.has(file)) return this.bufferLoading.get(file)!;

    const promise = (async () => {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return null;
        const url = this.getAudioUrl(file);
        const arrayBuf = await this.loadAudioArrayBuffer(url);
        if (!arrayBuf) return null;
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.audioBuffers.set(file, audioBuf);
        return audioBuf;
      } catch {
        return null;
      } finally {
        this.bufferLoading.delete(file);
      }
    })();

    this.bufferLoading.set(file, promise);
    return promise;
  }

  private menuTracks: string[] = ['menu1', 'menu2'];
  private currentMenuTrackIdx: number = 0;
  private combatTracks: string[] = ['combat1', 'combat2', 'combat4', 'combat5', 'combat6', 'combat7', 'combat8', 'combat9'];

  // Preload essential high-frequency SFX and core BGM into memory via Web Audio
  private preloadCoreSounds() {
    const frequent = [
      'menu1.ogg', 'menu2.ogg', 'campaign_map.ogg',
      'combat1.ogg', 'combat2.ogg', 'combat4.ogg', 'combat5.ogg', 'combat6.ogg', 'combat7.ogg', 'combat8.ogg', 'combat9.ogg',
      'attack.ogg', 'boom.ogg', 'btn1.ogg', 'btn2.ogg', 'btn3.ogg', 'summon1.ogg', 'summondrop.ogg',
      'flamewave.ogg', 'lightningbolt.ogg', 'calltothunder.ogg', 'healing.ogg', 'ritual_of_glory.ogg', 'doombolt.ogg'
    ];
    frequent.forEach((file) => {
      this.loadBuffer(file);
      try {
        const a = new Audio(this.getAudioUrl(file));
        a.preload = 'auto';
        this.audioPool.set(file, [a]);
      } catch {}
    });
  }

  private stopAllBgm() {
    if (this.bgmSourceNode) {
      try { this.bgmSourceNode.onended = null; } catch {}
      try { this.bgmSourceNode.stop(); } catch {}
      try { this.bgmSourceNode.disconnect(); } catch {}
      this.bgmSourceNode = null;
    }
    this.isWebAudioBgmPlaying = false;

    if (this.plusBgmPlayer) {
      try { this.plusBgmPlayer.stop(); } catch {}
      try { this.plusBgmPlayer.close(); } catch {}
      this.plusBgmPlayer = null;
    }

    if (this.bgmAudio) {
      try { this.bgmAudio.pause(); } catch {}
      this.bgmAudio = null;
    }
  }

  private async playWebAudioBgm(cleanTrack: string, vol?: number): Promise<boolean> {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return false;

      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const file = `${cleanTrack}.ogg`;
      const buffer = await this.loadBuffer(file);
      if (!buffer) return false;

      // Verify track hasn't changed while buffer was loading
      if (this.currentTrack !== cleanTrack) return true;

      // Cleanly stop any existing Web Audio BGM
      if (this.bgmSourceNode) {
        try { this.bgmSourceNode.onended = null; } catch {}
        try { this.bgmSourceNode.stop(); } catch {}
        try { this.bgmSourceNode.disconnect(); } catch {}
        this.bgmSourceNode = null;
      }

      // Stop any 5+ or HTML5 audio players
      if (this.plusBgmPlayer) {
        try { this.plusBgmPlayer.stop(); } catch {}
        try { this.plusBgmPlayer.close(); } catch {}
        this.plusBgmPlayer = null;
      }
      if (this.bgmAudio) {
        try { this.bgmAudio.pause(); } catch {}
        this.bgmAudio = null;
      }

      const effectiveVol = (this.enabled && this.bgmEnabled) ? (vol !== undefined ? vol : this.bgmVolume) : 0;
      if (!this.bgmGainNode) {
        this.bgmGainNode = ctx.createGain();
        this.bgmGainNode.connect(ctx.destination);
      }
      this.bgmGainNode.gain.value = effectiveVol;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.playbackRate.value = this.getCurrentPlaybackRate();
      src.connect(this.bgmGainNode);
      src.onended = () => {
        if (this.bgmSourceNode === src) {
          this.isWebAudioBgmPlaying = false;
          this.bgmSourceNode = null;
        }
      };
      src.start(0);

      this.bgmSourceNode = src;
      this.isWebAudioBgmPlaying = true;
      return true;
    } catch {
      return false;
    }
  }

  public toggleMenuTrack() {
    this.currentMenuTrackIdx = (this.currentMenuTrackIdx + 1) % this.menuTracks.length;
    this.playBgm(this.menuTracks[this.currentMenuTrackIdx], true);
  }

  public getRandomCombatTrack(): string {
    const candidates = this.combatTracks.filter(t => t !== this.currentTrack);
    const pool = candidates.length > 0 ? candidates : this.combatTracks;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return chosen;
  }

  public async playBgm(track: string = 'menu', force: boolean = false) {
    let cleanTrack = (track || 'menu').toLowerCase().trim();
    if (cleanTrack === 'battle' || cleanTrack === 'combat' || cleanTrack === 'random_combat') {
      cleanTrack = this.getRandomCombatTrack();
    }
    if (cleanTrack === 'battle1') cleanTrack = 'combat1';
    if (cleanTrack === 'campaign') cleanTrack = 'campaign_map';

    // 智能在两首主界面史诗交响曲之间切换轮播
    if (cleanTrack === 'menu') {
      if (!force && (this.currentTrack === 'menu1' || this.currentTrack === 'menu2') && (this.isWebAudioBgmPlaying || (this.bgmAudio && !this.bgmAudio.paused) || this.plusBgmPlayer)) {
        return;
      }
      this.currentMenuTrackIdx = (this.currentMenuTrackIdx + 1) % this.menuTracks.length;
      cleanTrack = this.menuTracks[this.currentMenuTrackIdx];
    }

    const validTracks = ['menu1', 'menu2', 'campaign_map', 'combat1', 'combat2', 'combat3', 'combat4', 'combat5', 'combat6', 'combat7', 'combat8', 'combat9'];
    if (!validTracks.includes(cleanTrack)) {
      cleanTrack = 'combat1';
    }

    if (!force && this.currentTrack === cleanTrack && (this.isWebAudioBgmPlaying || (this.bgmAudio && !this.bgmAudio.paused) || this.plusBgmPlayer)) {
      return;
    }
    this.currentTrack = cleanTrack;

    if (!this.enabled || !this.bgmEnabled) {
      this.stopAllBgm();
      return;
    }

    // 1. Primary: Web Audio API (Zero latency, seamless loop, 0 native OS handle leaks)
    const webAudioOk = await this.playWebAudioBgm(cleanTrack, this.bgmVolume);
    if (webAudioOk && this.isWebAudioBgmPlaying) {
      return;
    }

    // 2. Secondary fallback: 5+ Native Audio Player (HBuilderX / Android local)
    if (this.playWithPlus(`${cleanTrack}.ogg`, this.bgmVolume, true)) {
      return;
    }

    // 3. Tertiary fallback: Standard HTML5 Audio
    this.playHtml5Bgm(`${cleanTrack}.ogg`);
  }

  // True when the PC Sounds.ctl table has a sample for this card / event name.
  public has(name: string): boolean {
    const cleanKey = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return !!(this.soundCatalog[cleanKey] || this.soundCatalog[name]);
  }

  public play(name: string, customVolume?: number) {
    if (!this.enabled) return;
    try {
      const cleanKey = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const def = this.soundCatalog[cleanKey] ||
                  this.soundCatalog[name] ||
                  { file: `${cleanKey}.ogg`, volume: 0.8 };

      const vol = customVolume !== undefined ? customVolume : (def.volume ?? 0.8);
      const safeVol = Math.max(0, Math.min(1, vol * this.sfxVolume));

      // 1. Web Audio API (Zero latency, concurrent, zero native handles)
      const ctx = this.getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        if (ctx.state === 'running') {
          const buf = this.audioBuffers.get(def.file);
          if (buf) {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.value = safeVol;
            src.connect(gain);
            gain.connect(ctx.destination);
            src.start(0);
            return;
          } else {
            this.loadBuffer(def.file);
          }
        }
      }

      // 2. HTML5 Audio Pool Fallback
      const filePath = this.getAudioUrl(def.file);
      let pool = this.audioPool.get(def.file);
      if (!pool) {
        pool = [];
        this.audioPool.set(def.file, pool);
      }

      let audio = pool.find((a) => a.paused || a.ended);
      if (!audio) {
        if (pool.length < 5) {
          audio = new Audio(filePath);
          pool.push(audio);
        } else {
          audio = pool[0];
          audio.pause();
          audio.currentTime = 0;
        }
      }

      audio.volume = safeVol;
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          try {
            const fallback = new Audio(filePath);
            fallback.volume = safeVol;
            fallback.play().catch(() => {});
          } catch {}
        });
      }
    } catch {}
  }

  public startBgm() {
    if (!this.isWebAudioBgmPlaying && !this.bgmAudio && !this.plusBgmPlayer) {
      this.playBgm(this.currentTrack || 'combat1', true);
    } else {
      this.updateBgmOutput();
    }
  }

  public isCombatTrack(track?: string): boolean {
    const t = (track || this.currentTrack).toLowerCase();
    return t.startsWith('combat') || t.startsWith('battle');
  }

  public getCurrentPlaybackRate(): number {
    return this.isCombatTrack() ? this.combatBgmRate : 1.0;
  }

  public setCombatBgmRate(rate: number) {
    this.combatBgmRate = Math.max(0.7, Math.min(1.3, rate));
    try {
      localStorage.setItem('sm_combat_bgm_rate', this.combatBgmRate.toString());
    } catch {}
    this.applyPlaybackRate();
  }

  public getCombatBgmRate(): number {
    return this.combatBgmRate;
  }

  public applyPlaybackRate() {
    const targetRate = this.getCurrentPlaybackRate();
    if (this.bgmSourceNode) {
      try {
        this.bgmSourceNode.playbackRate.value = targetRate;
      } catch {}
    }
    if (this.bgmAudio) {
      try {
        this.bgmAudio.playbackRate = targetRate;
      } catch {}
    }
  }

  public setBgmVolume(val: number) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    try {
      localStorage.setItem('sm_bgm_volume', this.bgmVolume.toString());
    } catch {}
    this.updateBgmOutput();
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    try {
      localStorage.setItem('sm_sfx_volume', this.sfxVolume.toString());
    } catch {}
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  private updateBgmOutput() {
    const shouldPlay = this.enabled && this.bgmEnabled;
    const effectiveVol = shouldPlay ? this.bgmVolume : 0;
    if (this.bgmGainNode) {
      this.bgmGainNode.gain.value = effectiveVol;
    }
    if (!shouldPlay) {
      if (this.bgmAudio) this.bgmAudio.pause();
      if (this.plusBgmPlayer) {
        try { this.plusBgmPlayer.pause(); } catch {}
      }
    } else {
      this.applyPlaybackRate();
      if (this.bgmAudio) {
        this.bgmAudio.volume = effectiveVol;
      }
      if (this.isWebAudioBgmPlaying) {
        const ctx = this.getAudioContext();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      } else if (this.plusBgmPlayer) {
        try {
          if (typeof this.plusBgmPlayer.setVolume === 'function') {
            this.plusBgmPlayer.setVolume(effectiveVol);
          }
          this.plusBgmPlayer.resume();
        } catch {}
      } else if (this.bgmAudio) {
        this.bgmAudio.play().catch(() => {});
      } else {
        this.playBgm(this.currentTrack || 'menu1', true);
      }
    }
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    this.updateBgmOutput();
    return this.enabled;
  }

  public toggleBgm(): boolean {
    this.bgmEnabled = !this.bgmEnabled;
    this.updateBgmOutput();
    return this.bgmEnabled;
  }
}

export const sound = new SoundManager();
