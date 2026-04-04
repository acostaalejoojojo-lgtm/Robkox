
export interface User {
  username: string;
  displayName: string;
  robux: number;
  avatarUrl?: string; 
  friends?: string[]; // List of usernames
  avatarConfig?: AvatarConfig;
  settings?: AppSettings;
}

export interface MapObject {
  id: string;
  name: string;
  type: 'Part' | 'Sphere' | 'Wedge' | 'Cylinder' | 'Model' | 'Sound' | 'Video';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  material: 'Plastic' | 'Neon' | 'Grass' | 'Wood' | 'Brick' | 'Fabric';
  transparency: number;
  anchored: boolean;
  canCollide: boolean;
  assetUrl?: string; // For imported models, sounds, videos (Blob URL)
  volume?: number;
  loop?: boolean;
  playing?: boolean;
  autoPlay?: boolean;
  trigger?: 'None' | 'OnDeath' | 'OnJump' | 'OnFall' | 'OnSpawn'; // New: Sound triggers
  isAvatarReplacement?: boolean; // New: Use this object as player avatar
  selectedAnimation?: string; // New: Selected animation name
  availableAnimations?: string[]; // New: List of available animations
  health?: number; // New: Health for bots/players
  maxHealth?: number;
  isWeapon?: boolean; // New: Is this a pickupable weapon
  weaponType?: string;
  isBot?: boolean; // New: Is this an AI bot
  team?: 'Red' | 'Blue'; // New: Team for 4vs4
  isShooter?: boolean; // New: Flag for shooter template
}

export interface GameVersion {
  id: string;
  timestamp: string;
  mapData: MapObject[];
  skybox: string;
}

export interface Game {
  id: string;
  title: string;
  creator: string;
  thumbnail: string;
  likes: string;
  playing: number;
  mapData?: MapObject[]; // Current map state
  skybox?: string; // Current skybox
  versions?: GameVersion[]; // History of versions
}

export interface AvatarConfig {
  bodyColors: {
    head: string;
    torso: string;
    leftArm: string;
    rightArm: string;
    leftLeg: string;
    rightLeg: string;
  };
  faceTextureUrl: string | null; // URL string (blob or http)
  faceVideoUrl?: string | null; // New: Video face
  accessories: {
    hatModelUrl: string | null; // URL string for .glb/.gltf
    shirtTextureUrl: string | null;
  };
  hideFace: boolean;
}

export interface StoreItem {
  id: string;
  name: string;
  type: 'face' | 'hat' | 'shirt';
  price: number; // 0 for free
  thumbnail: string; // URL or placeholder
  assetUrl: string; // The actual content
  creator: string;
}

export interface Server {
  id: string;
  name: string; // e.g., "Server de Juan"
  ping: number;
  players: number;
  maxPlayers: number;
  friendsInServer?: string[]; // Avatars of friends
}

export interface RemotePlayer {
  id: string;
  username: string;
  country?: string; // New: Multi-country support
  position: [number, number, number];
  rotation: [number, number, number];
  config: AvatarConfig;
  isMoving: boolean;
  isJumping: boolean;
  isTalking?: boolean; // New: Voice indicator
  currentAnimation?: string; // New: Sync animations
  targetPosition?: [number, number, number]; // For interpolation/simulation
}

export enum Page {
  HOME = 'HOME',
  PROFILE = 'PROFILE',
  GAMES = 'GAMES',
  AVATAR = 'AVATAR',
  STORE = 'STORE',
  STUDIO = 'STUDIO',
  PLAY = 'PLAY',
  SOCIAL = 'SOCIAL',
  SETTINGS = 'SETTINGS'
}

export interface AppSettings {
  language: 'es' | 'en';
  backgroundColor: string;
}
