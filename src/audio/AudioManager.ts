export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  public init(): void {
    if (this.ctx) return;
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtxClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * 创建带声相 (Pan) 和滤波的音频输出链
   */
  private createPannedChain(pan: number = 0, lowPassFreq?: number): { inputNode: AudioNode; outputNode: AudioNode } {
    if (!this.ctx || !this.masterGain) {
      throw new Error('AudioContext 未初始化');
    }

    const gainNode = this.ctx.createGain();

    // 低通滤波器 (模拟闷响/地下室声音)
    if (lowPassFreq && lowPassFreq < 20000) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowPassFreq, this.ctx.currentTime);
      gainNode.connect(filter);

      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
        filter.connect(panner);
        panner.connect(this.masterGain);
      } else {
        filter.connect(this.masterGain);
      }
    } else {
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
        gainNode.connect(panner);
        panner.connect(this.masterGain);
      } else {
        gainNode.connect(this.masterGain);
      }
    }

    return { inputNode: gainNode, outputNode: this.masterGain };
  }

  /**
   * 霰弹枪开火声 (低频轰鸣 + 白噪音爆破)
   */
  public playShotgunFire(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    // 1. 低频重击震荡
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);
    oscGain.gain.setValueAtTime(1.0, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    osc.connect(oscGain);
    oscGain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 0.35);

    // 2. 枪声爆破噪音 (Noise burst)
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1200, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, t + 0.4);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(inputNode);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  /**
   * 战术刀挥击与划过空气声
   */
  public playKnifeSwing(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * 命中敌人或砍中肉体声
   */
  public playHitFlesh(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * 装弹咔哒声
   */
  public playReload(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.setValueAtTime(1400, t + 0.08);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /**
   * 正门撞击/木板拆裂声 (正中方位 pan = 0.0)
   */
  public playDoorWoodHit(pan: number = 0.0): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(pan, 1200);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * 窗户玻璃刮擦/敲击声 (右侧方位 pan = 0.75)
   */
  public playWindowGlassTap(pan: number = 0.75): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(pan);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.1);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * 笑者 Laugher 诡异高频颤音笑声 (右侧方位 pan = 0.75)
   */
  public playLaugherEerieSound(pan: number = 0.75): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(pan);

    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(12, t); // 颤音速度
    lfoGain.gain.setValueAtTime(150, t); // 颤音幅度

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.45);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.9);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.9);

    osc.connect(gain);
    gain.connect(inputNode);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 0.9);
    osc.stop(t + 0.9);
  }

  /**
   * 地窖活板门爬行/撞击声 (左侧偏下方位 pan = -0.75, 低通滤波)
   */
  public playCellarLadderSound(pan: number = -0.75): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(pan, 600); // 600Hz 截止低通滤波模拟隔着地板

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  /**
   * 拟态者 Mimic 发出欺骗性声音 (固定在左侧地窖 pan = -0.75, 但模拟笑声或木板声)
   */
  public playMimicDeceptionSound(): void {
    if (Math.random() < 0.5) {
      // 模拟窗户笑声，但声源在左侧地窖！
      this.playLaugherEerieSound(-0.75);
    } else {
      // 模拟正门撞击，但声源在左侧地窖！
      this.playDoorWoodHit(-0.75);
    }
  }

  /**
   * 视角切换轻微嗖声
   */
  public playSceneSwitch(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * 警报与失败 Game Over 音效
   */
  public playGameOver(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.linearRampToValueAtTime(80, t + 1.2);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

    osc.connect(gain);
    gain.connect(inputNode);
    osc.start(t);
    osc.stop(t + 1.2);
  }
}

export const audioManager = new AudioManager();
