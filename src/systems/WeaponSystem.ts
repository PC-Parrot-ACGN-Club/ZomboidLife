import { GAME_CONFIG, SceneType, WeaponType } from '@/config/GameConfig';
import { eventBus } from '@/core/EventBus';
import { audioManager } from '@/audio/AudioManager';
import { EnemyManager } from './EnemyManager';

export class WeaponSystem {
  private currentWeapon: WeaponType = 'shotgun';
  private ammo: number = GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE;
  private isReloading: boolean = false;
  private reloadProgressMs: number = 0;
  private attackCooldownMs: number = 0;
  private enemyManager: EnemyManager;
  private currentScene: SceneType = GAME_CONFIG.SCENES.DOOR;
  private recoilShake: number = 0;

  constructor(enemyManager: EnemyManager) {
    this.enemyManager = enemyManager;
    this.bindInputs();
    this.bindEvents();
  }

  public reset(): void {
    this.currentWeapon = 'shotgun';
    this.ammo = GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE;
    this.isReloading = false;
    this.reloadProgressMs = 0;
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

    // 装弹计时
    if (this.isReloading) {
      this.reloadProgressMs += deltaMs;
      const targetTime = GAME_CONFIG.WEAPONS.SHOTGUN.RELOAD_TIME_MS;
      if (this.reloadProgressMs >= targetTime) {
        this.isReloading = false;
        this.reloadProgressMs = 0;
        this.ammo = GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE;
        audioManager.playReload();
        eventBus.emit('WEAPON_RELOAD_COMPLETE', this.ammo);
      }
    }
  }

  public switchWeapon(): void {
    if (this.isReloading) return;
    this.currentWeapon = this.currentWeapon === 'shotgun' ? 'knife' : 'shotgun';
    eventBus.emit('WEAPON_SWITCHED', this.currentWeapon);
  }

  public startReload(): void {
    if (this.currentWeapon !== 'shotgun') return;
    if (this.ammo >= GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE) return;
    if (this.isReloading) return;

    this.isReloading = true;
    this.reloadProgressMs = 0;
    audioManager.playReload();
    eventBus.emit('WEAPON_RELOAD_START');
  }

  public attack(): void {
    if (this.attackCooldownMs > 0) return;

    if (this.currentWeapon === 'shotgun') {
      if (this.isReloading) return;

      if (this.ammo <= 0) {
        // 没子弹自动提示/尝试装弹
        this.startReload();
        return;
      }

      // 消耗弹药并开火
      this.ammo--;
      this.attackCooldownMs = GAME_CONFIG.WEAPONS.SHOTGUN.COOLDOWN_MS;
      this.recoilShake = 12; // 触发震屏

      audioManager.playShotgunFire();
      eventBus.emit('WEAPON_FIRED', { weapon: 'shotgun', remainingAmmo: this.ammo });
      eventBus.emit('NOISE_PRODUCED', GAME_CONFIG.WEAPONS.SHOTGUN.NOISE_INTENSITY);

      // 判定击中
      this.enemyManager.hitEnemiesInScene(
        this.currentScene,
        'shotgun',
        GAME_CONFIG.WEAPONS.SHOTGUN.DAMAGE
      );
    } else {
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
    // 鼠标右键切换武器
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.switchWeapon();
    });

    // 鼠标左键射击/挥砍
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        // 避免点击 UI 按钮时开火
        const target = e.target as HTMLElement;
        if (target.closest('.interactive') || target.tagName === 'BUTTON') return;
        this.attack();
      }
    });

    // 键盘 R 键装弹
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'r') {
        this.startReload();
      }
    });

    // 鼠标移到画面底部 (Y > 92% 视口高度) 自动触发装弹
    window.addEventListener('mousemove', (e) => {
      const threshold = window.innerHeight * 0.92;
      if (e.clientY >= threshold && this.currentWeapon === 'shotgun' && this.ammo < GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE) {
        this.startReload();
      }
    });
  }

  private bindEvents(): void {
    eventBus.on('SCENE_CHANGED', (sceneId) => {
      this.currentScene = sceneId;
    });

    eventBus.on('GAME_RESTART', () => {
      this.reset();
    });
  }
}
