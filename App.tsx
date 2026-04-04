import React, { useState, useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { User, Page, AvatarConfig, Game, MapObject, Server } from './types';
import { AvatarScene } from './components/AvatarScene';
import ErrorBoundary from './components/ErrorBoundary';
import { AvatarEditor } from './pages/AvatarEditor';
import { StudioPage } from './pages/Studio';
import { GameCard } from './components/GameCard';
import { Play, ThumbsUp, User as UserIcon, Server as ServerIcon, Plus, Users, Settings as SettingsIcon, Globe, Palette } from 'lucide-react';

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
    users: "Usuarios",
    add: "Agregar",
    online: "En línea",
    no_friends: "Aún no tienes amigos. ¡Busca usuarios arriba para agregarlos!",
    back_home: "← Volver al Inicio",
    language: "Idioma",
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
    users: "Users",
    add: "Add",
    online: "Online",
    no_friends: "You don't have friends yet. Search for users above to add them!",
    back_home: "← Back to Home",
    language: "Language",
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<Page>(Page.HOME);
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState({ language: 'es', backgroundColor: '#1a1b1e' });
  
  const t = TRANSLATIONS[settings.language as 'es' | 'en'];
  
  // Game Play State
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Initial Games
  const [publishedGames, setPublishedGames] = useState<Game[]>([]);

  useEffect(() => {
      // Fetch games from backend
      fetch('/api/games')
          .then(res => res.json())
          .then(data => setPublishedGames(data))
          .catch(err => console.error("Error fetching games:", err));
  }, []);

  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    bodyColors: {
      head: '#F5CD30', torso: '#0047AB', leftArm: '#F5CD30', rightArm: '#F5CD30', leftLeg: '#A2C429', rightLeg: '#A2C429'
    },
    faceTextureUrl: null,
    accessories: { hatModelUrl: null, shirtTextureUrl: null },
    hideFace: false
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('voxelSphereUser');
    if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Re-verify with backend to get latest data
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: parsedUser.username })
        })
        .then(res => res.json())
        .then(userData => {
            setUser(userData);
            setAvatarConfig(userData.avatarConfig);
            setSettings(userData.settings);
            setIsAuthenticated(true);
        })
        .catch(err => {
            console.error("Error auto-logging in:", err);
            localStorage.removeItem('voxelSphereUser');
        });
    }
  }, []);

  const handleUpdateAvatar = async (config: AvatarConfig) => {
    setAvatarConfig(config);
    if (user) {
        try {
            await fetch(`/api/user/${user.username}/avatar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
        } catch (err) {
            console.error("Error updating avatar:", err);
        }
    }
  };

  const handleLogin = async (username: string) => {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const userData = await response.json();
        setUser(userData);
        setAvatarConfig(userData.avatarConfig);
        setSettings(userData.settings);
        localStorage.setItem('voxelSphereUser', JSON.stringify({ username: userData.username }));
        setIsAuthenticated(true);
    } catch (err) {
        console.error("Error logging in:", err);
        alert("Error al iniciar sesión");
    }
  };

  const handleAddFriend = (friendName: string) => {
    if (!user) return;
    const updatedUser = { ...user, friends: [...(user.friends || []), friendName] };
    setUser(updatedUser);
    // Note: Friend persistence could also be moved to backend, but keeping it simple for now
    // as per the user's request to have "its own database" which I'm implementing via the user object
    localStorage.setItem('voxelSphereUser', JSON.stringify({ username: user.username }));
    alert(`${t.add} ${friendName}!`);
  };

  const handleUpdateSettings = async (newSettings: any) => {
    setSettings(newSettings);
    if (user) {
        try {
            await fetch(`/api/user/${user.username}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
        } catch (err) {
            console.error("Error updating settings:", err);
        }
    }
  };

  const handlePublishGame = async (gameData: { title: string, map: MapObject[], skybox: string }) => {
      const newGame: Game = {
          id: Date.now().toString(),
          title: gameData.title,
          creator: user?.displayName || 'Anon',
          thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/768/432', // Random thumb
          likes: '0%',
          playing: 0,
          mapData: gameData.map,
          skybox: gameData.skybox
      };
      
      try {
          const response = await fetch('/api/games', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newGame)
          });
          const savedGame = await response.json();
          setPublishedGames(prev => [savedGame, ...prev]);
      } catch (err) {
          console.error("Error publishing game:", err);
          alert("Error al publicar el juego");
      }
  };

  const openGameDetails = (game: Game) => {
      setSelectedGame(game);
      setCurrentPage(Page.PLAY);
  };

  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />;

  const filteredGames = publishedGames.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.creator.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mockUsers = [
    { username: 'VoxelMaster', displayName: 'Voxel Master', robux: 10000 },
    { username: 'NoobPlayer', displayName: 'Noob Player', robux: 10 },
    { username: 'BuilderPro', displayName: 'Builder Pro', robux: 500 },
    { username: 'GamerGirl', displayName: 'Gamer Girl', robux: 2500 }
  ];

  const filteredUsers = mockUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- STUDIO MODE ---
  if (currentPage === Page.STUDIO) {
      return (
        <div className="h-screen w-screen" style={{ backgroundColor: settings.backgroundColor }}>
           <button onClick={() => setCurrentPage(Page.HOME)} className="fixed top-3 right-3 z-50 bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs rounded shadow-md">{t.stop}</button>
           <StudioPage onPublish={handlePublishGame} avatarConfig={avatarConfig} username={user?.username} playerName={user?.displayName} />
        </div>
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
                                            <div className="w-10 h-10 rounded-full bg-blue-500"></div>
                                            <div>
                                                <div className="text-white font-bold text-sm">{u.displayName}</div>
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
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{t.home}</h1>
                        <p className="text-gray-400 text-lg">{t.welcome}, <span className="text-white font-bold">{user.displayName}</span></p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
                     <div className="lg:col-span-1 bg-[#2b2d31] p-4 rounded-xl border border-[#393b3d] flex flex-col items-center">
                          <div className="w-full aspect-[3/4] rounded-lg overflow-hidden relative">
                              <ErrorBoundary>
                                <AvatarScene config={avatarConfig} interactive={false} />
                              </ErrorBoundary>
                          </div>
                          <button onClick={() => setCurrentPage(Page.AVATAR)} className="mt-4 w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg font-medium text-sm transition-colors text-white">{t.customize}</button>
                     </div>
                     <div className="lg:col-span-3">
                         <h3 className="text-xl font-bold text-white mb-4">{t.experiences} {searchQuery ? '(Filtradas)' : ''}</h3>
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
                                    <AvatarScene config={avatarConfig} interactive={false} />
                                </ErrorBoundary>
                            </div>
                            <div className="flex-1 pt-4">
                                <h2 className="text-3xl font-bold text-white">{user.displayName}</h2>
                                <p className="text-gray-400">@{user.username}</p>
                                <div className="flex gap-4 mt-4">
                                    <div className="text-center">
                                        <div className="text-white font-bold">{(user.friends || []).length}</div>
                                        <div className="text-xs text-gray-500 uppercase">{t.friends}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {currentPage === Page.SOCIAL && (
                <div className="p-8 max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-white mb-6">{t.friends}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(user.friends || []).length > 0 ? (
                            user.friends?.map(f => (
                                <div key={f} className="bg-[#2b2d31] p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-500"></div>
                                    <div className="flex-1">
                                        <div className="text-white font-bold">{f}</div>
                                        <div className="text-xs text-green-500">{t.online}</div>
                                    </div>
                                    <button className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-xs font-bold">Chat</button>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-2 text-center py-20 text-gray-500 bg-[#2b2d31] rounded-xl border border-dashed border-gray-700">
                                <Users size={48} className="mx-auto mb-4 opacity-20" />
                                <p>{t.no_friends}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {currentPage === Page.SETTINGS && (
                <div className="p-8 max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                        <SettingsIcon size={32} /> {t.settings}
                    </h2>
                    
                    <div className="space-y-8 bg-[#2b2d31] p-8 rounded-2xl border border-gray-700 shadow-xl">
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
                            <AvatarScene config={avatarConfig} />
                          </ErrorBoundary>
                        </div>
                        <div className="w-full md:w-[400px] bg-[#232527] rounded-xl border border-[#393b3d] overflow-hidden flex flex-col shadow-xl"><AvatarEditor currentConfig={avatarConfig} onUpdateConfig={handleUpdateAvatar} /></div>
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
    const [activeServer, setActiveServer] = useState<Server | null>(null);
    const [servers, setServers] = useState<Server[]>([
        { id: '1', name: 'Global Server Alpha', players: 12, maxPlayers: 20, ping: 45 },
        { id: '2', name: 'Voxel Hub [Global]', players: 18, maxPlayers: 20, ping: 52 },
        { id: '3', name: 'Friends Only', players: 3, maxPlayers: 10, ping: 38 },
    ]);

    const handleJoinServer = (server: Server) => {
        setActiveServer(server);
        setIsPlaying(true);
    };

    const handleCreateServer = () => {
        const newServer: Server = {
            id: Date.now().toString(),
            name: `${user.username}'s World`,
            players: 1,
            maxPlayers: 10,
            ping: 20
        };
        setServers([...servers, newServer]);
        handleJoinServer(newServer);
    };

    const handleQuickPlay = () => {
        handleJoinServer(servers[0]);
    }

    if (isPlaying) {
        return (
            <div className="h-screen w-screen bg-black">
                <StudioPage 
                    onPublish={() => {}} 
                    avatarConfig={avatarConfig} 
                    initialMapData={game.mapData} 
                    initialGame={game}
                    isPlayMode={true} 
                    activeServer={activeServer}
                    playerName={user.displayName}
                    onExit={() => setIsPlaying(false)}
                />
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
                             <span className="text-lg font-bold text-white">{game.likes}</span>
                             <span className="text-xs text-gray-400">{t.likes}</span>
                         </div>
                     </div>

                     {/* BIG PLAY BUTTON */}
                     <button 
                        onClick={handleQuickPlay}
                        className="bg-blue-600 hover:bg-blue-500 w-full md:w-48 py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg transform transition-transform active:scale-95"
                     >
                         <div className="bg-white/20 p-1 rounded">
                             <Play fill="white" size={32} />
                         </div>
                         <span className="text-2xl font-bold">{t.play}</span>
                     </button>
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
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                {server.name}
                            </div>
                            <div className="col-span-2 text-center text-gray-300">
                                {server.players} / {server.maxPlayers}
                            </div>
                            <div className="col-span-2 text-center text-gray-400 text-xs">
                                {server.ping} ms
                            </div>
                            <div className="col-span-3 text-right">
                                <button 
                                    onClick={() => handleJoinServer(server)}
                                    className="bg-white text-black hover:bg-gray-200 px-6 py-1.5 rounded-lg text-sm font-bold shadow-sm"
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
