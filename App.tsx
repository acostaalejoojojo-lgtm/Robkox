import React, { useState, useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { User, Page, AvatarConfig, Game, MapObject, Server, Video, AppSettings } from './types';
import { AvatarScene } from './components/AvatarScene';
import ErrorBoundary from './components/ErrorBoundary';
import { AvatarEditor } from './pages/AvatarEditor';
import { StudioPage } from './pages/Studio';
import { GameCard } from './components/GameCard';
import { Chat } from './components/Chat';
import { io, Socket } from 'socket.io-client';
import { dataService, GameData } from './lib/dataService';
import { isSupabaseEnabled, checkSupabaseConnection } from './lib/supabase';
import { 
  Play, ThumbsUp, User as UserIcon, Server as ServerIcon, Plus, Users, Settings as SettingsIcon, 
  Globe, Palette, Trash2, Search, LogOut as LogOutIcon, Star, Skull, Box as BoxIcon, 
  Triangle as TriangleIcon, ShieldCheck, CreditCard, Key, Upload, Database
} from 'lucide-react';

const TRANSLATIONS = {
  es: {
    home: "Inicio",
    profile: "Perfil",
    experiences: "Experiencias",
    avatar: "Avatar",
    create: "Crear",
    friends: "Amigos",
    settings: "Ajustes",
    customize: "Personalizar",
    play: "Jugar",
    welcome: "Hola",
    search_results: "Resultados de búsqueda para",
    recommended_users: "Usuarios Recomendados",
    search_users: "Buscar usuarios...",
    users: "Usuarios",
    add: "Agregar",
    online: "En línea",
    no_friends: "Aún no tienes amigos. ¡Busca usuarios arriba para agregarlos!",
    back_home: "← Volver al Inicio",
    language: "Idioma",
    region: "Región del Servidor",
    bg_color: "Color de Fondo",
    save: "Guardar",
    logout: "Cerrar Sesión",
    voxels: "Voxels",
    active_players: "Activos",
    likes: "Me gusta",
    join: "Unirse",
    create_server: "Crear Servidor Privado",
    server_name: "Nombre del Servidor",
    players: "Jugadores",
    ping: "Ping",
    action: "Acción",
    connected: "Conectado",
    exit_game: "Salir del Juego",
    stop: "Detener"
  },
  en: {
    home: "Home",
    profile: "Profile",
    experiences: "Experiences",
    avatar: "Avatar",
    create: "Create",
    friends: "Friends",
    settings: "Settings",
    customize: "Customize",
    play: "Play",
    welcome: "Hello",
    search_results: "Search results for",
    recommended_users: "Recommended Users",
    search_users: "Search users...",
    users: "Users",
    add: "Add",
    online: "Online",
    no_friends: "You don't have friends yet. Search for users above to add them!",
    back_home: "← Back to Home",
    language: "Language",
    region: "Server Region",
    bg_color: "Background Color",
    save: "Save",
    logout: "Logout",
    voxels: "Voxels",
    active_players: "Active",
    likes: "Likes",
    join: "Join",
    create_server: "Create Private Server",
    server_name: "Server Name",
    players: "Players",
    ping: "Ping",
    action: "Action",
    connected: "Connected",
    exit_game: "Exit Game",
    stop: "Stop"
  }
};

const LoadingSplash = ({ error, onRetry, onSkip }: { error?: string | null, onRetry: () => void, onSkip?: () => void }) => (
  <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1a1b1e] text-white font-sans">
    <div className="w-[100px] h-[100px] bg-[#2563eb] border-4 border-white rounded-[24px] flex items-center justify-center mb-6 shadow-[0_10px_30px_rgba(37,99,235,0.4)] relative">
      <div className="w-[40px] h-[10px] bg-white rounded-[5px] -rotate-45 absolute top-[30px] left-[20px]"></div>
      <div className="w-[10px] h-[40px] bg-white rounded-[5px] -rotate-45 absolute top-[20px] left-[30px]"></div>
      <div className="w-[40px] h-[8px] bg-white/80 rounded-[4px] rotate-[15deg] absolute bottom-[25px] right-[15px]"></div>
    </div>
    <h1 className="text-3xl font-black tracking-[2px] mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">GLIDROVIA</h1>
    {!error ? (
      <>
        <div className="w-[240px] h-1 bg-[#2b2d31] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-[loading_1.5s_infinite_ease-in-out]"></div>
        </div>
        <p className="mt-4 text-[#9ca3af] text-[12px] font-bold uppercase tracking-[1px]">Sincronizando mundos...</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-4 py-1 text-[10px] text-gray-500 hover:text-white border border-white/10 hover:border-white/30 rounded uppercase tracking-widest transition-all"
        >
          Reintentar Carga
        </button>
      </>
    ) : (
      <div className="text-center px-4 max-w-md">
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6">
          <p className="text-red-400 text-sm font-medium mb-2">⚠️ Error de Inicialización</p>
          <p className="text-gray-400 text-xs leading-relaxed">{error}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
          >
            Reintentar Conexión
          </button>
          <button 
            onClick={onSkip}
            className="w-full bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-bold text-sm transition-all border border-white/10"
          >
            Continuar sin Supabase (Modo Local)
          </button>
        </div>
      </div>
    )}
    <style>{`
      @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }
    `}</style>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<Page>(Page.HOME);
  const [user, setUser] = useState<User | null>(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings>({ language: 'es', backgroundColor: '#1a1b1e', selectedRegion: 'Global' });
  const [publicRegions, setPublicRegions] = useState<any[]>([]);
  const [publishingRegion, setPublishingRegion] = useState(false);
  const [customRegionName, setCustomRegionName] = useState('');
  
  useEffect(() => {
    const init = async () => {
      try {
        const regions = await dataService.getPublicRegions();
        setPublicRegions(regions);

        if (isSupabaseEnabled()) {
          const status = await checkSupabaseConnection();
          if (!status.connected) {
            setLoadingError(`Error de conexión con Supabase: ${status.error || 'Desconocido'}. Verifica tu URL y Anon Key en Configuración.`);
          }
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setTimeout(() => setIsAppReady(true), 1000);
      }
    };
    init();
  }, []);

  const t = TRANSLATIONS[settings.language as 'es' | 'en'];
  
  // Game Play State
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Initial Games
  const [publishedGames, setPublishedGames] = useState<Game[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.on("game-published", (newGame: Game) => {
      setPublishedGames(prev => [newGame, ...prev]);
    });

    s.on("game-updated", (updatedGame: Game) => {
      setPublishedGames(prev => prev.map(g => g.id === updatedGame.id ? updatedGame : g));
    });

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
      // Fetch initial games with retry
      const fetchGames = async (retries = 3) => {
          try {
              const data = await dataService.getGames();
              setPublishedGames(data as any);
          } catch (e) {
              console.error("Error fetching games:", e);
              if (retries > 0) {
                  console.log(`Retrying fetch games... (${retries} retries left)`);
                  setTimeout(() => fetchGames(retries - 1), 2000);
              }
          }
      };
      fetchGames();
  }, []);

  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    // Real-time users for search and recommendations
    const unsubscribe = dataService.subscribeToUsers((users) => {
        setAllUsers(users as User[]);
    });
    return () => unsubscribe();
  }, []);

  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    bodyColors: {
      head: '#F5CD30', torso: '#0047AB', leftArm: '#F5CD30', rightArm: '#F5CD30', leftLeg: '#A2C429', rightLeg: '#A2C429'
    },
    faceTextureUrl: null,
    accessories: { hatModelUrl: null, shirtTextureUrl: null },
    hideFace: false
  });

  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [globalAvatar, setGlobalAvatar] = useState<AvatarConfig | null>(null);
  const [globalAvatarReplacement, setGlobalAvatarReplacement] = useState<{ url: string; isFbx: boolean } | null>(null);

  useEffect(() => {
    // Listen to global settings
    const unsubscribeGlobal = dataService.subscribeToGlobalSettings((data) => {
        if (data.global_avatar) {
          setGlobalAvatar(data.global_avatar);
        }
        if (data.global_avatar_replacement) {
          setGlobalAvatarReplacement(data.global_avatar_replacement);
        } else {
          setGlobalAvatarReplacement(null);
        }
    });
    return () => unsubscribeGlobal();
  }, []);

  useEffect(() => {
    if (searchQuery) {
        dataService.searchUsers(searchQuery)
            .then(data => setFilteredUsers(data))
            .catch(err => console.error("Error searching users:", err));
    } else {
        setFilteredUsers([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isSupabaseEnabled()) {
        // Supabase mode: check local storage for session
        const storedUser = localStorage.getItem('glidroviaUser');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            // Subscribe to user updates
            const unsubscribe = dataService.subscribeToUser(parsedUser.username, (userData) => {
                setUser(userData as User);
                if (userData.avatar_config) setAvatarConfig(userData.avatar_config);
                if (userData.settings) setSettings(userData.settings);
                setIsAuthenticated(true);
            });
            return () => unsubscribe();
        }
    } else {
        // Firebase mode
        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            const unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), async (userDoc) => {
              if (userDoc.exists()) {
                const userData = userDoc.data() as User;
                setUser(userData);
                if (userData.avatarConfig) setAvatarConfig(userData.avatarConfig);
                if (userData.settings) setSettings(userData.settings);
                setIsAuthenticated(true);
              } else {
                // Create new user profile in Firestore if it doesn't exist
                const username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                const newUser: User = {
                  uid: firebaseUser.uid,
                  username: username,
                  displayName: firebaseUser.displayName || 'User',
                  robux: username.toLowerCase() === 'glidrovia' ? 99999 : 1540,
                  drovis: username.toLowerCase() === 'glidrovia' ? 99999 : 400,
                  friends: [],
                  avatarConfig: avatarConfig,
                  settings: settings,
                  rank: username.toLowerCase() === 'glidrovia' ? 'Platinum' : 'Standard',
                  usernameChangeCards: 1
                };
                try {
                    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
                    // Create username index
                    await setDoc(doc(db, 'users_by_username', newUser.username.toLowerCase()), { uid: firebaseUser.uid });
                } catch (err) {
                    try {
                        handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
                    } catch (e) {
                        console.error("Error creating user profile:", e);
                    }
                }
              }
            }, (err) => {
                try {
                    handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
                } catch (e) {
                    console.error("Firestore User Snapshot Error:", e);
                }
            });
            return () => unsubscribeUser();
          } else {
            // User is signed out, check legacy local storage
            const storedUser = localStorage.getItem('glidroviaUser');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                handleLogin(parsedUser.username);
            }
          }
        });
        return () => unsubscribeAuth();
    }
  }, []);

  const handleUpdateAvatar = async (config: AvatarConfig) => {
    // If global avatar is active, we might want to override or just update user's own
    setAvatarConfig(config);
    if (user) {
        try {
            await dataService.updateAvatar(user.username, config);
            
            // If user is glidrovia, they can update the global avatar
            if (user?.username?.toLowerCase() === 'glidrovia') {
                await dataService.updateGlobalSettings({ global_avatar: config });
            }
        } catch (err) {
            console.error("Error updating avatar:", err);
        }
    }
  };

  const handleLogin = async (username: string, password?: string) => {
    if (!username.trim()) return;
    try {
        // Sign in anonymously to Firebase to have a session for Firestore rules if not already logged in
        if (!auth.currentUser && !isSupabaseEnabled()) {
            try {
                await signInAnonymously(auth);
            } catch (authErr) {
                console.error("Firebase Anonymous Auth failed:", authErr);
            }
        }

        const userData = await dataService.login(username, password);
        
        if (userData.error) {
          alert(userData.error);
          return;
        }

        setUser(userData);
        if (userData.avatarConfig) setAvatarConfig(userData.avatarConfig);
        if (userData.settings) setSettings(userData.settings);
        localStorage.setItem('glidroviaUser', JSON.stringify({ username: userData.username }));
        setIsAuthenticated(true);
    } catch (err) {
        console.error("Error logging in:", err);
        alert("Error al iniciar sesión. Por favor, intenta de nuevo.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (err) {
        console.error("Error signing in with Google:", err);
        alert("Error al iniciar sesión con Google");
    }
  };

  const handleLogout = async () => {
    try {
        await signOut(auth);
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('glidroviaUser');
    } catch (err) {
        console.error("Error signing out:", err);
    }
  };

  const handleAddFriend = (friendName: string) => {
    if (!user) return;
    const updatedUser = { ...user, friends: [...(user.friends || []), friendName] };
    setUser(updatedUser);
    // Note: Friend persistence could also be moved to backend, but keeping it simple for now
    // as per the user's request to have "its own database" which I'm implementing via the user object
    localStorage.setItem('glidroviaUser', JSON.stringify({ username: user.username }));
    alert(`${t.add} ${friendName}!`);
  };

  const [supabaseStatus, setSupabaseStatus] = useState<{ connected: boolean, error?: string, url?: string }>({ connected: false });

  useEffect(() => {
    const check = async () => {
      const status = await checkSupabaseConnection();
      setSupabaseStatus(status);
    };
    check();
  }, []);

  const handleUpdateSettings = async (newSettings: any) => {
    setSettings(newSettings);
    if (user) {
        try {
            await dataService.updateSettings(user.username, newSettings);
        } catch (err) {
            console.error("Error updating settings:", err);
        }
    }
  };

  const handleChangeUsername = async (newUsername: string) => {
    if (!user) return;
    if (!newUsername.trim()) return;
    
    // Check if user has cards
    if ((user.usernameChangeCards || 0) <= 0) {
        alert("No tienes tarjetas de cambio de nombre.");
        return;
    }

    try {
        await dataService.updateUsername(user.uid, user.username, newUsername);
        
        // Update local state
        const updatedUser = { 
            ...user, 
            username: newUsername,
            displayName: newUsername,
            lastUsernameChange: new Date().toISOString(),
            usernameChangeCards: (user.usernameChangeCards || 1) - 1
        };
        setUser(updatedUser);
        
        alert("¡Nombre de usuario cambiado con éxito!");
    } catch (err: any) {
        console.error("Error changing username:", err);
        alert(`Error al cambiar el nombre de usuario: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleUploadGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
        const url = await dataService.uploadFile(file);
        const videoData = {
            url: url,
            creatorUid: user.uid,
            creatorName: user.displayName,
            createdAt: new Date().toISOString()
        };
        
        if (socket) {
            socket.emit("publish-video", videoData);
        }

        const updatedGallery = [url, ...(user.gallery || [])];
        const updatedUser = { ...user, gallery: updatedGallery };
        setUser(updatedUser);
        
        await dataService.updateGallery(user.username, updatedGallery);
        alert("¡Video subido y publicado en tiempo real!");
    } catch (err) {
        console.error("Error uploading to gallery:", err);
    }
  };

  const handlePublishGame = async (gameData: { title: string, map: MapObject[], skybox: string, thumbnail?: string }) => {
      const gameId = Date.now().toString();
      const newGame: Game = {
          id: gameId,
          title: gameData.title,
          creator: user?.displayName || 'Anon',
          creatorUid: user?.uid || 'anon',
          thumbnail: gameData.thumbnail || 'https://picsum.photos/seed/' + Math.random() + '/768/432',
          likes: '0%',
          likesCount: 0,
          stars: 0,
          starCount: 0,
          playing: 0,
          mapData: gameData.map,
          skybox: gameData.skybox
      };
      
      try {
          await dataService.saveGame(newGame);
          
          if (socket) {
              socket.emit("publish-game", newGame);
          }
          
          alert("¡Juego publicado con éxito en tiempo real!");
      } catch (err) {
          console.error("Error publishing game:", err);
          alert("Error al publicar el juego.");
      }
  };

  const openGameDetails = (game: Game) => {
      setSelectedGame(game);
      setCurrentPage(Page.PLAY);
  };

  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;

  const filteredGames = (publishedGames || []).filter(g => {
    const title = g.title || '';
    const creator = g.creator || '';
    const query = searchQuery || '';
    return title.toLowerCase().includes(query.toLowerCase()) || 
           creator.toLowerCase().includes(query.toLowerCase());
  });

  const searchedUsers = (allUsers || []).filter(u => {
    const username = u.username || '';
    const displayName = u.displayName || '';
    const query = searchQuery || '';
    return username.toLowerCase().includes(query.toLowerCase()) || 
           displayName.toLowerCase().includes(query.toLowerCase());
  });

  // --- STUDIO MODE ---
  if (currentPage === Page.STUDIO) {
      return (
        <div className="h-screen w-screen" style={{ backgroundColor: settings.backgroundColor }}>
           <button onClick={() => setCurrentPage(Page.HOME)} className="fixed top-3 right-3 z-50 bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs rounded shadow-md">{t.stop}</button>
           <StudioPage 
            onPublish={handlePublishGame} 
            avatarConfig={avatarConfig} 
            username={user?.username} 
            playerName={user?.displayName} 
            settings={settings}
          />
        </div>
      );
  }

  if (!isAppReady) {
    return (
      <LoadingSplash 
        error={loadingError} 
        onRetry={() => window.location.reload()} 
        onSkip={() => {
          setLoadingError(null);
          setIsAppReady(true);
        }}
      />
    );
  }

  // --- GAME PLAY MODE (LAUNCHER) ---
  if (currentPage === Page.PLAY && selectedGame && user) {
      return <GamePlayerView game={selectedGame} avatarConfig={avatarConfig} onBack={() => setCurrentPage(Page.HOME)} user={user} t={t} settings={settings} />;
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: settings.backgroundColor }}>
        {user && <Navbar user={user} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} onLogout={() => { setUser(null); setIsAuthenticated(false); }} onSearch={setSearchQuery} onNavigate={setCurrentPage} />}
        
        <div className="flex flex-1 pt-[0px] relative">
          <Sidebar isOpen={sidebarOpen} currentPage={currentPage} onNavigate={setCurrentPage} userName={user?.displayName || 'Guest'} t={t} />
          
          <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} ml-0`}>
            {currentPage === Page.HOME && user && (
              <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
                 {searchQuery && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-white mb-4">{t.search_results} "{searchQuery}"</h2>
                        {filteredUsers.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">{t.users}</h3>
                                <div className="flex flex-wrap gap-4">
                                    {filteredUsers.map(u => (
                                        <div key={u.username} className="bg-[#2b2d31] p-3 rounded-lg flex items-center gap-3 border border-gray-700">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-blue-500">
                                                <AvatarScene config={u.avatarConfig} interactive={false} globalAvatar={globalAvatarReplacement} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="text-white font-bold text-sm">{u.displayName}</div>
                                                    {u.rank === 'Platinum' && <ShieldCheck size={12} className="text-white" />}
                                                </div>
                                                <div className="text-gray-500 text-xs">@{u.username}</div>
                                            </div>
                                            <button 
                                                onClick={() => handleAddFriend(u.username)}
                                                className="ml-2 bg-white/10 hover:bg-white/20 p-1.5 rounded text-xs font-bold"
                                            >{t.add}</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                 )}

                 <div className="flex flex-col md:flex-row gap-8 mb-10">
                    <div className="flex-1">
                        <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden mb-6 border border-white/10 shadow-2xl">
                            <img 
                                src="/uploads/1775947470813-830032338.png" 
                                className="w-full h-full object-cover" 
                                alt="Banner"
                                referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                                <h1 className="text-3xl md:text-5xl font-black text-white mb-1 tracking-tighter italic uppercase">GLIDROVIA</h1>
                                <p className="text-blue-400 font-bold tracking-widest text-xs uppercase">Bienvenido de nuevo, {user.displayName}</p>
                            </div>
                        </div>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
                     <div className="lg:col-span-1 bg-[#2b2d31] p-4 rounded-xl border border-[#393b3d] flex flex-col items-center">
                          <div className="w-full aspect-[3/4] rounded-lg overflow-hidden relative">
                              <ErrorBoundary>
                                <AvatarScene config={avatarConfig} interactive={false} globalAvatar={globalAvatarReplacement} />
                              </ErrorBoundary>
                          </div>
                          {globalAvatarReplacement ? (
                              <div className="mt-4 w-full bg-blue-600/20 border border-blue-500/30 py-2 rounded-lg font-bold text-[10px] text-blue-400 text-center uppercase tracking-wider">
                                  Avatar Global Activo
                              </div>
                          ) : (
                              <button onClick={() => setCurrentPage(Page.AVATAR)} className="mt-4 w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg font-medium text-sm transition-colors text-white">{t.customize}</button>
                          )}
                     </div>
                     <div className="lg:col-span-3">
                         <h3 className="text-xl font-bold text-white mb-4">{t.experiences} {searchQuery ? '(Filtradas)' : ''}</h3>
                         
                         {searchQuery && searchedUsers.length > 0 && (
                            <div className="mb-8">
                                <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Usuarios Encontrados</h4>
                                <div className="flex flex-wrap gap-4">
                                    {searchedUsers.map(u => (
                                        <div key={u.uid} className="bg-[#2b2d31] p-3 rounded-xl flex items-center gap-3 border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer" onClick={() => { setCurrentPage(Page.PROFILE); }}>
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-blue-500">
                                                <AvatarScene config={u.avatarConfig || avatarConfig} interactive={false} globalAvatar={globalAvatarReplacement} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="text-white font-bold text-sm">{u.displayName}</div>
                                                    {u.rank === 'Platinum' && <ShieldCheck size={12} className="text-white" />}
                                                </div>
                                                <div className="text-gray-500 text-xs">@{u.username}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}

                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                             {(searchQuery ? filteredGames : publishedGames).map(game => (
                                 <div key={game.id} onClick={() => openGameDetails(game)}>
                                     <GameCard game={game} />
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>
              </div>
            )}
            
            {currentPage === Page.PROFILE && (
                <div className="p-8 max-w-4xl mx-auto">
                    <div className="bg-[#2b2d31] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                        <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                        <div className="px-8 pb-8 flex flex-col md:flex-row gap-6">
                            <div className="w-48 h-48 -mt-24 bg-[#111213] rounded-2xl border-4 border-[#2b2d31] overflow-hidden shadow-lg relative">
                                <ErrorBoundary>
                                    <AvatarScene config={avatarConfig} interactive={false} globalAvatar={globalAvatarReplacement} />
                                </ErrorBoundary>
                            </div>
                            <div className="flex-1 pt-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-3xl font-bold text-white">{user.displayName}</h2>
                                            {user.rank === 'Platinum' && (
                                                <div className="bg-white/10 p-1.5 rounded-lg border border-white/20 flex items-center gap-1.5" title="Rango Platino">
                                                    <ShieldCheck size={18} className="text-white" />
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Platino</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-gray-400">@{user.username}</p>
                                    </div>
                                    <label className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm cursor-pointer transition-colors">
                                        Subir Video
                                        <input type="file" accept="video/*" className="hidden" onChange={handleUploadGallery} />
                                    </label>
                                </div>
                                <div className="flex gap-4 mt-4">
                                    <div className="text-center">
                                        <div className="text-white font-bold">{(user.friends || []).length}</div>
                                        <div className="text-xs text-gray-500 uppercase">{t.friends}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-white font-bold">{(user.gallery || []).length}</div>
                                        <div className="text-xs text-gray-500 uppercase">Videos</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* History Section */}
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-4">Mapas Jugados</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {(user.playedHistory || []).slice(0, 4).map(gameId => {
                                    const game = publishedGames.find(g => g.id === gameId);
                                    if (!game) return null;
                                    return (
                                        <div key={gameId} onClick={() => openGameDetails(game)} className="cursor-pointer">
                                            <GameCard game={game} />
                                        </div>
                                    );
                                })}
                                {(user.playedHistory || []).length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-500 bg-[#2b2d31] rounded-xl border border-gray-700">
                                        No has jugado mapas aún.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-4">Ropa Usada</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {(user.clothingHistory || []).slice(0, 4).map(itemId => (
                                    <div key={itemId} className="bg-[#2b2d31] p-2 rounded-xl border border-gray-700 flex flex-col items-center">
                                        <div className="w-full aspect-square bg-[#111213] rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                            <img src={`https://picsum.photos/seed/${itemId}/200/200`} className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-xs text-gray-400">Item #{itemId.slice(-4)}</span>
                                    </div>
                                ))}
                                {(user.clothingHistory || []).length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-500 bg-[#2b2d31] rounded-xl border border-gray-700">
                                        No has usado ropa aún.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Gallery Section */}
                    <div className="mt-8">
                        <h3 className="text-xl font-bold text-white mb-4">Galería de Videos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(user.gallery || []).map((videoUrl, idx) => (
                                <div key={idx} className="bg-[#2b2d31] rounded-xl border border-gray-700 overflow-hidden aspect-video relative group">
                                    <video src={videoUrl} className="w-full h-full object-cover" controls />
                                    <button 
                                        onClick={async () => {
                                            if (confirm("¿Eliminar este video?")) {
                                                const updated = user.gallery?.filter(u => u !== videoUrl);
                                                setUser({ ...user, gallery: updated });
                                                await dataService.updateGallery(user.username, updated || []);
                                            }
                                        }}
                                        className="absolute top-2 right-2 bg-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            {(user.gallery || []).length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-500 bg-[#2b2d31] rounded-xl border border-dashed border-gray-700">
                                    No has subido videos aún.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {currentPage === Page.SOCIAL && (
                <div className="p-8 max-w-5xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h2 className="text-3xl font-bold text-white">{t.friends}</h2>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input 
                                type="text"
                                placeholder={t.search_users}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#111213] border border-gray-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Friends List */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider mb-4">Mis Amigos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(user?.friends || []).length > 0 ? (
                                    user?.friends?.map(f => (
                                        <div key={f} className="bg-[#2b2d31] p-4 rounded-xl border border-gray-700 flex items-center gap-4 hover:border-gray-600 transition-all group">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                                {(f[0] || '').toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-white font-bold">{f}</div>
                                                <div className="text-xs text-green-500 flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                    {t.online}
                                                </div>
                                            </div>
                                            <button className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors">Chat</button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-12 text-gray-500 bg-[#2b2d31] rounded-xl border border-dashed border-gray-700">
                                        <Users size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>{t.no_friends}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recommended Users / Search Results */}
                        <div className="space-y-4">
                            <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider mb-4">
                                {searchQuery ? t.search_results : t.recommended_users}
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {allUsers
                                    .filter(u => u.uid !== user?.uid && (searchQuery ? (u.username || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || (u.displayName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) : true))
                                    .map(u => (
                                        <div key={u.uid} className="bg-[#1e1f21] p-3 rounded-xl border border-gray-800 flex items-center gap-3 hover:bg-[#2b2d31] transition-all">
                                            <div className="w-10 h-10 rounded-full bg-[#111213] border border-gray-700 overflow-hidden flex items-center justify-center relative">
                                                {u.avatarConfig ? (
                                                    <div className="w-full h-full scale-150">
                                                        <AvatarScene config={u.avatarConfig} interactive={false} globalAvatar={globalAvatarReplacement} />
                                                    </div>
                                                ) : (
                                                    <UserIcon size={20} className="text-gray-600" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-bold text-sm truncate">{u.displayName || u.username}</div>
                                                <div className="text-xs text-gray-500 truncate">@{u.username}</div>
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    if (!user.friends?.includes(u.username)) {
                                                        const updatedFriends = [...(user.friends || []), u.username];
                                                        await updateDoc(doc(db, 'users', user.uid), { friends: updatedFriends });
                                                    }
                                                }}
                                                className={`p-2 rounded-lg transition-colors ${user.friends?.includes(u.username) ? 'bg-green-600/20 text-green-500 cursor-default' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                            >
                                                {user.friends?.includes(u.username) ? <ThumbsUp size={16} /> : <Plus size={16} />}
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {currentPage === Page.STORE && user && (
                <div className="p-8 max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">TIENDA ANIEA</h2>
                            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Gasta tus Drovis en artículos exclusivos</p>
                        </div>
                        <div className="bg-blue-600/20 border border-blue-500/30 px-6 py-3 rounded-2xl flex flex-col items-end">
                            <span className="text-blue-400 font-black text-2xl leading-none">{user.drovis || 0}</span>
                            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Tus Drovis</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[
                            { id: 'hat_crown', name: 'Corona de Oro', price: 500, type: 'hat', icon: <Star className="text-yellow-400" /> },
                            { id: 'hat_ninja', name: 'Máscara Ninja', price: 300, type: 'hat', icon: <Skull className="text-gray-400" /> },
                            { id: 'shirt_glidrovia', name: 'Camisa Glidrovia', price: 200, type: 'shirt', icon: <BoxIcon className="text-blue-400" /> },
                            { id: 'hat_viking', name: 'Casco Vikingo', price: 450, type: 'hat', icon: <TriangleIcon className="text-orange-400" /> },
                        ].map(item => {
                            const isOwned = (user.clothingHistory || []).includes(item.id);
                            return (
                                <div key={item.id} className="bg-[#2b2d31] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:border-blue-500/50 transition-all group">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                        {React.cloneElement(item.icon as React.ReactElement<any>, { size: 40 })}
                                    </div>
                                    <div className="text-center">
                                        <div className="text-white font-bold">{item.name}</div>
                                        <div className="text-[10px] text-gray-500 uppercase font-bold">{item.type}</div>
                                    </div>
                                    <button 
                                        disabled={isOwned || (user.drovis || 0) < item.price}
                                        onClick={async () => {
                                            try {
                                                const data = await dataService.purchaseItem(user.username, { id: item.id, price: item.price, currency: 'drovis' });
                                                if (data) {
                                                    setUser({ ...user, drovis: data.drovis, clothingHistory: [...(user.clothingHistory || []), item.id] });
                                                    alert(`¡Has comprado ${item.name}!`);
                                                }
                                            } catch (err: any) {
                                                console.error("Purchase error:", err);
                                                alert(err.message || "Error en la compra");
                                            }
                                        }}
                                        className={`w-full py-2 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${isOwned ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 disabled:opacity-50'}`}
                                    >
                                        {isOwned ? 'Comprado' : `${item.price} Drovis`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {currentPage === Page.SETTINGS && (
                <div className="p-8 max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                        <SettingsIcon size={32} /> {t.settings}
                    </h2>
                    
                    <div className="space-y-8 bg-[#2b2d31] p-8 rounded-2xl border border-gray-700 shadow-xl">
                        {/* Username Change Section */}
                        <div className="flex flex-col gap-3 pb-6 border-b border-white/5">
                            <label className="text-gray-400 font-bold uppercase text-xs flex items-center gap-2">
                                <CreditCard size={14} /> Cambiar Nombre de Usuario
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    placeholder="Nuevo nombre..."
                                    className="flex-1 bg-[#111213] border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                    id="new-username-input"
                                />
                                <button 
                                    onClick={() => {
                                        const input = document.getElementById('new-username-input') as HTMLInputElement;
                                        if (input) handleChangeUsername(input.value);
                                    }}
                                    className={`px-6 py-2 rounded-xl font-bold transition-all ${user.usernameChangeCards > 0 ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                >
                                    {user.usernameChangeCards > 0 ? 'Usar Tarjeta' : 'Sin Tarjetas'}
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase">
                                Tienes <span className="text-blue-400">{user.usernameChangeCards || 0}</span> tarjetas. Se puede cambiar 1 vez al mes.
                            </p>
                        </div>

                        {/* Glidrovia Admin Section */}
                        {user?.username?.toLowerCase() === 'glidrovia' && (
                            <div className="flex flex-col gap-3 pb-6 border-b border-white/5">
                                <label className="text-yellow-400 font-bold uppercase text-xs flex items-center gap-2">
                                    <Key size={14} /> Cuentas y Contraseñas (Solo Glidrovia)
                                </label>
                                <button 
                                    onClick={async () => {
                                        try {
                                            const res = await fetch(`/api/admin/users?admin_password=glidroviaoficial`);
                                            const data = await res.json();
                                            console.log("User Data:", data);
                                            alert("Datos de usuarios cargados en consola. Revisa el inspector.");
                                            // Optional: Show in a list
                                            const list = Object.values(data).map((u: any) => `${u.username}: ${u.password || 'N/A'}`).join('\n');
                                            alert(list);
                                        } catch (err) {
                                            console.error("Error fetching admin users:", err);
                                        }
                                    }}
                                    className="w-full bg-yellow-600/20 hover:bg-yellow-600/40 border border-yellow-500/30 py-3 rounded-xl text-yellow-500 font-bold text-sm uppercase mb-4"
                                >
                                    Ver todas las contraseñas
                                </button>

                                <div className="space-y-3">
                                    <label className="text-blue-400 font-bold uppercase text-[10px] flex items-center gap-2">
                                        <Upload size={12} /> Importar Avatar Global (GLB/FBX)
                                    </label>
                                    <input 
                                        type="file" 
                                        accept=".glb,.gltf,.fbx"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            
                                            try {
                                                const url = await dataService.uploadFile(file);
                                                if (url) {
                                                    const isFbx = file.name.toLowerCase().endsWith('.fbx');
                                                    const config = { globalAvatarReplacement: { url, isFbx } };
                                                    
                                                    // Update both if possible (for migration) or just use dataService
                                                    await dataService.updateGlobalSettings(config);
                                                    
                                                    // Fallback for Firebase if still used
                                                    try {
                                                        await setDoc(doc(db, 'global_settings', 'main'), config, { merge: true });
                                                    } catch {}

                                                    alert("Avatar global actualizado para todos!");
                                                }
                                            } catch (err) {
                                                console.error("Error uploading global avatar:", err);
                                                alert("Error al subir el avatar global");
                                            }
                                        }}
                                        className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-2 text-xs text-gray-400"
                                    />
                                    {globalAvatarReplacement && (
                                        <button 
                                            onClick={async () => {
                                                const config = { globalAvatarReplacement: null };
                                                await dataService.updateGlobalSettings(config);
                                                try {
                                                    await setDoc(doc(db, 'global_settings', 'main'), config, { merge: true });
                                                } catch {}
                                                alert("Avatar global eliminado");
                                            }}
                                            className="text-red-500 text-[10px] font-bold uppercase hover:underline"
                                        >
                                            Eliminar Avatar Global
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <label className="text-gray-400 font-bold uppercase text-xs flex items-center gap-2">
                                <Globe size={14} /> {t.region}
                            </label>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {[
                                    { id: 'Global', label: 'Global 🌎', emoji: '🌎' },
                                    { id: 'AR', label: 'Argentina 🇦🇷', emoji: '🇦🇷' },
                                    { id: 'MX', label: 'México 🇲🇽', emoji: '🇲🇽' },
                                    { id: 'ES', label: 'España 🇪🇸', emoji: '🇪🇸' },
                                    { id: 'US', label: 'United States 🇺🇸', emoji: '🇺🇸' },
                                    { id: 'Supabase', label: 'Mi Supabase 🚀', emoji: '🚀' },
                                    ...publicRegions.map(pr => ({ id: pr.id, label: pr.label, emoji: pr.emoji, config: pr }))
                                ].map(reg => (
                                    <button 
                                        key={reg.id}
                                        onClick={() => {
                                            if ((reg as any).config) {
                                                const config = (reg as any).config;
                                                localStorage.setItem('VITE_SUPABASE_URL', config.url);
                                                localStorage.setItem('VITE_SUPABASE_ANON_KEY', config.key);
                                                window.location.reload(); // Hard reload to apply new supabase client
                                                return;
                                            }

                                            const newSettings = { ...settings, selectedRegion: reg.id };
                                            handleUpdateSettings(newSettings);
                                            // Real-time: if switching to/from Supabase, we might want to alert
                                            if (reg.id === 'Supabase' && !isSupabaseEnabled()) {
                                                alert("Configura Supabase abajo para usar esta región.");
                                            }
                                        }}
                                        className={`flex items-center gap-2 px-3 py-3 rounded-xl font-bold transition-all text-[10px] ${settings.selectedRegion === reg.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-[#111213] text-gray-400 hover:bg-[#1e1f21]'}`}
                                    >
                                        <span className="text-xs">{reg.emoji}</span>
                                        <span className="truncate">{reg.label}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9px] text-gray-500 italic mt-1">
                                {settings.selectedRegion === 'Supabase' 
                                    ? 'Conectado a tu base de datos privada en tiempo real.' 
                                    : 'Usando servidores globales compartidos (Glidrovia Network).'}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-blue-400 font-bold uppercase text-xs flex items-center gap-2">
                                <Database size={14} /> Conexión Supabase (BYOB)
                            </label>
                            <div className="bg-[#111213] p-4 rounded-xl border border-gray-700 space-y-3">
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Configura tu propio servidor global</p>
                                
                                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-[10px] text-amber-200 leading-relaxed">
                                    <p className="font-bold mb-1">⚠️ IMPORTANTE:</p>
                                    No uses "Personal Access Tokens". Necesitas las <strong>Project API Keys</strong>.
                                    <br/>
                                    <a href="https://supabase.com/dashboard/project/_/settings/api" target="_blank" rel="noreferrer" className="underline hover:text-white font-bold">
                                        Ir a Project Settings {'>'} API
                                    </a>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] text-gray-500 uppercase font-bold">Project URL</label>
                                    <input 
                                        type="text" 
                                        placeholder="https://xyz.supabase.co"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                        defaultValue={localStorage.getItem('VITE_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL}
                                        onChange={(e) => {
                                            localStorage.setItem('VITE_SUPABASE_URL', e.target.value);
                                        }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] text-gray-500 uppercase font-bold">Anon Public Key</label>
                                    <input 
                                        type="password" 
                                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                        defaultValue={localStorage.getItem('VITE_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_ANON_KEY}
                                        onChange={(e) => {
                                            localStorage.setItem('VITE_SUPABASE_ANON_KEY', e.target.value);
                                        }}
                                    />
                                </div>

                                <button 
                                    onClick={() => window.location.reload()}
                                    className="w-full bg-blue-600 hover:bg-blue-700 border border-blue-500/30 py-3 rounded-xl text-[10px] font-bold text-white uppercase transition-all shadow-lg shadow-blue-900/20"
                                >
                                    Aplicar y Reiniciar
                                </button>

                                <div className="flex flex-col gap-1 pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${supabaseStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                                            {supabaseStatus.connected ? 'Conectado a' : 'Error de Conexión'}
                                        </span>
                                        {supabaseStatus.connected && supabaseStatus.url && (
                                            <span className="text-[9px] text-blue-400 font-mono truncate max-w-[150px]" title={supabaseStatus.url}>
                                                {supabaseStatus.url.replace('https://', '').split('.')[0]}
                                            </span>
                                        )}
                                    </div>
                                    {supabaseStatus.error && (
                                        <p className="text-[9px] text-red-400 italic bg-red-500/5 p-2 rounded border border-red-500/10">
                                            {supabaseStatus.error}
                                        </p>
                                    )}
                                    {!isSupabaseEnabled() && !supabaseStatus.error && (
                                        <p className="text-[9px] text-gray-600 italic">
                                            Sin Supabase, los datos se guardarán solo en esta sesión.
                                        </p>
                                    )}
                                </div>

                                {isSupabaseEnabled() && (
                                    <div className="pt-4 border-t border-white/5 space-y-3">
                                        <div className="bg-blue-600/10 border border-blue-500/20 p-3 rounded-lg mb-4">
                                            <p className="text-[10px] text-blue-300 font-bold uppercase mb-2">Setup Multijugador Realtime</p>
                                            <p className="text-[9px] text-gray-400 mb-3 leading-relaxed">
                                                Copia y pega este SQL en tu Dashboard de Supabase (SQL Editor) para habilitar el tiempo real:
                                            </p>
                                            <div className="relative group">
                                                <pre className="bg-black/60 p-3 rounded-lg text-[8px] font-mono text-blue-200 overflow-x-auto whitespace-pre border border-white/5 max-h-40">
{`-- 1. Habilitar Tiempo Real (Réplicas)
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table global_settings;

-- 2. Asegurar Tablas
create table if not exists users (
  uid text primary key,
  username text unique,
  display_name text,
  avatar_url text,
  settings jsonb,
  credits int default 1000,
  updated_at timestamp with time zone default now()
);

create table if not exists global_settings (
  id text primary key,
  data jsonb,
  updated_at timestamp with time zone default now()
);`}
                                                </pre>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-blue-400 uppercase font-bold">Publicar Mi Región</p>
                                        <div className="space-y-2">
                                            <label className="text-[9px] text-gray-500 uppercase font-bold">Nombre del País / Servidor</label>
                                            <input 
                                                type="text" 
                                                placeholder="Ej: Perú 🇵🇪"
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                                value={customRegionName}
                                                onChange={(e) => setCustomRegionName(e.target.value)}
                                            />
                                        </div>
                                        <button 
                                            disabled={!customRegionName || publishingRegion}
                                            onClick={async () => {
                                                setPublishingRegion(true);
                                                try {
                                                    await dataService.publishRegion(
                                                        customRegionName,
                                                        localStorage.getItem('VITE_SUPABASE_URL') || '',
                                                        localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '',
                                                        user?.username || 'Anon'
                                                    );
                                                    alert("¡Región publicada! Otros podrán conectarse a tu Supabase.");
                                                    const updatedRegions = await dataService.getPublicRegions();
                                                    setPublicRegions(updatedRegions);
                                                } catch (err) {
                                                    console.error("Error publishing region:", err);
                                                    alert("Error al publicar región.");
                                                } finally {
                                                    setPublishingRegion(false);
                                                }
                                            }}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl text-[10px] font-bold text-white uppercase transition-all flex items-center justify-center gap-2"
                                        >
                                            {publishingRegion ? 'Publicando...' : 'Publicar Región'}
                                        </button>
                                    </div>
                                )}

                                <div className="bg-blue-500/5 border border-blue-500/10 p-2 rounded text-[9px] text-blue-400/60 italic">
                                    ¿Tablas no encontradas? Asegúrate de haber ejecutado el SQL de inicialización en el editor de Supabase.
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-gray-400 font-bold uppercase text-xs flex items-center gap-2">
                                <Globe size={14} /> {t.language}
                            </label>
                            <div className="flex gap-2">
                                {['es', 'en'].map(lang => (
                                    <button 
                                        key={lang}
                                        onClick={() => handleUpdateSettings({ ...settings, language: lang })}
                                        className={`flex-1 py-3 rounded-xl font-bold transition-all ${settings.language === lang ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-[#111213] text-gray-400 hover:bg-[#1e1f21]'}`}
                                    >
                                        {lang === 'es' ? 'Español' : 'English'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-gray-400 font-bold uppercase text-xs flex items-center gap-2">
                                <Palette size={14} /> {t.bg_color}
                            </label>
                            <div className="flex flex-wrap gap-3">
                                {['#1a1b1e', '#232527', '#0f172a', '#1e1b4b', '#450a0a', '#064e3b'].map(color => (
                                    <button 
                                        key={color}
                                        onClick={() => handleUpdateSettings({ ...settings, backgroundColor: color })}
                                        className={`w-12 h-12 rounded-full border-2 transition-transform hover:scale-110 ${settings.backgroundColor === color ? 'border-blue-500 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={() => setCurrentPage(Page.HOME)}
                            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                        >
                            {t.save}
                        </button>
                    </div>
                </div>
            )}

            {currentPage === Page.AVATAR && (
                <div className="p-4 md:p-8 max-w-6xl mx-auto h-[calc(100vh-60px)] flex flex-col">
                     <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
                        <div className="flex-1 bg-[#111213] rounded-xl border border-[#393b3d] relative overflow-hidden shadow-2xl">
                          <ErrorBoundary>
                            <AvatarScene config={avatarConfig} globalAvatar={globalAvatarReplacement} />
                          </ErrorBoundary>
                        </div>
                        <div className="w-full md:w-[400px] bg-[#232527] rounded-xl border border-[#393b3d] overflow-hidden flex flex-col shadow-xl">
                          <AvatarEditor currentConfig={globalAvatar || avatarConfig} onUpdateConfig={handleUpdateAvatar} socket={socket} user={user} globalAvatarReplacement={globalAvatarReplacement} />
                        </div>
                     </div>
                </div>
            )}
            
            {currentPage === Page.GAMES && (
                 <div className="p-8">
                     <h2 className="text-2xl font-bold text-white mb-6">Todas las Experiencias</h2>
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                         {publishedGames.map(game => <div key={game.id} onClick={() => openGameDetails(game)}><GameCard game={game} /></div>)}
                     </div>
                 </div>
            )}
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

// --- SUB-COMPONENT: GAME DETAILS & PLAYER ---
const GamePlayerView = ({ game, avatarConfig, onBack, user, t, settings }: { game: Game, avatarConfig: AvatarConfig, onBack: () => void, user: User, t: any, settings: any }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [xpGained, setXpGained] = useState(0);
    const [activeServer, setActiveServer] = useState<Server | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [servers, setServers] = useState<Server[]>([
        { id: '1', name: 'Google Cloud - Global Alpha', players: 12, maxPlayers: 20, ping: 45, status: 'online', region: 'Google Cloud' },
        { id: '2', name: 'Oracle Cloud - Voxel Hub', players: 18, maxPlayers: 20, ping: 52, status: 'online', region: 'Oracle Cloud' },
        { id: '3', name: 'Google Cloud - Friends Only', players: 3, maxPlayers: 10, ping: 38, status: 'online', region: 'Google Cloud' },
    ]);

    useEffect(() => {
        const s = io();
        setSocket(s);

        // Keep servers "alive"
        const interval = setInterval(() => {
            setServers(prev => prev.map(srv => ({
                ...srv,
                players: Math.max(1, Math.min(srv.maxPlayers, srv.players + (Math.random() > 0.5 ? 1 : -1))),
                ping: Math.max(20, Math.min(100, srv.ping + Math.floor(Math.random() * 5) - 2))
            })));
        }, 5000);

        return () => { 
            s.disconnect(); 
            clearInterval(interval);
        };
    }, []);

    const [queuePosition, setQueuePosition] = useState<number | null>(null);

    const handleJoinServer = (server: Server) => {
        // Record play history
        if (socket && user) {
            socket.emit("play-game", { gameId: game.id, username: user.username });
        }

        if (server.players >= server.maxPlayers) {
            // Fake queue system
            setQueuePosition(Math.floor(Math.random() * 10) + 1);
            let currentPos = Math.floor(Math.random() * 10) + 1;
            const interval = setInterval(() => {
                currentPos -= 1;
                setQueuePosition(currentPos);
                if (currentPos <= 0) {
                    clearInterval(interval);
                    setQueuePosition(null);
                    setActiveServer(server);
                    setIsPlaying(true);
                }
            }, 2000);
        } else {
            setActiveServer(server);
            setIsPlaying(true);
        }
    };

    const handleCreateServer = () => {
        const newServer: Server = {
            id: Date.now().toString(),
            name: `${user.username}'s World`,
            players: 1,
            maxPlayers: 10,
            ping: 20,
            status: 'online',
            region: 'Google Cloud'
        };
        setServers([...servers, newServer]);
        handleJoinServer(newServer);
    };

    const handleQuickPlay = () => {
        handleJoinServer(servers[0]);
    }

    const handleDeleteGame = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("¿Estás seguro de que quieres eliminar este mapa?")) {
            try {
                await dataService.deleteGame(game.id);
                onBack();
            } catch (err) {
                console.error("Error deleting game:", err);
            }
        }
    };

    if (queuePosition !== null) {
        return (
            <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white font-sans">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8" />
                <h2 className="text-3xl font-bold mb-4">Servidor Lleno</h2>
                <p className="text-xl text-gray-400 mb-2">Estás en la cola para entrar.</p>
                <p className="text-2xl font-bold text-blue-400">Posición: {queuePosition}</p>
                <button 
                    onClick={() => setQueuePosition(null)}
                    className="mt-8 px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
                >
                    Cancelar
                </button>
            </div>
        );
    }

    if (isPlaying) {
        return (
            <div className="h-screen w-screen bg-black relative">
                {socket && <Chat socket={socket} roomId={activeServer?.id || 'global-lobby'} username={user.username} />}
                <StudioPage 
                    onPublish={() => {}} 
                    avatarConfig={avatarConfig} 
                    initialMapData={game.mapData} 
                    initialGame={game}
                    isPlayMode={true} 
                    activeServer={activeServer}
                    playerName={user.displayName}
                    username={user.username}
                    onExit={() => setIsPlaying(false)}
                    settings={settings}
                />
                {xpGained > 0 && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/80 text-white px-4 py-2 rounded-full font-bold shadow-lg animate-pulse z-[100]">
                        +{xpGained} XP
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-screen w-screen text-white overflow-y-auto" style={{ backgroundColor: settings.backgroundColor }}>
            {/* Banner Blur Background */}
            <div className="absolute top-0 left-0 w-full h-[60vh] overflow-hidden opacity-30 pointer-events-none">
                 <img src={game.thumbnail || undefined} className="w-full h-full object-cover blur-xl" />
                 <div className="absolute inset-0 bg-gradient-to-t from-[#1a1b1e] via-transparent to-transparent"></div>
            </div>

            <div className="relative max-w-6xl mx-auto pt-20 px-6 z-10 flex flex-col md:flex-row gap-8">
                 {/* Game Thumbnail */}
                 <div className="w-full md:w-[640px] aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700">
                     <img src={game.thumbnail || undefined} className="w-full h-full object-cover" />
                 </div>

                 {/* Info & Play */}
                 <div className="flex-1 flex flex-col gap-4">
                     <div>
                         <h1 className="text-4xl font-extrabold mb-2">{game.title}</h1>
                         <div className="flex items-center gap-2 text-gray-400">
                             <span>By <span className="text-white font-bold hover:underline cursor-pointer">{game.creator}</span></span>
                         </div>
                     </div>

                     <div className="flex items-center gap-6 py-4 border-y border-gray-700">
                         <div className="flex flex-col">
                             <span className="text-lg font-bold text-white">{game.playing.toLocaleString()}</span>
                             <span className="text-xs text-gray-400">{t.active_players}</span>
                         </div>
                         <div className="flex flex-col">
                             <span className="text-lg font-bold text-white">{game.likesCount || 0}</span>
                             <span className="text-xs text-gray-400">{t.likes}</span>
                         </div>
                         <div className="flex flex-col">
                             <div className="flex items-center gap-1">
                                 <span className="text-lg font-bold text-white">{(game.stars || 0).toFixed(1)}</span>
                                 <span className="text-yellow-500">★</span>
                             </div>
                             <span className="text-xs text-gray-400">{game.starCount || 0} Votos</span>
                         </div>
                     </div>

                     {/* Interaction Buttons */}
                     <div className="flex gap-4">
                         <button 
                           onClick={() => socket?.emit("like-game", { gameId: game.id })}
                           className="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-lg flex items-center justify-center gap-2 border border-white/10 transition-colors"
                         >
                           <ThumbsUp size={18} /> Like
                         </button>
                         <div className="flex-1 flex items-center justify-center gap-1 bg-white/5 rounded-lg border border-white/10 px-2">
                           {[1, 2, 3, 4, 5].map(star => (
                               <button 
                                   key={star}
                                   onClick={() => socket?.emit("rate-game", { gameId: game.id, stars: star })}
                                   className="text-gray-500 hover:text-yellow-500 transition-colors text-xl"
                               >
                                   ★
                               </button>
                           ))}
                         </div>
                     </div>

                     {/* BIG PLAY BUTTON */}
                     <div className="flex gap-4">
                         <button 
                            onClick={handleQuickPlay}
                            className="bg-blue-600 hover:bg-blue-500 w-full md:w-48 py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg transform transition-transform active:scale-95"
                         >
                             <div className="bg-white/20 p-1 rounded">
                                 <Play fill="white" size={32} />
                             </div>
                             <span className="text-2xl font-bold">{t.play}</span>
                         </button>
                         {(user.username === game.creator || user.displayName === game.creator) && (
                             <button 
                                onClick={handleDeleteGame}
                                className="bg-red-600/20 hover:bg-red-600/40 text-red-500 px-6 py-4 rounded-xl font-bold border border-red-500/30 transition-all"
                             >
                                Eliminar Mapa
                             </button>
                         )}
                     </div>
                 </div>
            </div>

            {/* SERVER LIST SECTION */}
            <div className="relative max-w-6xl mx-auto mt-12 px-6 pb-20 z-10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <ServerIcon className="text-gray-400" /> {t.settings}
                    </h2>
                    <button 
                        onClick={handleCreateServer}
                        className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                    >
                        <Plus size={16} /> {t.create_server}
                    </button>
                </div>
                
                <div className="bg-[#2b2d31] rounded-lg border border-gray-700 overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 p-4 bg-[#111213] text-gray-400 text-xs font-bold uppercase tracking-wider">
                        <div className="col-span-5">{t.server_name}</div>
                        <div className="col-span-2 text-center">{t.players}</div>
                        <div className="col-span-2 text-center">{t.ping}</div>
                        <div className="col-span-3 text-right">{t.action}</div>
                    </div>
                    {servers.map((server) => (
                        <div key={server.id} className="grid grid-cols-12 gap-4 p-4 border-t border-gray-700 items-center hover:bg-white/5 transition-colors">
                            <div className="col-span-5 font-bold text-white flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${server.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                                <div className="flex flex-col">
                                    <span>{server.name}</span>
                                    <span className="text-[10px] text-blue-400 font-mono uppercase">{server.region}</span>
                                </div>
                            </div>
                            <div className="col-span-2 text-center text-gray-300">
                                {server.players} / {server.maxPlayers}
                            </div>
                            <div className="col-span-2 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${server.ping < 50 ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                                    {server.ping} ms
                                </span>
                            </div>
                            <div className="col-span-3 text-right">
                                <button 
                                    onClick={() => handleJoinServer(server)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                                >
                                    {t.join}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button onClick={onBack} className="fixed top-4 left-4 bg-black/50 px-4 py-2 rounded-full text-sm hover:bg-black/70 z-50 backdrop-blur-md border border-white/10">
                {t.back_home}
            </button>
        </div>
    );
};

export default App;
