import { GAME_CONFIG, SceneType, WeaponType } from '@/config/GameConfig';
import { eventBus } from '@/core/EventBus';
import { audioManager } from '@/audio/AudioManager';
import { EnemyManager } from './EnemyManager';

export class WeaponSystem {
  private currentWeapon: WeaponType = 'shotgun';
  private ammo: number = GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE;
  private isReloading: boolean = false;
  private reloadShellTimerMs: number = 0;
  private attackCooldownMs: number = 0;
  private enemyManager: EnemyManager;
  private currentScene: SceneType = GAME_CONFIG.SCENES.DOOR;
  private recoilShake: number = 0;
  private pumpSoundTimeout: number | null = null;

  constructor(enemyManager: EnemyManager) {
    this.enemyManager = enemyManager;
    this.bindInputs();
    this.bindEvents();
  }

  public reset(): void {
    if (this.pumpSoundTimeout !== null) {
      clearTimeout(this.pumpSoundTimeout);
      this.pumpSoundTimeout = null;
    }
    this.currentWeapon = 'shotgun';
    this.ammo = GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE;
    this.isReloading = false;
    this.reloadShellTimerMs = 0;
    this.attackCooldownMs = 0;
    this.recoilShake = 0;
  }

  public update(deltaMs: number): void {
    // 冷却计时
    if (this.attackCooldownMs > 0) {
      this.attackCooldownMs -= deltaMs;
    }

    // 后坐力震屏衰减
    if (this.recoilShake > 0) {
      this.recoilShake = Math.max(0, this.recoilShake - deltaMs * 0.05);
    }

    // 逐发装弹计时 (Shell-by-shell reload)
    if (this.isReloading) {
      this.reloadShellTimerMs += deltaMs;
      const targetTime = GAME_CONFIG.WEAPONS.SHOTGUN.RELOAD_TIME_PER_SHELL_MS;

      if (this.reloadShellTimerMs >= targetTime) {
        this.reloadShellTimerMs = 0;
        this.ammo++;

        // 播放单发压弹声
        audioManager.playShellInsert();
        eventBus.emit('WEAPON_SHELL_INSERTED', {
          ammo: this.ammo,
          maxAmmo: GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE,
        });

        // 若已装满 8 发，完成装填并拉栓
        if (this.ammo >= GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE) {
          this.isReloading = false;
          audioManager.playShotgunPump();
          eventBus.emit('WEAPON_RELOAD_COMPLETE', this.ammo);
        }
      }
    }
  }

  public switchWeapon(): void {
    if (this.isReloading) {
      this.interruptReload();
    }
    this.currentWeapon = this.currentWeapon === 'shotgun' ? 'knife' : 'shotgun';
    eventBus.emit('WEAPON_SWITCHED', this.currentWeapon);
  }

  public setWeapon(weapon: WeaponType): void {
    if (this.currentWeapon !== weapon) {
      this.switchWeapon();
    }
  }

  public getAttackCooldownMs(): number {
    return this.attackCooldownMs;
  }

  public startReload(): void {
    if (this.currentWeapon !== 'shotgun') return;
    if (this.ammo >= GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE) return;
    if (this.isReloading) return;

    this.isReloading = true;
    this.reloadShellTimerMs = 0;
    eventBus.emit('WEAPON_RELOAD_START', {
      currentAmmo: this.ammo,
      maxAmmo: GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE,
    });
  }

  public interruptReload(): void {
    if (!this.isReloading) return;
    this.isReloading = false;
    this.reloadShellTimerMs = 0;
    eventBus.emit('WEAPON_RELOAD_INTERRUPTED', this.ammo);
  }

  public attack(): void {
    if (this.attackCooldownMs > 0) return;

    if (this.currentWeapon === 'shotgun') {
      // 若正在逐发装弹中：若有弹药则立即打断装弹开火，若无弹药则继续装填
      if (this.isReloading) {
        if (this.ammo > 0) {
          this.interruptReload();
        } else {
          return;
        }
      }

      if (this.ammo <= 0) {
        this.startReload();
        return;
      }

      // 消耗 1 发弹药并开火
      this.ammo--;
      this.attackCooldownMs = GAME_CONFIG.WEAPONS.SHOTGUN.COOLDOWN_MS;
      this.recoilShake = 12; // 触发震屏

      audioManager.playShotgunFire();

      // 开火后 240ms 触发泵动推弹上膛机械声 (Pump Action)
      if (this.pumpSoundTimeout !== null) {
        clearTimeout(this.pumpSoundTimeout);
      }
      this.pumpSoundTimeout = window.setTimeout(() => {
        audioManager.playShotgunPump();
        this.pumpSoundTimeout = null;
      }, 240);

      eventBus.emit('WEAPON_FIRED', { weapon: 'shotgun', remainingAmmo: this.ammo });
      eventBus.emit('NOISE_PRODUCED', GAME_CONFIG.WEAPONS.SHOTGUN.NOISE_INTENSITY);

      // 判定击中
      this.enemyManager.hitEnemiesInScene(
        this.currentScene,
        'shotgun',
        GAME_CONFIG.WEAPONS.SHOTGUN.DAMAGE
      );
    } else {
      if (this.isReloading) {
        this.interruptReload();
      }

      // 战术刀挥击
      this.attackCooldownMs = GAME_CONFIG.WEAPONS.KNIFE.COOLDOWN_MS;
      audioManager.playKnifeSwing();
      eventBus.emit('WEAPON_FIRED', { weapon: 'knife', remainingAmmo: Infinity });

      // 静音不产生噪音
      this.enemyManager.hitEnemiesInScene(
        this.currentScene,
        'knife',
        GAME_CONFIG.WEAPONS.KNIFE.DAMAGE
      );
    }
  }

  public getIsReloading(): boolean {
    return this.isReloading;
  }

  public getCurrentWeapon(): WeaponType {
    return this.currentWeapon;
  }

  public getAmmo(): number {
    return this.ammo;
  }

  public getRecoilOffset(): { x: number; y: number } {
    if (this.recoilShake <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.recoilShake,
      y: (Math.random() - 0.5) * this.recoilShake,
    };
  }

  private bindInputs(): void {
    // 鼠标右键切换武器 (PC)
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.switchWeapon();
    });

    // 鼠标左键射击/挥砍 (PC)
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        const target = e.target as HTMLElement;
        if (target.closest('.interactive') || target.tagName === 'BUTTON') return;
        this.attack();
      }
    });

    // 键盘 R 键装弹 (PC)
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'r') {
        this.startReload();
      }
    });

    // 鼠标移到画面底部自动装弹 (PC)
    window.addEventListener('mousemove', (e) => {
      const threshold = window.innerHeight * 0.92;
      if (
        e.clientY >= threshold &&
        this.currentWeapon === 'shotgun' &&
        this.ammo < GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE
      ) {
        this.startReload();
      }
    });
  }

  private bindEvents(): void {
    eventBus.on('SCENE_CHANGED', (sceneId) => {
      this.currentScene = sceneId;
    });

    // 移动端手势或按钮派发的动作
    eventBus.on('TRIGGER_ATTACK', () => {
      this.attack();
    });

    eventBus.on('TRIGGER_RELOAD', () => {
      this.startReload();
    });

    eventBus.on('TRIGGER_WEAPON_SWITCH', () => {
      this.switchWeapon();
    });

    eventBus.on('GAME_RESTART', () => {
      this.reset();
    });
  }
}
