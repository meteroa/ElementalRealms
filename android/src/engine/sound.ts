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

  private audioPool: Map<string, HTMLAudioElement[]> = new Map();
  private audioCtx: AudioContext | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private bufferLoading: Map<string, Promise<AudioBuffer | null>> = new Map();

  // Master definitions mapped directly from PC Sounds.ctl
  private readonly soundCatalog: Record<string, SoundDef> = {
    // UI & System
    click: { file: 'btn1.ogg', volume: 0.5 },
    btn: { file: 'btn2.ogg', volume: 0.5 },
    btn1: { file: 'btn1.ogg', volume: 0.5 },
    btn2: { file: 'btn2.ogg', volume: 0.5 },
    btn3: { file: 'btn3.ogg', volume: 0.6 },
    btn4: { file: 'btn4.ogg', volume: 0.3 },
    btn5: { file: 'btn5.ogg', volume: 0.3 },
    btnm: { file: 'btnm.ogg', volume: 0.8 },
    showeff1: { file: 'showeff1.ogg', volume: 0.6 },
    showeff2: { file: 'showeff2.ogg', volume: 0.4 },
    hideeff1: { file: 'hideeff1.ogg', volume: 0.6 },
    hideeff2: { file: 'hideeff2.ogg', volume: 0.4 },
    turntime: { file: 'turntime.ogg', volume: 0.6 },

    // Combat Basics
    summon: { file: 'summon1.ogg', volume: 0.6 },
    summon1: { file: 'summon1.ogg', volume: 0.6 },
    summondrop: { file: 'summondrop.ogg', volume: 0.75 },
    attack: { file: 'attack.ogg', volume: 1.5 },
    boom: { file: 'boom.ogg', volume: 0.85 },
    victory: { file: 'ritual_of_glory.ogg', volume: 0.85 },
    defeat: { file: 'doombolt.ogg', volume: 0.8 },

    // Authentic PC Spell Sounds (pc/Sounds.ctl)
    flamewave: { file: 'flamewave.ogg', volume: 0.85 },
    inferno: { file: 'inferno.ogg', volume: 1.0 },
    armageddon: { file: 'armageddon2.ogg', volume: 1.0 },
    armageddon2: { file: 'armageddon2.ogg', volume: 1.0 },
    calltothunder: { file: 'calltothunder.ogg', volume: 0.75 },
    lightningbolt: { file: 'lightningbolt.ogg', volume: 0.75 },
    lightning: { file: 'lightningbolt.ogg', volume: 0.75 },
    thunder: { file: 'calltothunder.ogg', volume: 0.75 },
    chainlightning: { file: 'chainlightning.ogg', volume: 0.8 },
    meditation: { file: 'meditation.ogg', volume: 0.45 },
    naturalfury: { file: 'naturalfury.ogg', volume: 1.0 },
    rejuvenation: { file: 'rejuvenation.ogg', volume: 0.75 },
    stonerain: { file: 'stonerain.ogg', volume: 0.9 },
    tornado: { file: 'tornado.ogg', volume: 0.8 },
    acidicrain: { file: 'acidicrain.ogg', volume: 0.8 },
    bloodritual: { file: 'bloodritual.ogg', volume: 1.0 },
    darkritual: { file: 'darkritual.ogg', volume: 0.85 },
    cursedfog: { file: 'cursedfog.ogg', volume: 0.8 },
    drainsoul: { file: 'drainsouls.ogg', volume: 0.9 },
    drainsouls: { file: 'drainsouls.ogg', volume: 0.9 },
    divineint: { file: 'divineint.ogg', volume: 0.4 },
    divineintervention: { file: 'divineint.ogg', volume: 0.4 },
    wrathofgod: { file: 'wrathofgod.ogg', volume: 0.85 },
    overtime: { file: 'overtime.ogg', volume: 0.5 },
    cannonade: { file: 'cannonade.ogg', volume: 0.85 },
    weakness: { file: 'weakness.ogg', volume: 0.6 },
    poisoncloud: { file: 'poisoncloud.ogg', volume: 0.65 },
    poisonouscloud: { file: 'poisoncloud.ogg', volume: 0.65 },
    doombolt: { file: 'doombolt.ogg', volume: 0.85 },
    madness: { file: 'madness.ogg', volume: 0.8 },
    madness2: { file: 'madness2.ogg', volume: 0.8 },
    hypnosys: { file: 'hypnosys.ogg', volume: 0.75 },
    hypnosis: { file: 'hypnosys.ogg', volume: 0.75 },
    naturerit: { file: 'naturerit.ogg', volume: 0.8 },
    naturesritual: { file: 'naturerit.ogg', volume: 0.8 },
    divjustice: { file: 'divjustice.ogg', volume: 0.85 },
    divinejustice: { file: 'divjustice.ogg', volume: 0.85 },
    chaowave: { file: 'chaowave.ogg', volume: 0.5 },
    chaoticwave: { file: 'chaowave.ogg', volume: 0.5 },
    rageofsouls: { file: 'rage_of_souls.ogg', volume: 0.8 },
    rage_of_souls: { file: 'rage_of_souls.ogg', volume: 0.8 },
    explosion: { file: 'explosion.ogg', volume: 0.65 },
    powerchains: { file: 'power_chains.ogg', volume: 0.8 },
    power_chains: { file: 'power_chains.ogg', volume: 0.8 },
    hellfire: { file: 'hellfire.ogg', volume: 0.7 },
    healingspray: { file: 'healing_spray.ogg', volume: 0.8 },
    healing_spray: { file: 'healing_spray.ogg', volume: 0.8 },
    fireball: { file: 'fireball.ogg', volume: 0.65 },
    stealessence: { file: 'steal_essence.ogg', volume: 0.65 },
    steal_essence: { file: 'steal_essence.ogg', volume: 0.65 },
    sacrifice: { file: 'sacrifice.ogg', volume: 0.8 },
    manaburn: { file: 'mana_burn.ogg', volume: 0.6 },
    mana_burn: { file: 'mana_burn.ogg', volume: 0.6 },
    ritualofglory: { file: 'ritual_of_glory.ogg', volume: 0.8 },
    ritual_of_glory: { file: 'ritual_of_glory.ogg', volume: 0.8 },
    sonicboom: { file: 'sonic_boom.ogg', volume: 0.75 },
    sonic_boom: { file: 'sonic_boom.ogg', volume: 0.75 },
    disintegrate: { file: 'disintegrate.ogg', volume: 0.6 },
    naturalhealing: { file: 'natural_healing.ogg', volume: 0.8 },
    natural_healing: { file: 'natural_healing.ogg', volume: 0.8 },
    poison: { file: 'poison.ogg', volume: 0.8 },
    enrage: { file: 'enrage.ogg', volume: 0.6 },
    pumpenergy: { file: 'pump_energy.ogg', volume: 0.5 },
    pump_energy: { file: 'pump_energy.ogg', volume: 0.5 },
    trumpet: { file: 'trumpet.ogg', volume: 0.65 },
    gaze: { file: 'gaze.ogg', volume: 0.7 },
    breathefire: { file: 'breathe_fire.ogg', volume: 0.85 },
    breathe_fire: { file: 'breathe_fire.ogg', volume: 0.85 },
    movefalcon: { file: 'move_falcon.ogg', volume: 0.65 },
    move_falcon: { file: 'move_falcon.ogg', volume: 0.65 },
    hasten: { file: 'hasten.ogg', volume: 0.7 },
    timestop: { file: 'time_stop.ogg', volume: 0.7 },
    time_stop: { file: 'time_stop.ogg', volume: 0.7 },
    rescueoperation: { file: 'rescue_operation.ogg', volume: 0.7 },
    rescue_operation: { file: 'rescue_operation.ogg', volume: 0.7 },
    armyofrats: { file: 'army_of_rats.ogg', volume: 0.8 },
    army_of_rats: { file: 'army_of_rats.ogg', volume: 0.8 },
    rats: { file: 'army_of_rats.ogg', volume: 0.8 },
    ritualoftheforest: { file: 'ritual_of_the_forest.ogg', volume: 0.75 },
    ritual_of_the_forest: { file: 'ritual_of_the_forest.ogg', volume: 0.75 },
    divinemeddling: { file: 'divinemed.ogg', volume: 0.7 },
    divinemed: { file: 'divinemed.ogg', volume: 0.7 },
    rageofgod: { file: 'rageofgod.ogg', volume: 0.85 },
    bloodboil: { file: 'bloodboil.ogg', volume: 0.8 },
    ancientspirits: { file: 'ancientspirits.ogg', volume: 0.75 },
    golemsfrenzy: { file: 'golemsfrenzy.ogg', volume: 0.8 },
    golemsjustice: { file: 'golemsjustice.ogg', volume: 0.8 },
    armyupgrade: { file: 'armyupgrade.ogg', volume: 0.8 },
    strenghtening: { file: 'strenghtening.ogg', volume: 0.8 },
    healing: { file: 'healing.ogg', volume: 0.8 },
    heal: { file: 'healing.ogg', volume: 0.8 },
    healingmini: { file: 'healingmini.ogg', volume: 0.8 },
    negativeeffect: { file: 'negativeeffect.ogg', volume: 0.8 },
    positiveeffect: { file: 'positiveeffect.ogg', volume: 0.8 },

    // Card ID Direct Mappings
    fire_flame_wave: { file: 'flamewave.ogg', volume: 0.85 },
    fire_inferno: { file: 'inferno.ogg', volume: 1.0 },
    water_acidic_rain: { file: 'acidicrain.ogg', volume: 0.85 },
    air_call_to_thunder: { file: 'calltothunder.ogg', volume: 0.8 },
    air_lightning_bolt: { file: 'lightningbolt.ogg', volume: 0.8 },
    air_chain_lightning: { file: 'chainlightning.ogg', volume: 0.85 },
    earth_natures_ritual: { file: 'naturerit.ogg', volume: 0.8 },
    earth_rejuvenation: { file: 'rejuvenation.ogg', volume: 0.75 },
    earth_stone_rain: { file: 'stonerain.ogg', volume: 0.9 },
    spec_healing_spray: { file: 'healing_spray.ogg', volume: 0.8 },
    spec_fireball: { file: 'fireball.ogg', volume: 0.7 },
    spec_steal_essence: { file: 'steal_essence.ogg', volume: 0.7 },
    spec_mana_burn: { file: 'mana_burn.ogg', volume: 0.6 },
    spec_disintegrate: { file: 'disintegrate.ogg', volume: 0.65 },
    spec_ritual_of_glory: { file: 'ritual_of_glory.ogg', volume: 0.85 },
    death_dark_ritual: { file: 'darkritual.ogg', volume: 0.85 },
    death_cursed_fog: { file: 'cursedfog.ogg', volume: 0.8 },
    death_blood_ritual: { file: 'bloodritual.ogg', volume: 1.0 },
    holy_divine_justice: { file: 'divjustice.ogg', volume: 0.85 },
    holy_divine_intervention: { file: 'divineint.ogg', volume: 0.4 },
    mech_cannonade: { file: 'cannonade.ogg', volume: 0.85 },
    ctrl_weakness: { file: 'weakness.ogg', volume: 0.6 },
    chaos_doom_bolt: { file: 'doombolt.ogg', volume: 0.85 },
    chaos_wave: { file: 'chaowave.ogg', volume: 0.6 },
    illus_madness: { file: 'madness.ogg', volume: 0.8 },
    demon_explosion: { file: 'explosion.ogg', volume: 0.7 },
    demon_power_chains: { file: 'power_chains.ogg', volume: 0.8 },
    demon_hellfire: { file: 'hellfire.ogg', volume: 0.75 },
    time_hasten: { file: 'hasten.ogg', volume: 0.7 },
    time_time_stop: { file: 'time_stop.ogg', volume: 0.75 },
    goblin_rescue_operation: { file: 'rescue_operation.ogg', volume: 0.75 },
    goblin_army_of_rats: { file: 'army_of_rats.ogg', volume: 0.85 },
  };

  constructor() {
    this.setupUnlockListener();
    this.preloadCoreSounds();
    this.playBgm('menu1');
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

    ['click', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, unlock, { passive: true });
    });

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

  private playWithPlus(file: string, vol: number = 0.8, isBgm: boolean = false): boolean {
    const w = typeof window !== 'undefined' ? (window as any) : null;
    if (!w || !w.plus || !w.plus.audio) return false;

    try {
      const cleanFile = file.toLowerCase();
      const primaryPath = `_www/audio/${cleanFile}`;
      const player = w.plus.audio.createPlayer(primaryPath);
      if (!player) return false;

      if (typeof player.setVolume === 'function') {
        player.setVolume(vol);
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
                this.playWithPlus(file, vol, true);
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
      this.bgmAudio.volume = 0.45;
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

  // Preload essential high-frequency SFX and core BGM into memory via Web Audio
  private preloadCoreSounds() {
    const frequent = [
      'menu1.ogg', 'combat1.ogg', 'combat2.ogg', 'combat3.ogg',
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

  private async playWebAudioBgm(cleanTrack: string, vol: number = 0.45): Promise<boolean> {
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

      if (!this.bgmGainNode) {
        this.bgmGainNode = ctx.createGain();
        this.bgmGainNode.connect(ctx.destination);
      }
      this.bgmGainNode.gain.value = (this.enabled && this.bgmEnabled) ? vol : 0;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
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

  public async playBgm(track: string = 'menu1', force: boolean = false) {
    let cleanTrack = (track || 'menu1').toLowerCase().trim();
    if (cleanTrack === 'battle1') cleanTrack = 'combat1';
    if (!['menu1', 'combat1', 'combat2', 'combat3'].includes(cleanTrack)) {
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
    const webAudioOk = await this.playWebAudioBgm(cleanTrack, 0.45);
    if (webAudioOk && this.isWebAudioBgmPlaying) {
      return;
    }

    // 2. Secondary fallback: 5+ Native Audio Player (HBuilderX / Android local)
    if (this.playWithPlus(`${cleanTrack}.ogg`, 0.45, true)) {
      return;
    }

    // 3. Tertiary fallback: Standard HTML5 Audio
    this.playHtml5Bgm(`${cleanTrack}.ogg`);
  }

  public play(name: string, customVolume?: number) {
    if (!this.enabled) return;
    try {
      const cleanKey = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const def = this.soundCatalog[cleanKey] ||
                  this.soundCatalog[name] ||
                  { file: `${cleanKey}.ogg`, volume: 0.8 };

      const vol = customVolume !== undefined ? customVolume : (def.volume ?? 0.8);
      const safeVol = Math.max(0, Math.min(1, vol));

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

  private updateBgmOutput() {
    const shouldPlay = this.enabled && this.bgmEnabled;
    if (this.bgmGainNode) {
      this.bgmGainNode.gain.value = shouldPlay ? 0.45 : 0;
    }
    if (!shouldPlay) {
      if (this.bgmAudio) this.bgmAudio.pause();
      if (this.plusBgmPlayer) {
        try { this.plusBgmPlayer.pause(); } catch {}
      }
    } else {
      if (this.isWebAudioBgmPlaying) {
        const ctx = this.getAudioContext();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      } else if (this.plusBgmPlayer) {
        try { this.plusBgmPlayer.resume(); } catch {}
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
