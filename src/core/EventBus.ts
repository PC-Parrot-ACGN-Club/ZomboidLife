import EventEmitter from 'eventemitter3';

export type GameEventMap = {
  // 场景事件
  SCENE_CHANGED: (sceneId: 'door' | 'window' | 'cellar') => void;

  // 战斗与武器事件
  WEAPON_SWITCHED: (weaponType: 'shotgun' | 'knife') => void;
  WEAPON_FIRED: (data: { weapon: 'shotgun' | 'knife'; remainingAmmo: number }) => void;
  WEAPON_RELOAD_START: () => void;
  WEAPON_RELOAD_COMPLETE: (ammo: number) => void;
  NOISE_PRODUCED: (intensity: number) => void;

  // 敌人与伤害事件
  ENEMY_SPAWNED: (data: { id: string; type: string; sceneId: string }) => void;
  ENEMY_DAMAGED: (data: { id: string; damage: number }) => void;
  ENEMY_KILLED: (data: { id: string; type: string; sceneId: string }) => void;
  BARRICADE_DAMAGED: (data: { sceneId: string; currentHealth: number; maxHealth: number }) => void;

  // 波次与游戏流程
  WAVE_STARTED: (waveNumber: number) => void;
  WAVE_CLEARED: (waveNumber: number) => void;
  GAME_OVER: (stats: { survivalTime: number; kills: number; waves: number }) => void;
  GAME_RESTART: () => void;
};

class TypedEventBus extends EventEmitter<GameEventMap> {}

export const eventBus = new TypedEventBus();
