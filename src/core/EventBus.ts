import EventEmitter from 'eventemitter3';

export type GameEventMap = {
  // 场景事件
  SCENE_CHANGED: (sceneId: 'door' | 'window' | 'cellar') => void;

  // 战斗与武器事件
  WEAPON_SWITCHED: (weaponType: 'shotgun' | 'knife') => void;
  WEAPON_FIRED: (data: { weapon: 'shotgun' | 'knife'; remainingAmmo: number }) => void;
  WEAPON_RELOAD_START: (data?: { currentAmmo: number; maxAmmo: number }) => void;
  WEAPON_SHELL_INSERTED: (data: { ammo: number; maxAmmo: number }) => void;
  WEAPON_RELOAD_INTERRUPTED: (ammo: number) => void;
  WEAPON_RELOAD_COMPLETE: (ammo: number) => void;
  NOISE_PRODUCED: (intensity: number) => void;

  // 移动端/UI 触发事件
  TRIGGER_ATTACK: () => void;
  TRIGGER_RELOAD: () => void;
  TRIGGER_WEAPON_SWITCH: () => void;
  TRIGGER_CCTV_TOGGLE: () => void;

  // 敌人与伤害事件
  ENEMY_SPAWNED: (data: { id: string; type: string; sceneId: string }) => void;
  ENEMY_DAMAGED: (data: { id: string; damage: number }) => void;
  ENEMY_KILLED: (data: { id: string; type: string; sceneId: string }) => void;
  LAUGHER_ATTACK_DECIDED: (data: { id: string }) => void;
  LAUGHER_SCARED_AWAY: (data: { id: string }) => void;
  MIMIC_VOICE_EMITTED: (data: { id: string; voiceType: 'own' | 'walker' | 'laugher' }) => void;
  BARRICADE_DAMAGED: (data: { sceneId: string; currentHealth: number; maxHealth: number }) => void;
  FAULT_TOLERANCE_TRIGGERED: (data: {
    type: 'turret' | 'trap';
    sceneId: 'door' | 'cellar';
    message: string;
    clearedCount: number;
  }) => void;

  // AI 自动游玩模式
  AI_MODE_TOGGLED: (enabled: boolean) => void;
  AI_THOUGHT_UPDATED: (data: {
    enabled: boolean;
    state: string;
    thought: string;
    targetScene: 'door' | 'window' | 'cellar';
    threats: { door: number; window: number; cellar: number };
    actionText: string;
  }) => void;

  // 波次与游戏流程
  WAVE_STARTED: (waveNumber: number) => void;
  WAVE_CLEARED: (waveNumber: number) => void;
  GAME_OVER: (stats: { survivalTime: number; kills: number; waves: number }) => void;
  GAME_RESTART: (data?: { aiMode?: boolean }) => void;
};

class TypedEventBus extends EventEmitter<GameEventMap> {}

export const eventBus = new TypedEventBus();
