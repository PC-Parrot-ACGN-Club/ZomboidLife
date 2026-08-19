import { eventBus } from '@/core/EventBus';
import { GAME_CONFIG, SceneType, WeaponType } from '@/config/GameConfig';
import { WaveSystem } from '@/systems/WaveSystem';
import { EnemyManager } from '@/systems/EnemyManager';

export class HUDOverlay {
  private container: HTMLElement;
  private currentWeapon: WeaponType = 'shotgun';
  private ammo: number = GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE;
  private currentScene: SceneType = GAME_CONFIG.SCENES.DOOR;
  private waveSystem: WaveSystem;
  private enemyManager: EnemyManager;

  constructor(waveSystem: WaveSystem, enemyManager: EnemyManager) {
    this.container = document.getElementById('hud-overlay')!;
    this.waveSystem = waveSystem;
    this.enemyManager = enemyManager;
    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <!-- 顶部状态栏 -->
      <div class="hud-top-bar" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 8px;">
        <!-- 波次与存活 -->
        <div style="background: rgba(0,0,0,0.8); padding: 8px 14px; border: 1px solid #444; border-radius: 6px; flex-shrink: 0;">
          <div style="font-size: 18px; font-weight: bold; color: #ff4444; letter-spacing: 1px;">
            WAVE <span id="hud-wave">1</span>
          </div>
          <div style="font-size: 12px; color: #aaa; margin-top: 2px;">
            时间: <span id="hud-timer" style="color: #00ff88; font-weight: bold;">00:00</span> | 击杀: <span id="hud-kills" style="color: #44ddff;">0</span>
          </div>
          <div style="font-size: 11px; color: #ffaa00; margin-top: 2px;">
            剩余: <span id="hud-remaining" style="font-weight: bold;">0</span>
          </div>
        </div>

        <!-- 噪音指示器 (核心机制) -->
        <div class="hud-noise-panel" style="background: rgba(0,0,0,0.8); padding: 8px 14px; border: 1px solid #444; border-radius: 6px; text-align: center; flex: 1; max-width: 260px;">
          <div style="font-size: 11px; color: #aaa; margin-bottom: 3px;">枪声噪音 (开枪加速引怪)</div>
          <div style="width: 100%; height: 8px; background: #222; border-radius: 4px; overflow: hidden; border: 1px solid #555;">
            <div id="hud-noise-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00ff88, #ffaa00, #ff2222); transition: width 0.1s;"></div>
          </div>
          <div id="hud-noise-text" style="font-size: 11px; color: #00ff88; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">安静 (平缓刷新)</div>
        </div>

        <!-- 顶部快捷操作 (移动端监控按钮 + 视角显示) -->
        <div style="background: rgba(0,0,0,0.8); padding: 8px 14px; border: 1px solid #444; border-radius: 6px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <div id="hud-scene-name" style="font-size: 14px; font-weight: bold; color: #44ccff;">正门 (1)</div>
          <button id="btn-quick-cctv" class="interactive" style="
            background: #022b10;
            border: 1px solid #00ff66;
            color: #00ff66;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: bold;
            border-radius: 4px;
            cursor: pointer;
          ">📹 监控 (SPACE)</button>
        </div>
      </div>

      <!-- 底部控制与武器栏 (触屏大按键优化) -->
      <div class="hud-bottom-bar" style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; gap: 8px;">
        <!-- 场景导航按钮组 -->
        <div class="interactive hud-nav-group" style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button id="btn-scene-door" style="${this.btnStyle(this.currentScene === 'door')}">
            [1] 正门 <span id="barricade-door" style="font-size: 10px; display: block; color: #ffaa00;">(木板: 3/3)</span>
          </button>
          <button id="btn-scene-window" style="${this.btnStyle(this.currentScene === 'window')}">
            [2] 窗户 <span id="barricade-window" style="font-size: 10px; display: block; color: #00ff88;">(完好)</span>
          </button>
          <button id="btn-scene-cellar" style="${this.btnStyle(this.currentScene === 'cellar')}">
            [3] 地窖 <span id="barricade-cellar" style="font-size: 10px; display: block; color: #00ff88;">(100%)</span>
          </button>
        </div>

        <!-- 移动端专属快捷动作栏 (切枪 / 装弹 / 攻击) -->
        <div class="interactive" style="display: flex; gap: 6px; align-items: flex-end;">
          <button id="btn-switch-weapon" style="
            background: #1e3a5f;
            border: 1px solid #3b82f6;
            color: #fff;
            padding: 10px 14px;
            min-height: 48px;
            font-size: 13px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          ">
            <span>🔄 切枪</span>
            <span style="font-size: 10px; color: #93c5fd;">[右键]</span>
          </button>

          <button id="btn-quick-reload" style="
            background: #451a03;
            border: 1px solid #f97316;
            color: #ffedd5;
            padding: 10px 14px;
            min-height: 48px;
            font-size: 13px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          ">
            <span>⚡ 装弹</span>
            <span style="font-size: 10px; color: #fdba74;">[R / 下拉]</span>
          </button>

          <!-- 武器状态卡片 -->
          <div style="background: rgba(0,0,0,0.85); padding: 10px 16px; border: 1px solid #555; border-radius: 6px; text-align: right; min-width: 140px;">
            <div style="font-size: 11px; color: #aaa;">当前装备</div>
            <div id="hud-weapon-name" style="font-size: 16px; font-weight: bold; color: #ffaa00; margin: 2px 0;">霰弹枪</div>
            <div id="hud-ammo-container" style="font-size: 13px; color: #ccc;">
              弹药: <span id="hud-ammo-val" style="color: #00ff88; font-weight: bold;">3 / 3</span>
            </div>
            <div id="hud-reload-hint" style="font-size: 10px; color: #888; margin-top: 2px;">轻触屏幕开火</div>
          </div>
        </div>
      </div>

      <!-- 浮动容错警报横幅 -->
      <div id="hud-alert-banner" style="
        position: absolute;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(180, 20, 20, 0.92);
        border: 2px solid #ff4444;
        box-shadow: 0 0 30px rgba(255, 50, 50, 0.6);
        color: #fff;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: bold;
        text-align: center;
        letter-spacing: 0.5px;
        z-index: 40;
        display: none;
        pointer-events: none;
        transition: all 0.3s ease;
      "></div>

      <style>
        @media (max-width: 768px) {
          .hud-top-bar {
            flex-wrap: wrap;
          }
          .hud-noise-panel {
            order: 3;
            width: 100%;
            max-width: 100% !important;
            margin-top: 4px;
          }
          .hud-bottom-bar {
            flex-direction: column-reverse;
            align-items: stretch !important;
            gap: 6px;
          }
          .hud-nav-group {
            justify-content: space-between;
          }
          .hud-nav-group button {
            flex: 1;
            padding: 8px 4px !important;
            font-size: 12px !important;
          }
        }
      </style>
    `;

    this.bindDomListeners();
  }

  public update(): void {
    const elapsedSec = this.waveSystem.getSurvivalSeconds();
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    const timerEl = document.getElementById('hud-timer');
    if (timerEl) timerEl.innerText = `${mins}:${secs}`;

    const killsEl = document.getElementById('hud-kills');
    if (killsEl) killsEl.innerText = this.waveSystem.getTotalKills().toString();

    const remainingEl = document.getElementById('hud-remaining');
    if (remainingEl) remainingEl.innerText = this.waveSystem.getRemainingInWave().toString();

    // 更新噪音进度条
    const noise = this.waveSystem.getNoiseLevel();
    const noisePercent = Math.min(100, Math.round((noise / 2.0) * 100));
    const noiseBar = document.getElementById('hud-noise-bar');
    const noiseText = document.getElementById('hud-noise-text');
    if (noiseBar) noiseBar.style.width = `${noisePercent}%`;
    if (noiseText) {
      if (noise > 1.2) {
        noiseText.innerText = '⚠️ 极度嘈杂 (怪潮狂暴加速!)';
        noiseText.style.color = '#ff2222';
      } else if (noise > 0.4) {
        noiseText.innerText = '🔊 产生枪声噪音';
        noiseText.style.color = '#ffaa00';
      } else {
        noiseText.innerText = '🤫 安静 (平缓生成)';
        noiseText.style.color = '#00ff88';
      }
    }

    // 更新防御工事耐久与容错状态
    const doorEl = document.getElementById('barricade-door');
    if (doorEl) {
      const b = Math.max(0, this.enemyManager.getDoorBoards());
      const turretReady = this.enemyManager.isDoorTurretAvailable();
      if (b > 0) {
        doorEl.innerText = `(木板: ${b}/3 | ${turretReady ? '机枪备战' : '机枪耗尽'})`;
        doorEl.style.color = b <= 1 ? '#ffaa00' : '#00ff88';
      } else {
        doorEl.innerText = turretReady ? `(木板全毁 [机枪就绪])` : `(木板全毁 [机枪已耗尽!])`;
        doorEl.style.color = '#ff2222';
      }
    }

    const cellarEl = document.getElementById('barricade-cellar');
    if (cellarEl) {
      const h = Math.max(0, this.enemyManager.getCellarHealth());
      const trapReady = this.enemyManager.isCellarTrapAvailable();
      if (h > 0) {
        cellarEl.innerText = `(${h}% | ${trapReady ? '陷阱就绪' : '陷阱已消耗'})`;
        cellarEl.style.color = h < 40 ? '#ffaa00' : '#00ff88';
      } else {
        cellarEl.innerText = trapReady ? `(活板门毁 [陷阱就绪])` : `(活板门毁 [陷阱已消耗!])`;
        cellarEl.style.color = '#ff2222';
      }
    }
  }

  private btnStyle(active: boolean): string {
    return `
      padding: 8px 12px;
      min-height: 44px;
      font-size: 13px;
      font-weight: bold;
      color: ${active ? '#fff' : '#aaa'};
      background: ${active ? '#2b4c7e' : 'rgba(20,20,20,0.85)'};
      border: 1px solid ${active ? '#4a7ec7' : '#444'};
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    `;
  }

  private showAlertBanner(message: string): void {
    const banner = document.getElementById('hud-alert-banner');
    if (!banner) return;
    banner.innerText = message;
    banner.style.display = 'block';
    banner.style.opacity = '1';

    setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => {
        banner.style.display = 'none';
      }, 300);
    }, 3500);
  }

  private bindDomListeners(): void {
    // 场景导航
    document.getElementById('btn-scene-door')?.addEventListener('click', () => {
      eventBus.emit('SCENE_CHANGED', 'door');
    });
    document.getElementById('btn-scene-window')?.addEventListener('click', () => {
      eventBus.emit('SCENE_CHANGED', 'window');
    });
    document.getElementById('btn-scene-cellar')?.addEventListener('click', () => {
      eventBus.emit('SCENE_CHANGED', 'cellar');
    });

    // 移动端快捷按钮
    document.getElementById('btn-switch-weapon')?.addEventListener('click', () => {
      eventBus.emit('TRIGGER_WEAPON_SWITCH');
    });
    document.getElementById('btn-quick-reload')?.addEventListener('click', () => {
      eventBus.emit('TRIGGER_RELOAD');
    });
    document.getElementById('btn-quick-cctv')?.addEventListener('click', () => {
      eventBus.emit('TRIGGER_CCTV_TOGGLE');
    });
  }

  private bindEvents(): void {
    eventBus.on('SCENE_CHANGED', (sceneId) => {
      this.currentScene = sceneId;
      this.updateSceneDisplay(sceneId);
    });

    eventBus.on('WEAPON_SWITCHED', (weapon) => {
      this.currentWeapon = weapon;
      this.updateWeaponDisplay();
    });

    eventBus.on('WEAPON_FIRED', ({ remainingAmmo }) => {
      this.ammo = remainingAmmo;
      this.updateAmmoDisplay();
    });

    eventBus.on('WEAPON_RELOAD_START', (data) => {
      const hint = document.getElementById('hud-reload-hint');
      if (hint) {
        const cur = data ? data.currentAmmo : this.ammo;
        hint.innerText = `⏳ 逐发装填 (${cur}/8)... [点击可打断]`;
        hint.style.color = '#ffaa00';
      }
    });

    eventBus.on('WEAPON_SHELL_INSERTED', ({ ammo, maxAmmo }) => {
      this.ammo = ammo;
      this.updateAmmoDisplay();
      const hint = document.getElementById('hud-reload-hint');
      if (hint) {
        hint.innerText = `⏳ 压入弹药 (${ammo}/${maxAmmo})... [左键随时开火打断]`;
        hint.style.color = '#ffaa00';
      }
    });

    eventBus.on('WEAPON_RELOAD_INTERRUPTED', (ammo) => {
      this.ammo = ammo;
      this.updateAmmoDisplay();
      const hint = document.getElementById('hud-reload-hint');
      if (hint) {
        hint.innerText = '⚡ 装弹打断已开火';
        hint.style.color = '#00ff88';
      }
    });

    eventBus.on('WEAPON_RELOAD_COMPLETE', (ammo) => {
      this.ammo = ammo;
      this.updateAmmoDisplay();
      const hint = document.getElementById('hud-reload-hint');
      if (hint) {
        hint.innerText = '轻触屏幕开火';
        hint.style.color = '#888';
      }
    });

    eventBus.on('FAULT_TOLERANCE_TRIGGERED', ({ message }) => {
      this.showAlertBanner(message);
    });

    eventBus.on('WAVE_STARTED', (wave) => {
      const el = document.getElementById('hud-wave');
      if (el) el.innerText = wave.toString();
    });
  }

  private updateSceneDisplay(sceneId: SceneType): void {
    const sceneNames: Record<SceneType, string> = {
      door: '正门 (1)',
      window: '窗户 (2)',
      cellar: '地窖 (3)',
    };
    const nameEl = document.getElementById('hud-scene-name');
    if (nameEl) nameEl.innerText = sceneNames[sceneId] || sceneId;

    ['door', 'window', 'cellar'].forEach((s) => {
      const btn = document.getElementById(`btn-scene-${s}`);
      if (btn) {
        btn.style.cssText = this.btnStyle(s === sceneId);
      }
    });
  }

  private updateWeaponDisplay(): void {
    const nameEl = document.getElementById('hud-weapon-name');
    const ammoContainer = document.getElementById('hud-ammo-container');
    if (!nameEl || !ammoContainer) return;

    if (this.currentWeapon === 'shotgun') {
      nameEl.innerText = '泵动式霰弹枪';
      nameEl.style.color = '#ffaa00';
      ammoContainer.style.display = 'block';
    } else {
      nameEl.innerText = '战术刀';
      nameEl.style.color = '#44ddff';
      ammoContainer.style.display = 'none';
    }
  }

  private updateAmmoDisplay(): void {
    const el = document.getElementById('hud-ammo-val');
    if (el) {
      el.innerText = `${this.ammo} / ${GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE}`;
      el.style.color = this.ammo === 0 ? '#ff3333' : '#00ff88';
    }
  }
}
