
export interface User {
  uid: string;
  username: string;
  displayName: string;
  robux: number;
  drovis: number; // New currency
  avatarUrl?: string; 
  friends?: string[]; // List of UIDs
  avatarConfig?: AvatarConfig;
  settings?: AppSettings;
  xp?: number;
  level?: number;
  gallery?: string[]; // New: List of video URLs for profile
  playedHistory?: string[]; // New: List of game IDs played
  clothingHistory?: string[]; // New: List of item IDs used
  rank?: string; // New: Platinum, Standard, etc.
  lastUsernameChange?: string; // New: ISO date
  usernameChangeCards?: number; // New: Count
}

export interface MapObject {
  id: string;
  name: string;
  type: 'Part' | 'Sphere' | 'Wedge' | 'Cylinder' | 'Model' | 'Sound' | 'Video' | 'Canvas' | 'Text' | 'Button' | 'Terrain' | 'Camera';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  material: 'Plastic' | 'Neon' | 'Grass' | 'Wood' | 'Brick' | 'Fabric';
  transparency: number;
  anchored: boolean;
  canCollide: boolean;
  meshCollision?: boolean; // New: Use actual mesh geometry for collision
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
  effect?: 'none' | 'snow' | 'rain' | 'fire' | 'lights' | 'rainbow'; // New: Special effects
  textureUrl?: string; // New: Image texture for Parts
  terrainData?: number[][]; // New: Heightmap for terrain
  isTerrain?: boolean; // New: Flag for terrain object
  proximityTrigger?: boolean; // New: Play sound/video when close
  touchTrigger?: boolean; // New: Play sound/video when touched
  triggerDistance?: number; // New: Distance for proximity trigger
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
  creatorUid: string;
  thumbnail: string;
  likes: string; // Legacy percentage
  likesCount?: number; // New: Total likes
  stars?: number; // New: Average stars (1-5)
  starCount?: number; // New: Total ratings
  playing: number;
  mapData?: MapObject[]; // Current map state
  skybox?: string; // Current skybox
  versions?: GameVersion[]; // History of versions
}

export interface Video {
  id: string;
  url: string;
  creatorUid: string;
  creatorName: string;
  likes: string[]; // List of UIDs
  createdAt: string;
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
  invisible?: boolean; // New: Make avatar invisible
  selectedAnimation?: string; // New: Selected animation from menu
  customModelUrl?: string | null; // New: Import a full avatar replacement
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
  status: 'online' | 'offline' | 'full';
  region: string; // e.g., "Google Cloud", "Oracle Cloud"
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
  selectedAnimation?: string; // New: Selected animation from menu
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
  selectedRegion?: string;
}
