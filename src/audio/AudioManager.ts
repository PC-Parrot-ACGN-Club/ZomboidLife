export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // 环境音 (Ambient Drone) 节点群
  private ambientGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private noiseNode: AudioNode | null = null;
  private noiseLfo: OscillatorNode | null = null;
  private isAmbientPlaying: boolean = false;

  // 心跳与紧张度
  private heartbeatTimerMs: number = 0;
  private heartbeatIntervalMs: number = 1200;
  private tensionLevel: number = 0; // 0.0 (平静) ~ 1.0 (极度危险)

  public init(): void {
    if (this.ctx) return;
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
  private createPannedChain(
    pan: number = 0,
    lowPassFreq?: number
  ): { inputNode: AudioNode; outputNode: AudioNode } {
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

  // ==========================================
  // 令人不安的背景暗流与环境音 (Ambient Drone & Horror Atmosphere)
  // ==========================================

  /**
   * 启动恐怖背景暗流音效 (次低频双耳差频暗音 + 阴冷风声呼吸滤波)
   */
  public startAmbientDrone(): void {
    if (!this.ctx || !this.masterGain || this.isAmbientPlaying) return;
    this.resume();

    this.isAmbientPlaying = true;
    const t = this.ctx.currentTime;

    // 总环境音增益节点 (柔和淡入)
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.01, t);
    this.ambientGain.gain.exponentialRampToValueAtTime(0.35, t + 3.0);
    this.ambientGain.connect(this.masterGain);

    // 1. 低频不协和差频震荡 (Infrasound / Dark Sub-Drone)
    // 50Hz 与 53.5Hz 的微小音分偏差会产生约 3.5Hz 的令人心悸的不安定拍频 (Acoustic Beating)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc2 = this.ctx.createOscillator();
    const droneFilter = this.ctx.createBiquadFilter();

    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.setValueAtTime(50, t);

    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.setValueAtTime(53.5, t);

    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(95, t); // 滤除高频，只保留压抑的次低频轰鸣

    const droneSubGain = this.ctx.createGain();
    droneSubGain.gain.setValueAtTime(0.6, t);

    this.droneOsc1.connect(droneFilter);
    this.droneOsc2.connect(droneFilter);
    droneFilter.connect(droneSubGain);
    droneSubGain.connect(this.ambientGain);

    this.droneOsc1.start(t);
    this.droneOsc2.start(t);

    // 2. 阴冷风噪与空旷房间底噪 (Filtered Wind Noise + LFO Breathing)
    const bufferSize = this.ctx.sampleRate * 2.0;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(320, t);
    windFilter.Q.setValueAtTime(3.0, t);

    // LFO 缓慢调制风声的中心频率，营造阴风穿堂的不安感
    this.noiseLfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    this.noiseLfo.type = 'sine';
    this.noiseLfo.frequency.setValueAtTime(0.2, t); // 每 5 秒一个循环
    lfoGain.gain.setValueAtTime(140, t);

    this.noiseLfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.18, t);

    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain);

    noiseSource.start(t);
    this.noiseLfo.start(t);
    this.noiseNode = noiseSource;
  }

  /**
   * 停止背景环境音 (淡出)
   */
  public stopAmbientDrone(): void {
    if (!this.ctx || !this.ambientGain || !this.isAmbientPlaying) return;

    const t = this.ctx.currentTime;
    this.ambientGain.gain.linearRampToValueAtTime(0.001, t + 1.0);

    setTimeout(() => {
      try {
        this.droneOsc1?.stop();
        this.droneOsc2?.stop();
        this.noiseLfo?.stop();
        this.droneOsc1?.disconnect();
        this.droneOsc2?.disconnect();
        this.noiseNode?.disconnect();
        this.noiseLfo?.disconnect();
        this.ambientGain?.disconnect();
      } catch {
        // ignore already stopped nodes
      }
      this.isAmbientPlaying = false;
      this.droneOsc1 = null;
      this.droneOsc2 = null;
      this.noiseNode = null;
      this.noiseLfo = null;
      this.ambientGain = null;
    }, 1050);
  }

  /**
   * 动态调节压迫感 / 紧张度等级 (0.0 ~ 1.0)
   */
  public setTensionLevel(level: number): void {
    this.tensionLevel = Math.max(0, Math.min(1, level));

    if (this.ctx && this.ambientGain) {
      // 随着局势越危险，环境低频嗡鸣音量与压迫感随之增强
      const targetGain = 0.35 + this.tensionLevel * 0.45;
      this.ambientGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.5);
    }

    // 心跳间隔随紧张度加速 (1300ms -> 450ms)
    this.heartbeatIntervalMs = 1300 - this.tensionLevel * 850;
  }

  /**
   * 逐帧更新心跳节拍与随机惊悚环境异响
   */
  public updateAmbientLoop(deltaMs: number): void {
    if (!this.ctx || !this.isAmbientPlaying) return;

    // 当局势有危险 (tension > 0.25) 时激活心跳音效
    if (this.tensionLevel > 0.25) {
      this.heartbeatTimerMs += deltaMs;
      if (this.heartbeatTimerMs >= this.heartbeatIntervalMs) {
        this.heartbeatTimerMs = 0;
        this.playHeartbeatThud();
      }
    } else {
      this.heartbeatTimerMs = 0;
    }
  }

  /**
   * 沉闷压抑的心跳声 ("咚-咚" 双脉冲低频震荡)
   */
  public playHeartbeatThud(): void {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0, 150);

    // 第一声心跳 (Lub)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65, t);
    osc1.frequency.exponentialRampToValueAtTime(30, t + 0.12);
    gain1.gain.setValueAtTime(0.5 + this.tensionLevel * 0.4, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc1.connect(gain1);
    gain1.connect(inputNode);
    osc1.start(t);
    osc1.stop(t + 0.12);

    // 第二声心跳 (Dub - 稍弱，间隔 140ms)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(55, t + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(25, t + 0.26);
    gain2.gain.setValueAtTime(0.35 + this.tensionLevel * 0.3, t + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.26);

    osc2.connect(gain2);
    gain2.connect(inputNode);
    osc2.start(t + 0.14);
    osc2.stop(t + 0.26);
  }

  // ==========================================
  // 武器与战斗音效
  // ==========================================

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
   * 逐发压入霰弹枪弹药声 (金属滑动与压入卡槽声)
   */
  public playShellInsert(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    // 1. 金属弹壳刮入声
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1400, t);
    osc1.frequency.exponentialRampToValueAtTime(800, t + 0.07);
    gain1.gain.setValueAtTime(0.35, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
    osc1.connect(gain1);
    gain1.connect(inputNode);
    osc1.start(t);
    osc1.stop(t + 0.07);

    // 2. 弹夹卡簧卡扣清脆锁定声
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1800, t + 0.05);
    osc2.frequency.setValueAtTime(2400, t + 0.09);
    gain2.gain.setValueAtTime(0.4, t + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    osc2.connect(gain2);
    gain2.connect(inputNode);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.14);
  }

  /**
   * 泵动式霰弹枪拉栓/上膛声 (咔嚓机械滑动双音)
   */
  public playShotgunPump(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    // 后拉 (Rack Back)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(450, t);
    osc1.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    gain1.gain.setValueAtTime(0.45, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc1.connect(gain1);
    gain1.connect(inputNode);
    osc1.start(t);
    osc1.stop(t + 0.08);

    // 推弹上膛 (Rack Forward - 间隔 80ms)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(750, t + 0.09);
    osc2.frequency.setValueAtTime(1200, t + 0.14);
    gain2.gain.setValueAtTime(0.5, t + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc2.connect(gain2);
    gain2.connect(inputNode);
    osc2.start(t + 0.09);
    osc2.stop(t + 0.2);
  }

  /**
   * 装弹咔哒声
   */
  public playReload(): void {
    this.playShellInsert();
  }

  /**
   * 自动机枪扫射爆发音 (正门容错清除: 连环重机枪扫射 + 弹药打空咔哒声)
   */
  public playTurretFire(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(0.0);

    // 连续 8 发极速连射机枪火舌
    const shotCount = 8;
    const shotInterval = 0.07;
    for (let i = 0; i < shotCount; i++) {
      const shotTime = t + i * shotInterval;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, shotTime);
      osc.frequency.exponentialRampToValueAtTime(40, shotTime + 0.06);
      gain.gain.setValueAtTime(0.8, shotTime);
      gain.gain.exponentialRampToValueAtTime(0.01, shotTime + 0.06);
      osc.connect(gain);
      gain.connect(inputNode);
      osc.start(shotTime);
      osc.stop(shotTime + 0.06);
    }

    // 扫射完毕后弹药打空撞针清脆声 (Empty Click)
    const emptyTime = t + shotCount * shotInterval + 0.1;
    const emptyOsc = this.ctx.createOscillator();
    const emptyGain = this.ctx.createGain();
    emptyOsc.type = 'triangle';
    emptyOsc.frequency.setValueAtTime(2200, emptyTime);
    emptyGain.gain.setValueAtTime(0.5, emptyTime);
    emptyGain.gain.exponentialRampToValueAtTime(0.01, emptyTime + 0.08);
    emptyOsc.connect(emptyGain);
    emptyGain.connect(inputNode);
    emptyOsc.start(emptyTime);
    emptyOsc.stop(emptyTime + 0.08);
  }

  /**
   * 活板门落石/重锤陷阱触发音 (地窖容错清除: 机关卡簧断裂 + 巨物崩塌碾碎)
   */
  public playTrapTrigger(): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(-0.75, 800);

    // 1. 机械陷阱触发拉线崩断声
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(1600, t);
    snapOsc.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    snapGain.gain.setValueAtTime(0.6, t);
    snapGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    snapOsc.connect(snapGain);
    snapGain.connect(inputNode);
    snapOsc.start(t);
    snapOsc.stop(t + 0.12);

    // 2. 巨型滚石/刺木重锤轰然砸下 (震天低音)
    const crashTime = t + 0.14;
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sawtooth';
    thudOsc.frequency.setValueAtTime(90, crashTime);
    thudOsc.frequency.exponentialRampToValueAtTime(25, crashTime + 0.55);
    thudGain.gain.setValueAtTime(1.2, crashTime);
    thudGain.gain.exponentialRampToValueAtTime(0.01, crashTime + 0.55);
    thudOsc.connect(thudGain);
    thudGain.connect(inputNode);
    thudOsc.start(crashTime);
    thudOsc.stop(crashTime + 0.55);

    // 3. 骨骼碎裂/碾压杂音
    const crunchOsc = this.ctx.createOscillator();
    const crunchGain = this.ctx.createGain();
    crunchOsc.type = 'triangle';
    crunchOsc.frequency.setValueAtTime(350, crashTime + 0.05);
    crunchOsc.frequency.exponentialRampToValueAtTime(60, crashTime + 0.3);
    crunchGain.gain.setValueAtTime(0.7, crashTime + 0.05);
    crunchGain.gain.exponentialRampToValueAtTime(0.01, crashTime + 0.3);
    crunchOsc.connect(crunchGain);
    crunchGain.connect(inputNode);
    crunchOsc.start(crashTime + 0.05);
    crunchOsc.stop(crashTime + 0.3);
  }

  // ==========================================
  // 场景与环境声效 (带立体声定位)
  // ==========================================

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
   * 笑者被枪声吓退仓皇逃窜声 (受惊尖叫 + 快速向远方衰减的啸叫与多普勒音)
   */
  public playLaugherFleeSound(pan: number = 0.75): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(pan);

    // 1. 受惊尖锐嘶叫 (快速升频后暴跌)
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(28, t); // 极速受惊颤音
    lfoGain.gain.setValueAtTime(220, t);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.15); // 惊叫
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.65); // 远窜衰减

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.65);

    osc.connect(gain);
    gain.connect(inputNode);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 0.65);
    osc.stop(t + 0.65);

    // 2. 灌木草丛被仓皇撞开的风声/杂音
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.45);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.45);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(inputNode);

    noise.start(t);
    noise.stop(t + 0.45);
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
   * 拟态者 Mimic 自身独特叫声 (地窖深处异化低吼与咔哒声, pan = -0.75, 低通滤波)
   */
  public playMimicOwnSound(pan: number = -0.75): void {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const { inputNode } = this.createPannedChain(pan, 750);

    // 1. 低频怪异嘶吼与调频
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(16, t);
    lfoGain.gain.setValueAtTime(70, t);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.65);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.65);

    osc.connect(gain);
    gain.connect(inputNode);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 0.65);
    osc.stop(t + 0.65);

    // 2. 伴随骨骼与木质咔哒声
    for (let i = 0; i < 3; i++) {
      const clickTime = t + 0.12 * i;
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(280 - i * 40, clickTime);
      clickGain.gain.setValueAtTime(0.35, clickTime);
      clickGain.gain.exponentialRampToValueAtTime(0.01, clickTime + 0.04);
      clickOsc.connect(clickGain);
      clickGain.connect(inputNode);
      clickOsc.start(clickTime);
      clickOsc.stop(clickTime + 0.04);
    }
  }

  /**
   * 拟态者 Mimic 发出声音 (自身声音、或模仿正门/窗户声音，但声源均固定在左侧地窖 pan = -0.75)
   */
  public playMimicSound(type: 'own' | 'walker' | 'laugher'): void {
    if (type === 'own') {
      this.playMimicOwnSound(-0.75);
    } else if (type === 'walker') {
      this.playDoorWoodHit(-0.75);
    } else {
      this.playLaugherEerieSound(-0.75);
    }
  }

  /**
   * 拟态者 Mimic 发出欺骗性声音 (固定在左侧地窖 pan = -0.75)
   */
  public playMimicDeceptionSound(): void {
    const rand = Math.random();
    if (rand < 0.4) {
      this.playMimicOwnSound(-0.75);
    } else if (rand < 0.7) {
      this.playLaugherEerieSound(-0.75);
    } else {
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
