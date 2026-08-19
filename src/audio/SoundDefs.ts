export interface SoundDef {
  id: string;
  src: string[];
  volume: number;
  pan: number; // -1.0 (全左) 到 1.0 (全右)，0.0 为居中
  loop?: boolean;
}

export const SOUND_DEFINITIONS: Record<string, SoundDef> = {
  // 武器音效
  SHOTGUN_FIRE: {
    id: 'shotgun_fire',
    src: ['/assets/audio/shotgun_fire.mp3'],
    volume: 1.0,
    pan: 0.0,
  },
  SHOTGUN_RELOAD: {
    id: 'shotgun_reload',
    src: ['/assets/audio/shotgun_reload.mp3'],
    volume: 0.7,
    pan: 0.0,
  },
  KNIFE_SWING: {
    id: 'knife_swing',
    src: ['/assets/audio/knife_swing.mp3'],
    volume: 0.6,
    pan: 0.0,
  },
  KNIFE_HIT: {
    id: 'knife_hit',
    src: ['/assets/audio/knife_hit.mp3'],
    volume: 0.8,
    pan: 0.0,
  },

  // 场景与环境音效 (带立体声定位)
  DOOR_BANG: {
    id: 'door_bang',
    src: ['/assets/audio/door_bang.mp3'],
    volume: 0.9,
    pan: 0.0, // 正门居中
  },
  WINDOW_TAP: {
    id: 'window_tap',
    src: ['/assets/audio/window_tap.mp3'],
    volume: 0.8,
    pan: 0.7, // 窗户偏右
  },
  WINDOW_LAUGH: {
    id: 'window_laugh',
    src: ['/assets/audio/window_laugh.mp3'],
    volume: 0.85,
    pan: 0.7, // 窗户偏右
  },
  CELLAR_CLIMB: {
    id: 'cellar_climb',
    src: ['/assets/audio/cellar_climb.mp3'],
    volume: 0.8,
    pan: -0.7, // 地窖偏左
  },
  MIMIC_FAKE_SOUND: {
    id: 'mimic_fake_sound',
    src: ['/assets/audio/mimic_fake.mp3'],
    volume: 0.85,
    pan: -0.7, // 拟态者声源固定在左边地窖
  },

  // UI 与系统音效
  SCENE_SWITCH: {
    id: 'scene_switch',
    src: ['/assets/audio/scene_switch.mp3'],
    volume: 0.5,
    pan: 0.0,
  },
  GAME_OVER: {
    id: 'game_over',
    src: ['/assets/audio/game_over.mp3'],
    volume: 1.0,
    pan: 0.0,
  },
};
