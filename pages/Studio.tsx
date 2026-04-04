import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid, Sky, Stars, useGLTF } from '@react-three/drei';
import { MousePointer2, Move, Maximize, RotateCw, Box as BoxIcon, Circle as CircleIcon, Triangle as TriangleIcon, Cylinder as CylinderIcon, Save, Play, Square, Home, ArrowLeft, Upload, FileBox, Gamepad, Volume2, Video as VideoIcon, Mic, MicOff, Sun, Moon, Cloud, CloudSun, Star, Skull, Search, UserPlus, Layout } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { PositionalAudio, VideoTexture } from '@react-three/drei';
import { AnimationMixer, LoopRepeat } from 'three';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MapObject, AvatarConfig, RemotePlayer, Server, Game } from '../types';
import { VoxelCharacter } from '../components/AvatarScene';
import ErrorBoundary from '../components/ErrorBoundary';

// --- WEBRTC MANAGER ---

class WebRTCManager {
  peers: Map<string, RTCPeerConnection> = new Map();
  localStream: MediaStream | null = null;
  socket: Socket;
  roomId: string;
  onStream: (id: string, stream: MediaStream) => void;
  onDisconnect: (id: string) => void;

  constructor(socket: Socket, roomId: string, onStream: (id: string, stream: MediaStream) => void, onDisconnect: (id: string) => void) {
    this.socket = socket;
    this.roomId = roomId;
    this.onStream = onStream;
    this.onDisconnect = onDisconnect;
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    this.peers.forEach(pc => {
      // Avoid adding tracks multiple times
      const senders = pc.getSenders();
      stream.getTracks().forEach(track => {
        if (!senders.find(s => s.track === track)) {
          pc.addTrack(track, stream);
        }
      });
    });
  }

  async createPeer(targetId: string, isInitiator: boolean) {
    if (this.peers.has(targetId)) return this.peers.get(targetId);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.peers.set(targetId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc-signal', this.roomId, targetId, { type: 'ice-candidate', candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      this.onStream(targetId, event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            this.removePeer(targetId);
        }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream!));
    }

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('webrtc-signal', this.roomId, targetId, { type: 'offer', sdp: offer.sdp });
    }

    return pc;
  }

  async handleSignal(senderId: string, signal: any) {
    let pc = this.peers.get(senderId);

    if (signal.type === 'offer') {
      if (!pc) pc = await this.createPeer(senderId, false);
      await pc!.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
      const answer = await pc!.createAnswer();
      await pc!.setLocalDescription(answer);
      this.socket.emit('webrtc-signal', this.roomId, senderId, { type: 'answer', sdp: answer.sdp });
    } else if (signal.type === 'answer') {
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
    } else if (signal.type === 'ice-candidate') {
      if (pc && signal.candidate) {
          try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
              console.error("Error adding ice candidate", e);
          }
      }
    }
  }

  removePeer(id: string) {
    const pc = this.peers.get(id);
    if (pc) {
      pc.close();
      this.peers.delete(id);
      this.onDisconnect(id);
    }
  }

  destroy() {
      this.peers.forEach(pc => pc.close());
      this.peers.clear();
  }
}

// --- HELPERS ---

const SKYBOXES = {
    Day: { sunPosition: [100, 20, 100], stars: false, fog: '#87ceeb', icon: <Sun size={16} /> },
    Night: { sunPosition: [0, -10, 0], stars: true, fog: '#050505', icon: <Moon size={16} /> },
    Sunset: { sunPosition: [100, 2, 100], stars: false, fog: '#ff7f50', icon: <CloudSun size={16} /> },
    Space: { sunPosition: [0, 0, 0], stars: true, fog: '#000000', icon: <Star size={16} /> },
    Cloudy: { sunPosition: [0, 50, 0], stars: false, fog: '#a0a0a0', icon: <Cloud size={16} /> }
};

const ModelGLTF = ({ url, isPlaying, selectedAnimation, onAnimationsLoaded }: { 
  url: string; 
  isPlaying?: boolean; 
  selectedAnimation?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}) => {
  const { scene, animations } = useGLTF(url);
  const mixer = useRef<AnimationMixer | null>(null);
  const clone = React.useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    if (animations?.length && onAnimationsLoaded) {
      onAnimationsLoaded(animations.map(a => a.name));
    }
  }, [animations, onAnimationsLoaded]);

  useEffect(() => {
    if (clone) {
      const box = new THREE.Box3().setFromObject(clone);
      const size = box.getSize(new THREE.Vector3());
      const targetHeight = 3;
      if (size.y > 0) {
        const scale = targetHeight / size.y;
        clone.scale.set(scale, scale, scale);
      }

      if (isPlaying && animations?.length) {
        mixer.current = new AnimationMixer(clone);
        const animToPlay = selectedAnimation 
          ? animations.find(a => a.name === selectedAnimation) || animations[0]
          : animations[0];
        const action = mixer.current.clipAction(animToPlay);
        action.play();
      } else {
        mixer.current?.stopAllAction();
      }
    }
  }, [clone, isPlaying, animations, selectedAnimation]);

  useFrame((state, delta) => {
    mixer.current?.update(delta);
  });

  return <primitive object={clone} />;
};

const ModelFBX = ({ url, isPlaying, selectedAnimation, onAnimationsLoaded }: { 
  url: string; 
  isPlaying?: boolean; 
  selectedAnimation?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}) => {
  const fbx = useLoader(FBXLoader, url);
  const mixer = useRef<AnimationMixer | null>(null);
  const clone = React.useMemo(() => fbx.clone(), [fbx]);

  useEffect(() => {
    if ((fbx as any)?.animations?.length && onAnimationsLoaded) {
      onAnimationsLoaded((fbx as any).animations.map((a: any) => a.name));
    }
  }, [fbx, onAnimationsLoaded]);

  useEffect(() => {
    if (clone) {
      const box = new THREE.Box3().setFromObject(clone);
      const size = box.getSize(new THREE.Vector3());
      const targetHeight = 3;
      if (size.y > 0) {
        const scale = targetHeight / size.y;
        clone.scale.set(scale, scale, scale);
      }

      if (isPlaying && (fbx as any)?.animations?.length) {
        mixer.current = new AnimationMixer(clone);
        const animations = (fbx as any).animations;
        const animToPlay = selectedAnimation 
          ? animations.find((a: any) => a.name === selectedAnimation) || animations[0]
          : animations[0];
        const action = mixer.current.clipAction(animToPlay);
        action.play();
      } else {
        mixer.current?.stopAllAction();
      }
    }
  }, [clone, isPlaying, fbx, selectedAnimation]);

  useFrame((state, delta) => {
    mixer.current?.update(delta);
  });

  return <primitive object={clone} />;
};

const ImportedModel = ({ url, isFbx, isPlaying, selectedAnimation, onAnimationsLoaded }: { 
  url: string; 
  isFbx?: boolean; 
  isPlaying?: boolean;
  selectedAnimation?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}) => {
  if (!url) return null;
  const isActuallyFbx = isFbx || url.includes('#fbx');
  const cleanUrl = url.replace('#fbx', '');

  if (isActuallyFbx) {
    return <ModelFBX url={cleanUrl} isPlaying={isPlaying} selectedAnimation={selectedAnimation} onAnimationsLoaded={onAnimationsLoaded} />;
  }
  return <ModelGLTF url={cleanUrl} isPlaying={isPlaying} selectedAnimation={selectedAnimation} onAnimationsLoaded={onAnimationsLoaded} />;
};

const SoundObject = ({ url, volume = 1, loop = true, playing = true }: { url: string; volume?: number; loop?: boolean; playing?: boolean }) => {
    if (!url) return null;
    return (
        <group>
            <mesh>
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial color="cyan" wireframe transparent opacity={0.3} />
            </mesh>
            <PositionalAudio url={url} distance={20} loop={loop} autoplay={playing} />
        </group>
    );
};

const VideoObject = ({ url, scale, isPlaying }: { url: string; scale: [number, number, number]; isPlaying?: boolean }) => {
    const [video] = useState(() => {
        if (!url) return null;
        const v = document.createElement('video');
        v.src = url;
        v.crossOrigin = "Anonymous";
        v.loop = true;
        v.muted = !isPlaying; // Unmute when playing
        v.play().catch(() => {});
        return v;
    });

    useEffect(() => {
        if (video) {
            video.muted = !isPlaying;
        }
    }, [isPlaying, video]);

    if (!video) return null;

    return (
        <mesh scale={scale}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial side={THREE.DoubleSide}>
                <videoTexture attach="map" args={[video]} />
            </meshStandardMaterial>
        </mesh>
    );
};

const PartGeometry = ({ type }: { type: MapObject['type'] }) => {
  switch (type) {
    case 'Sphere': return <sphereGeometry args={[0.5, 32, 32]} />;
    case 'Cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
    case 'Wedge': return <coneGeometry args={[0.5, 1, 4]} />;
    case 'Part': default: return <boxGeometry args={[1, 1, 1]} />;
  }
};

const getMaterial = (type: string, color: string) => {
    return <meshStandardMaterial 
        color={color}
        roughness={type === 'Plastic' ? 0.5 : type === 'Neon' ? 0 : 0.9}
        metalness={type === 'Plastic' ? 0 : 0.1}
        emissive={type === 'Neon' ? color : 'black'}
        emissiveIntensity={type === 'Neon' ? 1 : 0}
    />;
}

// --- CONTROLS UI ---

const GameControls = () => {
  const touchStart = useRef({ x: 0, y: 0 });
  const [showEmotes, setShowEmotes] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    
    // Normalize roughly to -1 to 1 range
    const x = Math.max(-1, Math.min(1, dx / 50));
    const y = Math.max(-1, Math.min(1, dy / -50)); // Invert Y for forward

    const event = new CustomEvent('joystickMove', { detail: { x, y } });
    window.dispatchEvent(event);
  };

  const handleTouchEnd = () => {
    const event = new CustomEvent('joystickMove', { detail: { x: 0, y: 0 } });
    window.dispatchEvent(event);
  };

  const EmoteIcon = () => (
    <div className="w-10 h-10 bg-white rounded-full flex flex-col items-center justify-center border-2 border-gray-300 shadow-inner">
        <div className="flex gap-1.5 mb-0.5">
            <div className="w-1.5 h-1.5 bg-black rounded-full" />
            <div className="w-1.5 h-1.5 bg-black rounded-full" />
        </div>
        <div className="w-4 h-1.5 border-b-2 border-black rounded-full" />
    </div>
  );

  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-end pb-10 px-6">
       <div className="flex justify-between items-end pointer-events-auto">
          {/* Virtual Joystick Zone */}
          <div 
            className="w-32 h-32 bg-white/10 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-sm"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
             <div className="w-12 h-12 bg-white/30 rounded-full" />
          </div>

          {/* Emotes & Jump */}
          <div className="flex flex-col gap-4 items-center">
              {showEmotes && (
                  <div className="bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/20 flex flex-wrap gap-2 w-48 mb-2">
                      {['👋', '🕺', '😂', '🔥', '💖', '😎'].map(e => (
                          <button key={e} className="w-10 h-10 hover:bg-white/20 rounded flex items-center justify-center text-xl">{e}</button>
                      ))}
                  </div>
              )}
              <div className="flex gap-4">
                  <button 
                    onClick={() => setShowEmotes(!showEmotes)}
                    className="w-16 h-16 bg-white/10 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-sm active:bg-white/30"
                  >
                     <EmoteIcon />
                  </button>
                  <button 
                    className="w-24 h-24 bg-white/10 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-sm active:bg-white/30"
                    onTouchStart={() => window.dispatchEvent(new Event('jumpPress'))}
                    onTouchEnd={() => window.dispatchEvent(new Event('jumpRelease'))}
                    onMouseDown={() => window.dispatchEvent(new Event('jumpPress'))}
                    onMouseUp={() => window.dispatchEvent(new Event('jumpRelease'))}
                  >
                     <div className="text-white font-bold">SALTAR</div>
                  </button>
              </div>
          </div>
       </div>
    </div>
  )
};

const LoadingScreen = ({ loadingStep }: { loadingStep: number }) => {
    const messages = ["", "Iniciando motor VoxelSphere...", "Conectando al servidor...", "Cargando mapa...", "¡Listo!"];
    return (
        <div className="absolute inset-0 z-50 bg-[#1a1c1e] flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-blue-600/20 rounded-lg animate-spin mb-8 border-4 border-t-blue-600 border-r-transparent border-b-blue-600 border-l-transparent"></div>
            <h2 className="text-2xl font-bold text-white mb-2">VoxelSphere</h2>
            <p className="text-gray-400">{messages[loadingStep] || "Cargando..."}</p>
        </div>
    );
};

// --- PLAYER CONTROLLER ---

interface PlayerControllerProps {
    avatarConfig: AvatarConfig;
    mapObjects: MapObject[];
    username?: string;
    activeServer?: Server | null;
    isPlaying: boolean;
    currentScene: 'Lobby' | 'Game';
    equippedWeapon: string | null;
    isShooter: boolean;
    setEquippedWeapon: (w: string | null) => void;
    setObjects: React.Dispatch<React.SetStateAction<MapObject[]>>;
    setKills: React.Dispatch<React.SetStateAction<number>>;
    setShowKillIcon: React.Dispatch<React.SetStateAction<boolean>>;
}

const PlayerController: React.FC<PlayerControllerProps> = ({ 
    avatarConfig, 
    mapObjects, 
    username, 
    activeServer,
    isPlaying,
    currentScene,
    equippedWeapon,
    isShooter,
    setEquippedWeapon,
    setObjects,
    setKills,
    setShowKillIcon
}) => {
    const [pos, setPos] = useState(new THREE.Vector3(0, 2, 0));
    const [rot, setRot] = useState(new THREE.Euler(0, 0, 0));
    const [isMoving, setIsMoving] = useState(false);
    const [isJumping, setIsJumping] = useState(false);
    const shakeRef = useRef(new THREE.Vector3(0, 0, 0));
    const shakeIntensity = useRef(0);

    useEffect(() => {
        (window as any).triggerShoot = () => {
            if (isPlaying) handleShoot();
        };
    }, [isPlaying, equippedWeapon, mapObjects, rot, pos]);
    
    // Physics State
    const velocity = useRef(new THREE.Vector3(0, 0, 0));
    const canJump = useRef(true);
    const keys = useRef<{ [key: string]: boolean }>({});
    const isDead = useRef(false);

    const playTriggerSound = (trigger: MapObject['trigger']) => {
        const soundObj = mapObjects.find(obj => obj.type === 'Sound' && obj.trigger === trigger && obj.assetUrl);
        if (soundObj && soundObj.assetUrl) {
            const audio = new Audio(soundObj.assetUrl);
            audio.volume = soundObj.volume || 1;
            audio.play().catch(() => {});
        }
    };

    useEffect(() => {
        // Play spawn sound
        playTriggerSound('OnSpawn');
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => keys.current[e.code] = true;
        const onKeyUp = (e: KeyboardEvent) => keys.current[e.code] = false;
        
        const onJoystickMove = (e: CustomEvent) => {
             const { x, y } = e.detail;
             keys.current['KeyW'] = y > 0.3;
             keys.current['KeyS'] = y < -0.3;
             keys.current['ArrowLeft'] = x < -0.3;
             keys.current['ArrowRight'] = x > 0.3;
        };
        const onJumpPress = () => keys.current['Space'] = true;
        const onJumpRelease = () => keys.current['Space'] = false;

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('joystickMove', onJoystickMove as EventListener);
        window.addEventListener('jumpPress', onJumpPress);
        window.addEventListener('jumpRelease', onJumpRelease);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('joystickMove', onJoystickMove as EventListener);
            window.removeEventListener('jumpPress', onJumpPress);
            window.removeEventListener('jumpRelease', onJumpRelease);
        };
    }, []);

    useFrame((state) => {
        if (isDead.current) return;

        const speed = 0.25; 
        const jumpForce = 0.5; 
        const gravity = 0.025;
        
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot.y);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot.y);
        
        let moveVec = new THREE.Vector3(0, 0, 0);
        let moving = false;

        if (keys.current['KeyW']) { moveVec.add(forward); moving = true; }
        if (keys.current['KeyS']) { moveVec.sub(forward); moving = true; }
        
        if (moving) moveVec.normalize().multiplyScalar(speed);
        
        const rotationSpeed = 0.08;
        if (keys.current['ArrowLeft'] || keys.current['KeyA']) setRot(r => new THREE.Euler(r.x, r.y + rotationSpeed, r.z));
        if (keys.current['ArrowRight'] || keys.current['KeyD']) setRot(r => new THREE.Euler(r.x, r.y - rotationSpeed, r.z));

        velocity.current.x = moveVec.x;
        velocity.current.z = moveVec.z;

        if (keys.current['Space'] && canJump.current) {
            velocity.current.y = jumpForce;
            canJump.current = false;
            setIsJumping(true);
            playTriggerSound('OnJump');
        }

        velocity.current.y -= gravity;

        let nextY = pos.y + velocity.current.y;
        
        // Death Logic: Fall below map
        if (nextY < -50 && !isDead.current) {
            isDead.current = true;
            playTriggerSound('OnFall');
            playTriggerSound('OnDeath');
            setTimeout(() => {
                setPos(new THREE.Vector3(0, 5, 0));
                velocity.current.set(0, 0, 0);
                isDead.current = false;
                playTriggerSound('OnSpawn');
            }, 2000);
        }

        if (nextY <= 0) {
            nextY = 0;
            velocity.current.y = 0;
            canJump.current = true;
            setIsJumping(false);
        }

        // FPS Logic
        if (isPlaying && currentScene === 'Game') {
            // Pickup weapons
            mapObjects.forEach(obj => {
                if (obj.isWeapon && obj.transparency !== 1) {
                    const dist = pos.distanceTo(new THREE.Vector3(...obj.position));
                    if (dist < 3) {
                        if (equippedWeapon) {
                            // Drop current weapon (make it visible again)
                            const oldWeapon = mapObjects.find(o => (o.weaponType === equippedWeapon || o.name === equippedWeapon) && o.transparency === 1);
                            if (oldWeapon) (window as any).updateObject(oldWeapon.id, { transparency: 0, canCollide: true, position: [pos.x, pos.y, pos.z] });
                        }
                        setEquippedWeapon(obj.weaponType || 'Rifle');
                        (window as any).updateObject(obj.id, { transparency: 1, canCollide: false }); // Hide it
                        playTriggerSound('OnSpawn');
                    }
                }
            });

            // Bot AI (Simple follow and shoot)
            if (state.clock.getElapsedTime() % 1 < 0.02) {
                setObjects(prev => prev.map(obj => {
                    if (obj.isBot && obj.health && obj.health > 0) {
                        const botPos = new THREE.Vector3(...obj.position);
                        const dist = pos.distanceTo(botPos);
                        if (dist < 30 && dist > 5) {
                            const dir = pos.clone().sub(botPos).normalize().multiplyScalar(0.2);
                            return { ...obj, position: [obj.position[0] + dir.x, obj.position[1], obj.position[2] + dir.z] as [number, number, number] };
                        }
                    }
                    return obj;
                }));
            }
        }

        const nextPos = pos.clone().add(velocity.current);
        if(nextPos.y < 0) nextPos.y = 0;

        setPos(nextPos);
        (window as any).localPlayerPos = { x: nextPos.x, y: nextPos.y, z: nextPos.z };
        setIsMoving(moving || Math.abs(velocity.current.x) > 0.01 || Math.abs(velocity.current.z) > 0.01);

        // Sync with server
        const roomId = activeServer?.id || 'default-room';
        const socket = (window as any).studioSocket;
        if (socket && state.clock.getElapsedTime() % 0.1 < 0.02) {
            socket.emit('update-player', roomId, {
                position: [nextPos.x, nextPos.y, nextPos.z],
                rotation: [rot.x, rot.y, rot.z],
                isMoving: moving,
                isJumping: !canJump.current
            });
        }

        if (currentScene === 'Lobby') {
            // In lobby, player is fixed and looking at camera
            state.camera.position.set(0, 5, 15);
            state.camera.lookAt(0, 2, 0);
            setPos(new THREE.Vector3(0, 0, 0));
            setRot(new THREE.Euler(0, Math.PI, 0));
            return;
        }

        const camDist = 12;
        const camHeight = 6;
        
        // Apply camera shake
        if (shakeIntensity.current > 0) {
            shakeRef.current.set(
                (Math.random() - 0.5) * shakeIntensity.current,
                (Math.random() - 0.5) * shakeIntensity.current,
                (Math.random() - 0.5) * shakeIntensity.current
            );
            shakeIntensity.current *= 0.9; // Decay
            if (shakeIntensity.current < 0.01) shakeIntensity.current = 0;
        } else {
            shakeRef.current.set(0, 0, 0);
        }

        state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, nextPos.x - Math.sin(rot.y) * camDist + shakeRef.current.x, 0.1);
        state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, nextPos.z - Math.cos(rot.y) * camDist + shakeRef.current.z, 0.1);
        state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, nextPos.y + camHeight + shakeRef.current.y, 0.1);
        state.camera.lookAt(nextPos.x, nextPos.y + 3, nextPos.z);
    });

    const avatarReplacement = mapObjects.find(obj => obj.isAvatarReplacement);

    const handleShoot = () => {
        if (!equippedWeapon) return;
        playTriggerSound('OnJump'); // Placeholder for shoot sound
        
        // Camera shake
        shakeIntensity.current = 0.5;
        
        // Raycast logic for bots
        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z)));
        raycaster.set(pos, direction);
        
        const botObjects = mapObjects.filter(o => o.isBot && Number(o.health) > 0);
        botObjects.forEach(bot => {
            const botBox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(...bot.position),
                new THREE.Vector3(...bot.scale)
            );
            if (raycaster.ray.intersectsBox(botBox)) {
                const newHealth = (Number(bot.health) || 0) - 25;
                (window as any).updateObject(bot.id, { health: newHealth });
                if (newHealth <= 0) {
                    setKills(prev => prev + 1);
                    setShowKillIcon(true);
                    setTimeout(() => setShowKillIcon(false), 1000);
                }
            }
        });
    };

    useEffect(() => {
        const onMouseDown = () => { if (isPlaying) handleShoot(); };
        window.addEventListener('mousedown', onMouseDown);
        return () => window.removeEventListener('mousedown', onMouseDown);
    }, [isPlaying, equippedWeapon, mapObjects, rot, pos]);

    return (
        <ErrorBoundary fallback={<mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="red" wireframe /></mesh>}>
            <Suspense fallback={null}>
                {avatarReplacement ? (
                    <group position={[pos.x, pos.y, pos.z]} rotation={[rot.x, rot.y, rot.z]}>
                        {avatarReplacement.type === 'Model' && avatarReplacement.assetUrl ? (
                            <ImportedModel 
                                url={avatarReplacement.assetUrl} 
                                isFbx={avatarReplacement.assetUrl.includes('#fbx')} 
                                isPlaying={true} 
                                selectedAnimation={currentScene === 'Lobby' ? 'Idle_Weapon' : (equippedWeapon ? 'Run_Weapon' : avatarReplacement.selectedAnimation)}
                            />
                        ) : avatarReplacement.type === 'Sound' && avatarReplacement.assetUrl ? (
                            <SoundObject url={avatarReplacement.assetUrl} volume={avatarReplacement.volume} loop={avatarReplacement.loop} playing={true} />
                        ) : avatarReplacement.type === 'Video' && avatarReplacement.assetUrl ? (
                            <VideoObject url={avatarReplacement.assetUrl} scale={avatarReplacement.scale} isPlaying={true} />
                        ) : (
                            <group scale={avatarReplacement.scale}>
                                <PartGeometry type={avatarReplacement.type} />
                                {getMaterial(avatarReplacement.material, avatarReplacement.color)}
                            </group>
                        )}
                    </group>
                ) : (
                    <VoxelCharacter 
                        config={avatarConfig} 
                        position={[pos.x, pos.y, pos.z]} 
                        rotation={[rot.x, rot.y, rot.z]} 
                        isMoving={isMoving}
                        isJumping={isJumping}
                        weaponEquipped={!!equippedWeapon}
                        selectedAnimation={avatarReplacement?.selectedAnimation}
                        username={username}
                    />
                )}
            </Suspense>
        </ErrorBoundary>
    );
};

// --- STUDIO COMPONENT ---

interface StudioProps {
  onPublish: (gameData: { title: string, map: MapObject[], skybox: string }) => void;
  avatarConfig: AvatarConfig;
  initialMapData?: MapObject[];
  initialGame?: Game;
  isPlayMode?: boolean;
  activeServer?: Server | null;
  onExit?: () => void;
  playerName?: string;
  username?: string;
}

const INITIAL_MAP: MapObject[] = [
    { id: 'baseplate', name: 'Baseplate', type: 'Part', position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [100, 1, 100], color: '#2b2b2b', material: 'Plastic', transparency: 0, anchored: true, canCollide: true },
    { id: 'spawn', name: 'SpawnLocation', type: 'Part', position: [0, 0.1, 0], rotation: [0, 0, 0], scale: [6, 0.2, 6], color: '#a3a2a5', material: 'Plastic', transparency: 0, anchored: true, canCollide: true }
];

const TEMPLATES = {
    Empty: INITIAL_MAP,
    FPS_Shooter: [
        { id: 'config', name: 'GameConfig', type: 'Part' as const, position: [0, -1000, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number], color: '#000000', material: 'Plastic' as const, transparency: 1, anchored: true, canCollide: false, isShooter: true },
        { id: 'baseplate', name: 'Baseplate', type: 'Part' as const, position: [0, -0.5, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [300, 1, 300] as [number, number, number], color: '#1a1a1a', material: 'Plastic' as const, transparency: 0, anchored: true, canCollide: true },
        { id: 'spawn_blue', name: 'Spawn Blue', type: 'Part' as const, position: [-100, 0.1, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [15, 0.2, 15] as [number, number, number], color: '#0000ff', material: 'Plastic' as const, transparency: 0.5, anchored: true, canCollide: true, team: 'Blue' as const },
        { id: 'spawn_red', name: 'Spawn Red', type: 'Part' as const, position: [100, 0.1, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [15, 0.2, 15] as [number, number, number], color: '#ff0000', material: 'Plastic' as const, transparency: 0.5, anchored: true, canCollide: true, team: 'Red' as const },
        
        // Weapons
        { id: 'gun1', name: 'Rifle Alpha', type: 'Part' as const, position: [0, 1, 10] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [0.5, 0.5, 2] as [number, number, number], color: '#444444', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isWeapon: true, weaponType: 'Rifle' },
        { id: 'gun2', name: 'Sniper Beta', type: 'Part' as const, position: [0, 1, -10] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [0.4, 0.4, 3] as [number, number, number], color: '#222222', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isWeapon: true, weaponType: 'Sniper' },
        
        // Bots Red Team (4)
        { id: 'bot_r1', name: 'Bot Red 1', type: 'Part' as const, position: [80, 1, 30] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 1] as [number, number, number], color: '#ff0000', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isBot: true, team: 'Red' as const, health: 100, maxHealth: 100, availableAnimations: ['Idle', 'Dance', 'Wave', 'Sit'] },
        { id: 'bot_r2', name: 'Bot Red 2', type: 'Part' as const, position: [80, 1, 10] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 1] as [number, number, number], color: '#ff0000', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isBot: true, team: 'Red' as const, health: 100, maxHealth: 100, availableAnimations: ['Idle', 'Dance', 'Wave', 'Sit'] },
        { id: 'bot_r3', name: 'Bot Red 3', type: 'Part' as const, position: [80, 1, -10] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 1] as [number, number, number], color: '#ff0000', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isBot: true, team: 'Red' as const, health: 100, maxHealth: 100, availableAnimations: ['Idle', 'Dance', 'Wave', 'Sit'] },
        { id: 'bot_r4', name: 'Bot Red 4', type: 'Part' as const, position: [80, 1, -30] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 1] as [number, number, number], color: '#ff0000', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isBot: true, team: 'Red' as const, health: 100, maxHealth: 100, availableAnimations: ['Idle', 'Dance', 'Wave', 'Sit'] },
        
        // Bots Blue Team (4)
        { id: 'bot_b1', name: 'Bot Blue 1', type: 'Part' as const, position: [-80, 1, 30] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 1] as [number, number, number], color: '#0000ff', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isBot: true, team: 'Blue' as const, health: 100, maxHealth: 100, availableAnimations: ['Idle', 'Dance', 'Wave', 'Sit'] },
        { id: 'bot_b2', name: 'Bot Blue 2', type: 'Part' as const, position: [-80, 1, 10] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 1] as [number, number, number], color: '#0000ff', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isBot: true, team: 'Blue' as const, health: 100, maxHealth: 100, availableAnimations: ['Idle', 'Dance', 'Wave', 'Sit'] },
        { id: 'bot_b3', name: 'Bot Blue 3', type: 'Part' as const, position: [-80, 1, -10] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 1] as [number, number, number], color: '#0000ff', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isBot: true, team: 'Blue' as const, health: 100, maxHealth: 100, availableAnimations: ['Idle', 'Dance', 'Wave', 'Sit'] },
        { id: 'bot_b4', name: 'Bot Blue 4', type: 'Part' as const, position: [-80, 1, -30] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 2, 1] as [number, number, number], color: '#0000ff', material: 'Plastic' as const, transparency: 0, anchored: false, canCollide: true, isBot: true, team: 'Blue' as const, health: 100, maxHealth: 100, availableAnimations: ['Idle', 'Dance', 'Wave', 'Sit'] },
        
        // Mountains
        { id: 'mtn1', name: 'Mountain North', type: 'Wedge' as const, position: [0, 25, 100] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [100, 50, 100] as [number, number, number], color: '#4b3621', material: 'Brick' as const, transparency: 0, anchored: true, canCollide: true },
        { id: 'mtn2', name: 'Mountain South', type: 'Wedge' as const, position: [0, 25, -100] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number], scale: [100, 50, 100] as [number, number, number], color: '#4b3621', material: 'Brick' as const, transparency: 0, anchored: true, canCollide: true },
        { id: 'mtn3', name: 'Mountain East', type: 'Wedge' as const, position: [150, 15, 0] as [number, number, number], rotation: [0, -Math.PI/2, 0] as [number, number, number], scale: [50, 30, 50] as [number, number, number], color: '#4b3621', material: 'Brick' as const, transparency: 0, anchored: true, canCollide: true },
        { id: 'mtn4', name: 'Mountain West', type: 'Wedge' as const, position: [-150, 15, 0] as [number, number, number], rotation: [0, Math.PI/2, 0] as [number, number, number], scale: [50, 30, 50] as [number, number, number], color: '#4b3621', material: 'Brick' as const, transparency: 0, anchored: true, canCollide: true },
    ]
};

export const StudioPage: React.FC<StudioProps> = ({ onPublish, avatarConfig, initialMapData, initialGame, isPlayMode = false, activeServer, onExit, playerName, username }) => {
  const [objects, setObjects] = useState<MapObject[]>(initialMapData || INITIAL_MAP);
  const [currentScene, setCurrentScene] = useState<'Lobby' | 'Game'>('Game');
  const [equippedWeapon, setEquippedWeapon] = useState<string | null>(null);
  const [kills, setKills] = useState(0);
  const [showKillIcon, setShowKillIcon] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [isPlaying, setIsPlaying] = useState(false); 
  const [loadingStep, setLoadingStep] = useState(0);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [gameTitle, setGameTitle] = useState("Mi Experiencia Voxel");
  const [skybox, setSkybox] = useState<string>(initialGame?.skybox || 'Day');
  const [isShooter, setIsShooter] = useState(false);

  useEffect(() => {
     setIsShooter(objects.some(obj => obj.isShooter));
  }, [objects]);
  
  // Multiplayer State
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const remotePlayersRef = useRef<RemotePlayer[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const mediaStream = useRef<MediaStream | null>(null);
  const webrtcManager = useRef<WebRTCManager | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  // Sync ref with state
  useEffect(() => {
    remotePlayersRef.current = remotePlayers;
  }, [remotePlayers]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      (window as any).updateObject = (id: string, newProps: Partial<MapObject>) => {
          setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...newProps } : obj));
      };
      
      // Connect to real-time server for both Editor and Play mode
      const socket = io();
      socketRef.current = socket;
      (window as any).studioSocket = socket;
      
      // Determine Room ID: Use server ID if in play mode, otherwise a default or game-specific room
      const roomId = activeServer?.id || (initialGame?.id ? `editor-${initialGame.id}` : 'global-lobby');
      
      console.log("Connecting to real-time room:", roomId);

      socket.on('connect', () => {
          console.log("Socket connected:", socket.id);
          socket.emit('join-room', roomId, {
              username: playerName || 'Guest',
              config: avatarConfig,
              country: ['ES', 'US', 'MX', 'AR', 'CO', 'CL', 'BR'][Math.floor(Math.random() * 7)]
          });
      });

      socket.on('room-state', (state) => {
          console.log("Received room state:", state);
          const others = Object.values(state.players).filter((p: any) => p.id !== socket.id) as RemotePlayer[];
          setRemotePlayers(others);
          // Only update objects from server if we are in play mode (to avoid overwriting editor changes)
          if (isPlayMode && state.mapObjects.length > 0) setObjects(state.mapObjects);
      });

      socket.on('player-joined', (player) => {
          console.log("Player joined:", player.username);
          setRemotePlayers(prev => {
              if (prev.find(p => p.id === player.id)) return prev;
              return [...prev, player];
          });
      });

      socket.on('player-updated', (player) => {
          setRemotePlayers(prev => prev.map(p => p.id === player.id ? player : p));
      });

      socket.on('player-left', (id) => {
          console.log("Player left:", id);
          setRemotePlayers(prev => prev.filter(p => p.id !== id));
      });

      socket.on('map-updated', (mapObjects) => {
          if (isPlayMode) setObjects(mapObjects);
      });

      // Initialize WebRTC Manager
      webrtcManager.current = new WebRTCManager(
          socket,
          roomId,
          (id, stream) => {
              setRemoteStreams(prev => ({ ...prev, [id]: stream }));
          },
          (id) => {
              setRemoteStreams(prev => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
              });
          }
      );

      socket.on('webrtc-signal', (senderId, signal) => {
          webrtcManager.current?.handleSignal(senderId, signal);
      });

      // Proximity check interval
      const proximityInterval = setInterval(() => {
          if (!socket.connected || !webrtcManager.current) return;
          
          const localPlayer = (window as any).localPlayerPos || { x: 0, y: 0, z: 0 };
          const PROXIMITY_DISTANCE = 100; // Increased range for global feel

          remotePlayersRef.current.forEach(player => {
              const dist = Math.sqrt(
                  Math.pow(player.position[0] - localPlayer.x, 2) +
                  Math.pow(player.position[1] - localPlayer.y, 2) +
                  Math.pow(player.position[2] - localPlayer.z, 2)
              );

              if (dist < PROXIMITY_DISTANCE) {
                  if (!webrtcManager.current?.peers.has(player.id)) {
                      webrtcManager.current?.createPeer(player.id, true);
                  }
              } else {
                  if (webrtcManager.current?.peers.has(player.id)) {
                      webrtcManager.current?.removePeer(player.id);
                  }
              }
          });
      }, 2000);

      return () => {
          console.log("Cleaning up socket connection");
          socket.disconnect();
          webrtcManager.current?.destroy();
          clearInterval(proximityInterval);
      };
  }, [activeServer?.id, initialGame?.id, playerName, avatarConfig]); // Re-connect if identity or room changes

  useEffect(() => {
      if (isPlayMode) {
          handlePlaySequence();
      } else if (username) {
          // Load saved studio map
          fetch(`/api/user/${username}/studio`)
              .then(res => res.json())
              .then(data => {
                  if (data.map && data.map.length > 0) {
                      setObjects(data.map);
                      setGameTitle(data.title || "Mi Experiencia Voxel");
                      setSkybox(data.skybox || "Day");
                  }
              })
              .catch(err => console.error("Error loading studio map:", err));
      }
  }, [isPlayMode, username]);

  // Auto-save effect
  useEffect(() => {
      if (!isPlayMode && !isPlaying && username && objects.length > 0) {
          const timer = setTimeout(() => {
              fetch(`/api/user/${username}/studio`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: gameTitle, map: objects, skybox })
              }).catch(err => console.error("Error auto-saving map:", err));
          }, 5000); // Save every 5 seconds of inactivity
          return () => clearTimeout(timer);
      }
  }, [objects, gameTitle, skybox, isPlayMode, isPlaying, username]);

  const toggleMic = async () => {
      if (!isMicOn) {
          try {
              mediaStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
              setIsMicOn(true);
              webrtcManager.current?.setLocalStream(mediaStream.current);
              
              // Update talking status
              const roomId = activeServer?.id || 'default-room';
              socketRef.current?.emit('update-player', roomId, { isTalking: true });
          } catch (err) {
              console.error("Mic access denied", err);
          }
      } else {
          mediaStream.current?.getTracks().forEach(t => t.stop());
          setIsMicOn(false);
          const roomId = activeServer?.id || 'default-room';
          socketRef.current?.emit('update-player', roomId, { isTalking: false });
      }
  };

  const handlePlaySequence = () => {
      setLoadingStep(1);
      const sequence = [
          () => setLoadingStep(1),
          () => setLoadingStep(2),
          () => setLoadingStep(3),
          () => { setLoadingStep(4); setTimeout(() => setIsPlaying(true), 800); }
      ];
      let i = 0;
      const interval = setInterval(() => {
          if (i < sequence.length) { sequence[i](); i++; } 
          else { clearInterval(interval); }
      }, 800);
  };

  const handleImportModel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isFbx = file.name.toLowerCase().endsWith('.fbx');
    const url = URL.createObjectURL(file);
    const finalUrl = isFbx ? `${url}#fbx` : url;

    if (selectedId) {
        const selectedObj = objects.find(o => o.id === selectedId);
        if (selectedObj && (selectedObj.isBot || selectedObj.isWeapon)) {
            handleUpdateObject(selectedId, { type: 'Model', assetUrl: finalUrl });
            return;
        }
    }

    const newObj: MapObject = {
        id: Date.now().toString(),
        name: file.name,
        type: 'Model',
        position: [0, 2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#ffffff',
        material: 'Plastic',
        transparency: 0,
        anchored: false,
        canCollide: true,
        assetUrl: isFbx ? url + '#fbx' : url,
    };
    setObjects([...objects, newObj]);
    setSelectedId(newObj.id);
  };

  const handleImportAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newObj: MapObject = {
        id: Date.now().toString(),
        name: file.name,
        type: 'Sound',
        position: [0, 2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#00ffff',
        material: 'Plastic',
        transparency: 0,
        anchored: true,
        canCollide: false,
        assetUrl: url,
        volume: 1,
        loop: true,
        playing: true
    };
    setObjects([...objects, newObj]);
    setSelectedId(newObj.id);
  };

  const handleImportVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newObj: MapObject = {
        id: Date.now().toString(),
        name: file.name,
        type: 'Video',
        position: [0, 5, 0],
        rotation: [0, 0, 0],
        scale: [10, 6, 1],
        color: '#ffffff',
        material: 'Plastic',
        transparency: 0,
        anchored: true,
        canCollide: true,
        assetUrl: url
    };
    setObjects([...objects, newObj]);
    setSelectedId(newObj.id);
  };

  const handleUpdateObject = (id: string, newProps: Partial<MapObject>) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...newProps } : obj));
  };

  const RenderMap = () => (
      <>
        {objects.filter(obj => !(isPlaying && obj.isAvatarReplacement)).map((obj) => (
            <React.Fragment key={obj.id}>
                {/* Bot Health Bar Overlay */}
                {isPlaying && obj.isBot && obj.health && obj.health > 0 && (
                    <group position={[obj.position[0], obj.position[1] + 4, obj.position[2]]}>
                        <mesh>
                            <planeGeometry args={[2, 0.2]} />
                            <meshBasicMaterial color="red" />
                        </mesh>
                        <mesh position={[-(1 - (Number(obj.health) || 0) / (obj.maxHealth || 100)), 0, 0.01]}>
                            <planeGeometry args={[2 * ((Number(obj.health) || 0) / (obj.maxHealth || 100)), 0.2]} />
                            <meshBasicMaterial color="green" />
                        </mesh>
                    </group>
                )}

                {(selectedId === obj.id && !isPlaying) ? (
                <TransformControls 
                    mode={transformMode} 
                    onObjectChange={(e: any) => {
                        if(e?.target?.object) {
                            const o = e.target.object;
                            handleUpdateObject(obj.id, {
                                position: [o.position.x, o.position.y, o.position.z],
                                rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
                                scale: [o.scale.x, o.scale.y, o.scale.z]
                            });
                        }
                    }}
                >
                    <mesh 
                        position={new THREE.Vector3(...obj.position)} 
                        rotation={new THREE.Euler(...obj.rotation)} 
                        scale={new THREE.Vector3(...obj.scale)}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(obj.id); }}
                    >
                        {obj.type === 'Model' && obj.assetUrl ? (
                            <ErrorBoundary fallback={<mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="red" wireframe /></mesh>}>
                                <Suspense fallback={<mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="gray" wireframe /></mesh>}>
                                    <ImportedModel 
                                        url={obj.assetUrl.replace('#fbx','')} 
                                        isFbx={obj.assetUrl.includes('#fbx')} 
                                        isPlaying={isPlaying} 
                                        selectedAnimation={obj.selectedAnimation}
                                        onAnimationsLoaded={(names) => {
                                            if (!obj.availableAnimations || obj.availableAnimations.length !== names.length) {
                                                handleUpdateObject(obj.id, { availableAnimations: names });
                                            }
                                        }}
                                    />
                                </Suspense>
                            </ErrorBoundary>
                        ) : obj.isBot ? (
                            <VoxelCharacter 
                                config={{
                                    bodyColors: {
                                        head: obj.color, torso: obj.color, leftArm: obj.color,
                                        rightArm: obj.color, leftLeg: obj.color, rightLeg: obj.color
                                    },
                                    faceTextureUrl: null,
                                    accessories: { hatModelUrl: null, shirtTextureUrl: null },
                                    hideFace: false
                                }}
                                position={[0, -1, 0]}
                                rotation={[0, 0, 0]}
                                isMoving={isPlaying}
                                weaponEquipped={true}
                                selectedAnimation={obj.selectedAnimation}
                                username={obj.name}
                            />
                        ) : obj.type === 'Sound' && obj.assetUrl ? (
                            <SoundObject url={obj.assetUrl} volume={obj.volume} loop={obj.loop} playing={isPlaying} />
                        ) : obj.type === 'Video' && obj.assetUrl ? (
                            <VideoObject url={obj.assetUrl} scale={obj.scale} isPlaying={isPlaying} />
                        ) : (
                            <>
                                <PartGeometry type={obj.type} />
                                {getMaterial(obj.material, obj.color)}
                            </>
                        )}
                    </mesh>
                </TransformControls>
                ) : (
                <mesh 
                    position={new THREE.Vector3(...obj.position)} 
                    rotation={new THREE.Euler(...obj.rotation)} 
                    scale={new THREE.Vector3(...obj.scale)}
                    onClick={(e) => { 
                        if(!isPlaying) {
                            e.stopPropagation(); 
                            setSelectedId(obj.id); 
                        }
                    }}
                >
                    {obj.type === 'Model' && obj.assetUrl ? (
                            <ErrorBoundary fallback={<mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="red" wireframe /></mesh>}>
                                <Suspense fallback={<mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="gray" wireframe /></mesh>}>
                                    <ImportedModel 
                                        url={obj.assetUrl.replace('#fbx','')} 
                                        isFbx={obj.assetUrl.includes('#fbx')} 
                                        isPlaying={isPlaying} 
                                        selectedAnimation={obj.selectedAnimation}
                                        onAnimationsLoaded={(names) => {
                                            if (!obj.availableAnimations || obj.availableAnimations.length !== names.length) {
                                                handleUpdateObject(obj.id, { availableAnimations: names });
                                            }
                                        }}
                                    />
                                </Suspense>
                            </ErrorBoundary>
                        ) : obj.isBot ? (
                            <VoxelCharacter 
                                config={{
                                    bodyColors: {
                                        head: obj.color, torso: obj.color, leftArm: obj.color,
                                        rightArm: obj.color, leftLeg: obj.color, rightLeg: obj.color
                                    },
                                    faceTextureUrl: null,
                                    accessories: { hatModelUrl: null, shirtTextureUrl: null },
                                    hideFace: false
                                }}
                                position={[0, -1, 0]}
                                rotation={[0, 0, 0]}
                                isMoving={isPlaying}
                                weaponEquipped={true}
                                selectedAnimation={obj.selectedAnimation}
                                username={obj.name}
                            />
                        ) : obj.type === 'Sound' && obj.assetUrl ? (
                            <SoundObject url={obj.assetUrl} volume={obj.volume} loop={obj.loop} playing={isPlaying} />
                        ) : obj.type === 'Video' && obj.assetUrl ? (
                            <VideoObject url={obj.assetUrl} scale={obj.scale} isPlaying={isPlaying} />
                        ) : (
                            <>
                                <PartGeometry type={obj.type} />
                                {getMaterial(obj.material, obj.color)}
                            </>
                        )}
                </mesh>
                )}
            </React.Fragment>
        ))}
      </>
  );

  // Component to interpolate remote players
    const GameUI = () => (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-[60]">
            {/* Crosshair */}
            {isShooter && (
                <div className="w-4 h-4 border-2 border-white/50 rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-white rounded-full" />
                </div>
            )}
            
            {/* Kill Icon */}
            {isShooter && showKillIcon && (
                <div className="absolute top-1/3 animate-bounce">
                    <Skull size={64} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                </div>
            )}

            {/* Stats */}
            {isShooter && (
                <div className="absolute top-10 right-10 bg-black/50 p-4 rounded-lg border border-white/10 backdrop-blur-md">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Kills</div>
                    <div className="text-4xl font-black text-white">{kills}</div>
                </div>
            )}

            {/* Shoot Button (Mobile/Tablet friendly) */}
            {equippedWeapon && (
                <button 
                    onPointerDown={() => (window as any).triggerShoot?.()}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-red-600/80 border-4 border-white/20 rounded-full flex items-center justify-center pointer-events-auto active:scale-90 transition-transform shadow-lg shadow-red-600/20"
                >
                    <div className="w-8 h-8 bg-white rounded-full opacity-50" />
                </button>
            )}

            {/* Weapon Info */}
            {equippedWeapon && (
                <div className="absolute bottom-10 right-10 bg-black/50 p-4 rounded-lg border border-white/10 backdrop-blur-md flex items-center gap-4">
                    <div className="bg-blue-600/20 p-3 rounded-lg border border-blue-500/30">
                        <Gamepad size={24} className="text-blue-400" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Arma Equipada</div>
                        <div className="text-xl font-bold text-white">{equippedWeapon}</div>
                    </div>
                </div>
            )}
        </div>
    );

    const LobbyUI = () => (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-[70]">
            <div className="bg-[#1e1f21] p-8 rounded-2xl border border-white/10 shadow-2xl w-[500px] flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Lobby de Equipo</h2>
                    <div className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase">4 VS 4</div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Invitar Jugadores</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input 
                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-blue-500 transition-colors"
                            placeholder="Buscar por nombre de usuario..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="max-h-48 overflow-y-auto flex flex-col gap-2 pr-2">
                    {['PlayerOne', 'SniperPro', 'VoxelKing', 'ShadowNinja'].filter(u => u.toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
                        <div key={user} className="bg-white/5 p-3 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full" />
                                <span className="font-bold text-sm">{user}</span>
                            </div>
                            <button 
                                onClick={() => setInvitedUsers(prev => [...prev, user])}
                                className={`p-2 rounded-lg transition-colors ${invitedUsers.includes(user) ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {invitedUsers.includes(user) ? 'Invitado' : <UserPlus size={16} />}
                            </button>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={() => setCurrentScene('Game')}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-black text-lg uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                    Comenzar Partida
                </button>
            </div>
        </div>
    );

  const RemotePlayerRenderer = ({ player, stream }: { player: RemotePlayer, stream?: MediaStream }) => {
      const [currentPos] = useState(() => new THREE.Vector3(...player.position));
      const [currentRot] = useState(() => new THREE.Euler(...player.rotation));
      const audioRef = useRef<HTMLAudioElement | null>(null);
      
      useEffect(() => {
          if (stream && !audioRef.current) {
              const audio = new Audio();
              audio.srcObject = stream;
              audio.play().catch(e => console.error("Error playing remote stream", e));
              audioRef.current = audio;
          }
          return () => {
              if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.srcObject = null;
                  audioRef.current = null;
              }
          };
      }, [stream]);

      useFrame((state, delta) => {
          // If we have a target (future) position, lerp towards it
          if (player.targetPosition && player.isMoving) {
               const target = new THREE.Vector3(...player.targetPosition);
               currentPos.lerp(target, delta * 5); // Faster lerp for responsiveness
               
               if (currentPos.distanceTo(target) > 0.1) {
                   const angle = Math.atan2(target.x - currentPos.x, target.z - currentPos.z);
                   currentRot.y = angle + Math.PI;
               }
          } else {
              // Otherwise, snap/lerp to the current known position
              const target = new THREE.Vector3(...player.position);
              currentPos.lerp(target, 0.2); // Smooth snap
              currentRot.y = THREE.MathUtils.lerp(currentRot.y, player.rotation[1], 0.2);
          }
      });

      return (
          <group>
              <ErrorBoundary fallback={null}>
                  <Suspense fallback={null}>
                      <VoxelCharacter 
                         config={player.config} 
                         position={[currentPos.x, currentPos.y, currentPos.z]} 
                         rotation={[0, currentRot.y, 0]}
                         isMoving={player.isMoving}
                         username={`${player.username} [${player.country || '??'}]`}
                      />
                  </Suspense>
              </ErrorBoundary>
              {player.isTalking && (
                  <mesh position={[currentPos.x, currentPos.y + 3.5, currentPos.z]}>
                      <sphereGeometry args={[0.1, 16, 16]} />
                      <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
                  </mesh>
              )}
          </group>
      );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#232527] overflow-hidden text-white font-sans relative">
      
      {loadingStep > 0 && !isPlaying && <LoadingScreen loadingStep={loadingStep} />}
      
      {isPlaying && currentScene === 'Game' && <GameUI />}
      {isPlaying && currentScene === 'Lobby' && <LobbyUI />}
      
      {isPlaying && <GameControls />}

      {/* MULTIPLAYER STATUS OVERLAY */}
      <div className="absolute bottom-4 left-4 z-50 flex flex-col gap-1 pointer-events-none">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded text-[10px] text-white/70 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${socketRef.current?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {socketRef.current?.connected ? 'Sincronizado' : 'Desconectado'}
              <span className="opacity-50">|</span>
              <span>{remotePlayers.length + 1} Jugadores</span>
          </div>
          {remotePlayers.length > 0 && (
              <div className="flex flex-col gap-1">
                  {remotePlayers.slice(0, 3).map(p => (
                      <div key={p.id} className="bg-black/20 px-2 py-0.5 rounded text-[9px] text-white/50">
                          {p.username} se unió
                      </div>
                  ))}
                  {remotePlayers.length > 3 && <div className="text-[9px] text-white/30 pl-2">... y {remotePlayers.length - 3} más</div>}
              </div>
          )}
      </div>

      {showPublishModal && (
          <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center">
              <div className="bg-[#2b2d31] p-6 rounded-lg w-96 border border-gray-600 shadow-xl">
                  <h2 className="text-xl font-bold mb-4">Publicar en VoxelSphere</h2>
                  <input className="w-full bg-black/20 border border-gray-600 rounded p-2 mb-4" value={gameTitle} onChange={e => setGameTitle(e.target.value)} />
                  <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowPublishModal(false)} className="px-4 py-2 hover:bg-white/10 rounded">Cancelar</button>
                      <button onClick={() => { onPublish({ title: gameTitle, map: objects, skybox }); setShowPublishModal(false); alert("¡Experiencia Publicada!"); }} className="px-4 py-2 bg-blue-600 rounded font-bold">Publicar</button>
                  </div>
              </div>
          </div>
      )}
      
      {!isPlaying && !isPlayMode && (
        <div className="flex flex-col bg-[#2b2d31] border-b border-[#111213]">
            <div className="h-14 flex items-center px-4 justify-between">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><span className="font-bold text-blue-500">ARCHIVO</span><span className="font-bold text-gray-300">INICIO</span></div>
                
                {/* Skybox Menu */}
                <div className="flex gap-1 bg-[#1e1f21] p-1 rounded-lg border border-white/5">
                    {Object.entries(SKYBOXES).map(([name, config]) => (
                        <button 
                            key={name}
                            onClick={() => setSkybox(name)}
                            title={name}
                            className={`p-1.5 rounded flex items-center gap-1 transition-colors ${skybox === name ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
                        >
                            {config.icon}
                            <span className="text-[10px] font-bold hidden lg:inline">{name}</span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Plantilla</label>
                    <select 
                        className="bg-[#1e1f21] border border-white/10 rounded px-2 py-1 text-xs font-bold text-blue-400"
                        onChange={(e) => {
                            const template = TEMPLATES[e.target.value as keyof typeof TEMPLATES];
                            if (template) setObjects(template);
                        }}
                    >
                        {Object.keys(TEMPLATES).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Escena</label>
                    <div className="flex gap-1 bg-[#1e1f21] p-1 rounded-lg border border-white/5">
                        <button 
                            onClick={() => setCurrentScene('Lobby')}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${currentScene === 'Lobby' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            LOBBY
                        </button>
                        <button 
                            onClick={() => setCurrentScene('Game')}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${currentScene === 'Game' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            JUEGO
                        </button>
                    </div>
                </div>

                <div className="flex gap-1 bg-[#1e1f21] p-1 rounded-lg">
                    <button onClick={() => setTransformMode('translate')} className={`p-1.5 rounded ${transformMode === 'translate' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}><Move size={18} /></button>
                    <button onClick={() => setTransformMode('scale')} className={`p-1.5 rounded ${transformMode === 'scale' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}><Maximize size={18} /></button>
                    <button onClick={() => setTransformMode('rotate')} className={`p-1.5 rounded ${transformMode === 'rotate' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}><RotateCw size={18} /></button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { 
                         const newObj: MapObject = { id: Date.now().toString(), name: 'Part', type: 'Part', position: [0, 5, 0], rotation: [0,0,0], scale: [1,1,1], color: '#A2A2A2', material: 'Plastic', transparency: 0, anchored: false, canCollide: true };
                         setObjects([...objects, newObj]); setSelectedId(newObj.id);
                    }} className="p-1 hover:bg-white/10 rounded"><BoxIcon size={20} className="text-blue-400" /></button>
                    <button onClick={() => { 
                         const newObj: MapObject = { id: Date.now().toString(), name: 'Sphere', type: 'Sphere', position: [0, 5, 0], rotation: [0,0,0], scale: [1,1,1], color: '#A2A2A2', material: 'Plastic', transparency: 0, anchored: false, canCollide: true };
                         setObjects([...objects, newObj]); setSelectedId(newObj.id);
                    }} className="p-1 hover:bg-white/10 rounded"><CircleIcon size={20} className="text-red-400" /></button>
                    <button onClick={() => { 
                         const newObj: MapObject = { id: Date.now().toString(), name: 'Wedge', type: 'Wedge', position: [0, 5, 0], rotation: [0,0,0], scale: [1,1,1], color: '#A2A2A2', material: 'Plastic', transparency: 0, anchored: false, canCollide: true };
                         setObjects([...objects, newObj]); setSelectedId(newObj.id);
                    }} className="p-1 hover:bg-white/10 rounded"><TriangleIcon size={20} className="text-green-400" /></button>
                    <button onClick={() => { 
                         const newObj: MapObject = { id: Date.now().toString(), name: 'Cylinder', type: 'Cylinder', position: [0, 5, 0], rotation: [0,0,0], scale: [1,1,1], color: '#A2A2A2', material: 'Plastic', transparency: 0, anchored: false, canCollide: true };
                         setObjects([...objects, newObj]); setSelectedId(newObj.id);
                    }} className="p-1 hover:bg-white/10 rounded"><CylinderIcon size={20} className="text-yellow-400 transform rotate-45" /></button>
                    
                    <input type="file" ref={fileInputRef} hidden accept=".glb,.gltf,.fbx" onChange={handleImportModel} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-1 hover:bg-white/10 rounded">
                        <Upload size={20} className="text-purple-400" />
                        <span className="text-[10px]">Importar 3D</span>
                    </button>

                    <input type="file" ref={audioInputRef} hidden accept="audio/*" onChange={handleImportAudio} />
                    <button onClick={() => audioInputRef.current?.click()} className="flex flex-col items-center justify-center p-1 hover:bg-white/10 rounded">
                        <Volume2 size={20} className="text-cyan-400" />
                        <span className="text-[10px]">Sonido</span>
                    </button>

                    <input type="file" ref={videoInputRef} hidden accept="video/*" onChange={handleImportVideo} />
                    <button onClick={() => videoInputRef.current?.click()} className="flex flex-col items-center justify-center p-1 hover:bg-white/10 rounded">
                        <VideoIcon size={20} className="text-orange-400" />
                        <span className="text-[10px]">Video</span>
                    </button>
                </div>
            </div>
            </div>
            <div className="h-12 bg-[#232428] flex items-center px-4 gap-4 border-t border-[#111213]">
                <div className="flex gap-2">
                    <button onClick={() => setShowPublishModal(true)} className="flex items-center gap-2 bg-[#2b2d31] border border-gray-600 hover:bg-gray-700 px-4 py-1.5 rounded text-sm font-bold transition-colors"><Save size={16} /> Publicar</button>
                    <button onClick={handlePlaySequence} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-1.5 rounded text-sm font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95"><Play size={16} fill="white" /> Jugar</button>
                </div>
                <div className="h-6 w-[1px] bg-white/10" />
                <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-widest">
                    <Layout size={14} />
                    <span>Modo Editor</span>
                </div>
            </div>
        </div>
      )}

      {/* STOP BUTTON / SERVER INFO */}
      {isPlaying && (
          <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
              <div className="flex gap-2">
                  <button onClick={() => { 
                      if (isPlayMode && onExit) onExit();
                      else { setIsPlaying(false); setLoadingStep(0); }
                  }} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-lg flex items-center gap-2 border-2 border-white/20">
                      <ArrowLeft size={20} /> {isPlayMode ? 'Salir del Juego' : 'Detener'}
                  </button>
                  <button onClick={toggleMic} className={`p-3 rounded-full shadow-lg border-2 border-white/20 ${isMicOn ? 'bg-green-600' : 'bg-gray-600'}`}>
                      {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
              </div>
              {activeServer && (
                  <div className="bg-black/50 p-2 rounded text-xs text-white border border-white/10 backdrop-blur-md">
                      <div className="font-bold text-green-400">● Conectado</div>
                      <div>{activeServer.name}</div>
                      <div>Ping: {activeServer.ping}ms</div>
                  </div>
              )}
          </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-[#111213] relative">
           <Canvas shadows dpr={[1, 2]}>
              <ErrorBoundary fallback={<gridHelper args={[100, 100, 0xff0000, 0x444444]} />}>
                 {!isPlaying && <OrbitControls makeDefault />}
                 <ambientLight intensity={0.5} />
                 <directionalLight position={[50, 50, 25]} intensity={0.8} castShadow />
                 
                 <Sky 
                    sunPosition={SKYBOXES[skybox as keyof typeof SKYBOXES].sunPosition as any} 
                    turbidity={skybox === 'Sunset' ? 10 : 0.5} 
                    rayleigh={skybox === 'Sunset' ? 3 : 0.5} 
                  />
                  {SKYBOXES[skybox as keyof typeof SKYBOXES].stars && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
                  <fog attach="fog" args={[SKYBOXES[skybox as keyof typeof SKYBOXES].fog, 0, 200]} />

                 {!isPlaying && <Grid infiniteGrid sectionSize={4} sectionColor="#6f6f6f" cellColor="#4a4a4a" position={[0, -0.01, 0]} />}

                 {isPlaying && (
                     <PlayerController 
                        avatarConfig={avatarConfig} 
                        mapObjects={objects} 
                        username={playerName} 
                        activeServer={activeServer} 
                        isPlaying={isPlaying}
                        currentScene={currentScene}
                        equippedWeapon={equippedWeapon}
                        isShooter={isShooter}
                        setEquippedWeapon={setEquippedWeapon}
                        setObjects={setObjects}
                        setKills={setKills}
                        setShowKillIcon={setShowKillIcon}
                     />
                 )}
                 
                 {/* RENDER REMOTE PLAYERS */}
                 {(isPlaying || !isPlayMode) && remotePlayers.map(rp => (
                     <RemotePlayerRenderer key={rp.id} player={rp} stream={remoteStreams[rp.id]} />
                 ))}

                 <RenderMap />
                 
                 {!isPlaying && (
                     <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} onClick={() => setSelectedId(null)}>
                       <planeGeometry args={[1000, 1000]} />
                       <meshBasicMaterial visible={false} />
                     </mesh>
                 )}
              </ErrorBoundary>
           </Canvas>
        </div>
        
        {!isPlaying && !isPlayMode && (
            <div className="w-64 bg-[#2b2d31] border-l border-[#111213] flex flex-col">
                <div className="flex-1 overflow-y-auto p-2">
                    <div className="text-xs font-bold text-gray-300 mb-2">EXPLORADOR</div>
                    {objects.map(obj => (
                        <div key={obj.id} onClick={() => setSelectedId(obj.id)} className={`pl-2 cursor-pointer text-sm flex items-center gap-2 py-0.5 ${selectedId === obj.id ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
                            {obj.type === 'Model' ? <FileBox size={12}/> : <BoxIcon size={12} />} {obj.name}
                        </div>
                    ))}
                </div>

                {/* PROPIEDADES */}
                {selectedId && (
                    <div className="h-1/2 border-t border-[#111213] p-3 overflow-y-auto bg-[#1e1f21]">
                        <div className="text-xs font-bold text-gray-300 mb-3 uppercase tracking-wider">Propiedades</div>
                        {objects.find(o => o.id === selectedId) && (() => {
                            const obj = objects.find(o => o.id === selectedId)!;
                            return (
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Nombre</label>
                                        <input 
                                            className="bg-black/20 border border-gray-700 rounded px-2 py-1 text-xs" 
                                            value={obj.name} 
                                            onChange={e => handleUpdateObject(obj.id, { name: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Color</label>
                                        <input 
                                            type="color"
                                            className="w-full h-8 bg-black/20 border border-gray-700 rounded cursor-pointer" 
                                            value={obj.color} 
                                            onChange={e => handleUpdateObject(obj.id, { color: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Material</label>
                                        <select 
                                            className="bg-black/20 border border-gray-700 rounded px-2 py-1 text-xs"
                                            value={obj.material}
                                            onChange={e => handleUpdateObject(obj.id, { material: e.target.value as any })}
                                        >
                                            {['Plastic', 'Neon', 'Grass', 'Wood', 'Brick', 'Fabric'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    {(obj.type === 'Model' || obj.isBot) && obj.availableAnimations && obj.availableAnimations.length > 0 && (
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-gray-500 font-bold uppercase">Animación</label>
                                            <select 
                                                className="bg-black/20 border border-gray-700 rounded px-2 py-1 text-xs"
                                                value={obj.selectedAnimation || obj.availableAnimations[0]}
                                                onChange={e => handleUpdateObject(obj.id, { selectedAnimation: e.target.value })}
                                            >
                                                {obj.availableAnimations.map(anim => (
                                                    <option key={anim} value={anim}>{anim}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {obj.type === 'Sound' && (
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-gray-500 font-bold uppercase">Evento de Sonido</label>
                                            <select 
                                                className="bg-black/20 border border-gray-700 rounded px-2 py-1 text-xs"
                                                value={obj.trigger || 'None'}
                                                onChange={e => handleUpdateObject(obj.id, { trigger: e.target.value as any })}
                                            >
                                                {['None', 'OnDeath', 'OnJump', 'OnFall', 'OnSpawn'].map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {obj.isBot && (
                                        <div className="space-y-4 border-t border-white/5 pt-4">
                                            <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Configuración de Bot</div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-gray-500 font-bold uppercase">Equipo</label>
                                                <select 
                                                    className="bg-black/20 border border-gray-700 rounded px-2 py-1 text-xs"
                                                    value={obj.team || 'Red'}
                                                    onChange={e => handleUpdateObject(obj.id, { team: e.target.value as any })}
                                                >
                                                    <option value="Red">Rojo</option>
                                                    <option value="Blue">Azul</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] text-gray-500 font-bold uppercase">Salud Máxima</label>
                                                <input 
                                                    type="number"
                                                    className="bg-black/20 border border-gray-700 rounded px-2 py-1 text-xs"
                                                    value={obj.maxHealth || 100}
                                                    onChange={e => handleUpdateObject(obj.id, { maxHealth: parseInt(e.target.value), health: parseInt(e.target.value) })}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 py-2 rounded text-[10px] font-bold uppercase"
                                            >
                                                Cambiar Modelo de Bot
                                            </button>
                                        </div>
                                    )}

                                    {obj.isWeapon && (
                                        <div className="space-y-4 border-t border-white/5 pt-4">
                                            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Configuración de Arma</div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] text-gray-500 font-bold uppercase">Tipo de Arma</label>
                                                <input 
                                                    className="bg-black/20 border border-gray-700 rounded px-2 py-1 text-xs"
                                                    value={obj.weaponType || 'Rifle'}
                                                    onChange={e => handleUpdateObject(obj.id, { weaponType: e.target.value })}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 py-2 rounded text-[10px] font-bold uppercase"
                                            >
                                                Cambiar Modelo de Arma
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Usar como Avatar</label>
                                        <input 
                                            type="checkbox"
                                            className="w-4 h-4 accent-blue-500"
                                            checked={obj.isAvatarReplacement || false}
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                // Uncheck all others
                                                setObjects(objects.map(o => ({
                                                    ...o,
                                                    isAvatarReplacement: o.id === obj.id ? checked : false
                                                })));
                                            }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Anclado</label>
                                        <input 
                                            type="checkbox"
                                            checked={obj.anchored}
                                            onChange={e => handleUpdateObject(obj.id, { anchored: e.target.checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Colisión</label>
                                        <input 
                                            type="checkbox"
                                            checked={obj.canCollide}
                                            onChange={e => handleUpdateObject(obj.id, { canCollide: e.target.checked })}
                                        />
                                    </div>
                                    
                                    <button 
                                        onClick={() => { setObjects(objects.filter(o => o.id !== selectedId)); setSelectedId(null); }}
                                        className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[10px] font-bold py-1.5 rounded border border-red-600/30"
                                    >
                                        ELIMINAR OBJETO
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
