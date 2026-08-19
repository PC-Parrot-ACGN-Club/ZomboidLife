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
      <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
        <div style="background: rgba(0,0,0,0.75); padding: 10px 18px; border: 1px solid #444; border-radius: 6px;">
          <div style="font-size: 22px; font-weight: bold; color: #ff4444; letter-spacing: 1px;">
            WAVE <span id="hud-wave">1</span>
          </div>
          <div style="font-size: 13px; color: #aaa; margin-top: 4px;">
            生存时间: <span id="hud-timer" style="color: #00ff88; font-weight: bold;">00:00</span> | 击杀: <span id="hud-kills" style="color: #44ddff;">0</span>
          </div>
          <div style="font-size: 12px; color: #ffaa00; margin-top: 4px;">
            本波剩余敌人: <span id="hud-remaining" style="font-weight: bold;">0</span>
          </div>
        </div>

        <!-- 噪音指示器 (核心机制) -->
        <div style="background: rgba(0,0,0,0.75); padding: 10px 18px; border: 1px solid #444; border-radius: 6px; text-align: center; min-width: 220px;">
          <div style="font-size: 12px; color: #aaa; margin-bottom: 4px;">枪声噪音指数 (开枪引怪加速)</div>
          <div style="width: 100%; height: 10px; background: #222; border-radius: 5px; overflow: hidden; border: 1px solid #555;">
            <div id="hud-noise-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00ff88, #ffaa00, #ff2222); transition: width 0.1s;"></div>
          </div>
          <div id="hud-noise-text" style="font-size: 11px; color: #00ff88; margin-top: 4px;">安静 (平静刷新)</div>
        </div>

        <!-- 当前视角 -->
        <div style="background: rgba(0,0,0,0.75); padding: 10px 18px; border: 1px solid #444; border-radius: 6px; text-align: right;">
          <div style="font-size: 12px; color: #888;">当前视角</div>
          <div id="hud-scene-name" style="font-size: 16px; font-weight: bold; color: #44ccff;">正门 / 监控台 (1)</div>
          <div style="font-size: 11px; color: #aaa; margin-top: 4px;">[A / D 键快速切换]</div>
        </div>
      </div>

      <!-- 底部控制与武器栏 -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%;">
        <!-- 场景导航按钮与防御状态 -->
        <div class="interactive" style="display: flex; gap: 10px;">
          <button id="btn-scene-door" style="${this.btnStyle(this.currentScene === 'door')}">
            [1] 正门 <span id="barricade-door" style="font-size: 11px; color: #ffaa00;">(木板: 3/3)</span>
          </button>
          <button id="btn-scene-window" style="${this.btnStyle(this.currentScene === 'window')}">
            [2] 窗户 <span id="barricade-window" style="font-size: 11px; color: #00ff88;">(完好)</span>
          </button>
          <button id="btn-scene-cellar" style="${this.btnStyle(this.currentScene === 'cellar')}">
            [3] 活板门 <span id="barricade-cellar" style="font-size: 11px; color: #00ff88;">(100%)</span>
          </button>
        </div>

        <!-- 武器与弹药栏 -->
        <div class="interactive" style="background: rgba(0,0,0,0.85); padding: 14px 22px; border: 1px solid #555; border-radius: 6px; text-align: right; min-width: 260px;">
          <div style="font-size: 12px; color: #aaa;">[鼠标右键切换武器]</div>
          <div style="font-size: 20px; font-weight: bold; margin: 4px 0;">
            武器: <span id="hud-weapon-name" style="color: #ffaa00;">霰弹枪 (Shotgun)</span>
          </div>
          <div id="hud-ammo-container" style="font-size: 15px; color: #ccc;">
            弹药: <span id="hud-ammo-val" style="color: #00ff88; font-weight: bold;">3 / 3</span> 
            <div id="hud-reload-hint" style="font-size: 11px; color: #888; margin-top: 2px;">(移到底部或按 R 装弹)</div>
          </div>
        </div>
      </div>
    `;

    this.bindDomListeners();
  }

  public update(): void {
    // 更新计时与击杀
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
        noiseText.innerText = '⚠️ 极度嘈杂 (怪物高速集结中!)';
        noiseText.style.color = '#ff2222';
      } else if (noise > 0.4) {
        noiseText.innerText = '🔊 产生枪声噪音';
        noiseText.style.color = '#ffaa00';
      } else {
        noiseText.innerText = '🤫 安静 (怪物平缓生成)';
        noiseText.style.color = '#00ff88';
      }
    }

    // 更新防御工事耐久
    const doorEl = document.getElementById('barricade-door');
    if (doorEl) {
      const b = Math.max(0, this.enemyManager.getDoorBoards());
      doorEl.innerText = `(木板: ${b}/3)`;
      doorEl.style.color = b <= 1 ? '#ff2222' : '#ffaa00';
    }

    const cellarEl = document.getElementById('barricade-cellar');
    if (cellarEl) {
      const h = Math.max(0, this.enemyManager.getCellarHealth());
      cellarEl.innerText = `(${h}%)`;
      cellarEl.style.color = h < 40 ? '#ff2222' : '#00ff88';
    }
  }

  private btnStyle(active: boolean): string {
    return `
      padding: 10px 16px;
      font-size: 14px;
      font-weight: bold;
      color: ${active ? '#fff' : '#aaa'};
      background: ${active ? '#2b4c7e' : 'rgba(20,20,20,0.85)'};
      border: 1px solid ${active ? '#4a7ec7' : '#444'};
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    `;
  }

  private bindDomListeners(): void {
    document.getElementById('btn-scene-door')?.addEventListener('click', () => {
      eventBus.emit('SCENE_CHANGED', 'door');
    });
    document.getElementById('btn-scene-window')?.addEventListener('click', () => {
      eventBus.emit('SCENE_CHANGED', 'window');
    });
    document.getElementById('btn-scene-cellar')?.addEventListener('click', () => {
      eventBus.emit('SCENE_CHANGED', 'cellar');
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

    eventBus.on('WEAPON_RELOAD_START', () => {
      const hint = document.getElementById('hud-reload-hint');
      if (hint) {
        hint.innerText = '⏳ 正在装弹 (Reloading)...';
        hint.style.color = '#ffaa00';
      }
    });

    eventBus.on('WEAPON_RELOAD_COMPLETE', (ammo) => {
      this.ammo = ammo;
      this.updateAmmoDisplay();
      const hint = document.getElementById('hud-reload-hint');
      if (hint) {
        hint.innerText = '(移到底部或按 R 装弹)';
        hint.style.color = '#888';
      }
    });

    eventBus.on('WAVE_STARTED', (wave) => {
      const el = document.getElementById('hud-wave');
      if (el) el.innerText = wave.toString();
    });
  }

  private updateSceneDisplay(sceneId: SceneType): void {
    const sceneNames: Record<SceneType, string> = {
      door: '正门 / 监控台 (1)',
      window: '窗户防守 (2)',
      cellar: '地窖活板门 (3)',
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
      nameEl.innerText = '霰弹枪 (Shotgun)';
      nameEl.style.color = '#ffaa00';
      ammoContainer.style.display = 'block';
    } else {
      nameEl.innerText = '战术刀 (Knife)';
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
