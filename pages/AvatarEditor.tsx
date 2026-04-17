import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, ShoppingBag, Save, Plus, Edit2, MousePointer2, Box, Image as ImageIcon, Palette, Type, Pencil } from 'lucide-react';
import { AvatarConfig, StoreItem, User } from '../types';
import { AvatarScene } from '../components/AvatarScene';
import { Socket } from 'socket.io-client';
import { dataService } from '../lib/dataService';

interface AvatarEditorProps {
  currentConfig: AvatarConfig;
  onUpdateConfig: (newConfig: AvatarConfig) => void;
  socket?: Socket | null;
  user?: User | null;
  globalAvatarReplacement?: { url: string; isFbx: boolean } | null;
}

const COLORS = [
  '#F5CD30', '#E8B923', // Yellows
  '#0047AB', '#003380', // Blues
  '#A2C429', '#88AA15', // Greens
  '#C42929', '#801515', // Reds
  '#F2F2F2', '#111111', // White/Black
  '#996633', '#CC8E69', // Skin tones
];

// Mock Store State (In a real app, this would be backend)
const INITIAL_STORE_ITEMS: StoreItem[] = [
  { id: '1', name: 'Gorra Roja', type: 'hat', price: 0, thumbnail: '', assetUrl: '', creator: 'Glidrovia' },
  { id: '2', name: 'Cara Feliz', type: 'face', price: 50, thumbnail: '', assetUrl: '', creator: 'User123' },
];

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ currentConfig, onUpdateConfig, socket, user, globalAvatarReplacement }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'clothing' | 'animations' | 'store' | 'create' | 'paint'>('body');
  const [subTab, setSubTab] = useState<'skin' | 'face' | 'hats'>('skin');
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [storeItems, setStoreItems] = useState<StoreItem[]>(INITIAL_STORE_ITEMS);
  const [selectedPart, setSelectedPart] = useState<keyof AvatarConfig['bodyColors']>('head');
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  if (globalAvatarReplacement) {
    return (
      <div className="flex flex-col h-full bg-[#1a1c1e] text-white p-6 items-center justify-center text-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
          <Upload className="text-blue-400" size={32} />
        </div>
        <h3 className="text-xl font-bold mb-2">Avatar Global Activo</h3>
        <p className="text-gray-400 text-sm mb-6">
          Un administrador ha establecido un avatar global para todos los usuarios. 
          La personalización individual está desactivada temporalmente.
        </p>
        <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-xl text-xs text-blue-400 font-medium">
          Tu avatar actual es el objeto importado por Glidrovia.
        </div>
      </div>
    );
  }
  
  useEffect(() => {
    if (socket) {
      socket.on("item-published", (newItem: StoreItem) => {
        setStoreItems(prev => [newItem, ...prev]);
      });
    }
  }, [socket]);

  const ANIMATIONS = ['Idle', 'Walk', 'Dance', 'Wave', 'Sit'];

  // Creation State
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('0');
  const [newItemFile, setNewItemFile] = useState<File | null>(null);
  const [newItemType, setNewItemType] = useState<'hat' | 'face'>('face');

  // Handlers for Body Colors
  const updateColor = (part: keyof AvatarConfig['bodyColors'], color: string) => {
    onUpdateConfig({
      ...currentConfig,
      bodyColors: {
        ...currentConfig.bodyColors,
        [part]: color
      }
    });
  };

  const updateAnimation = (anim: string) => {
    onUpdateConfig({
      ...currentConfig,
      selectedAnimation: anim
    });
  };

  // Handler for File Uploads (Server-side)
  useEffect(() => {
    if (activeTab === 'paint' && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (currentConfig.faceTextureUrl) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = currentConfig.faceTextureUrl;
                img.onload = () => ctx.drawImage(img, 0, 0, 256, 256);
            }
        }
    }
  }, [activeTab]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    draw(e);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
        const url = canvas.toDataURL('image/png');
        onUpdateConfig({ ...currentConfig, faceTextureUrl: url, hideFace: false });
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    // Scale coordinates if canvas size differs from display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(x * scaleX, y * scaleY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x * scaleX, y * scaleY);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'face' | 'hat' | 'shirt' | 'videoFace' | 'customModel') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await dataService.uploadFile(file);
        
        if (type === 'face') {
          onUpdateConfig({ ...currentConfig, faceTextureUrl: url, faceVideoUrl: null, hideFace: false });
        } else if (type === 'videoFace') {
          onUpdateConfig({ ...currentConfig, faceVideoUrl: url, faceTextureUrl: null, hideFace: false });
        } else if (type === 'hat') {
          const isFbx = file.name.toLowerCase().endsWith('.fbx');
          onUpdateConfig({
            ...currentConfig,
            accessories: { ...currentConfig.accessories, hatModelUrl: isFbx ? url + '#fbx' : url }
          });
        } else if (type === 'customModel') {
           onUpdateConfig({ ...currentConfig, customModelUrl: url });
        }
      } catch (err) {
        console.error("Error uploading file:", err);
        alert("Error al subir el archivo");
      }
    }
  };

  // Publish Logic
  const handlePublish = async () => {
    if (!newItemFile || !newItemName) return;
    
    const formData = new FormData();
    formData.append('file', newItemFile);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      const url = data.url;
      const isFbx = newItemFile.name.toLowerCase().endsWith('.fbx');
      const assetUrl = isFbx ? url + '#fbx' : url;

      const newItem: StoreItem = {
        id: Date.now().toString(),
        name: newItemName,
        type: newItemType,
        price: parseInt(newItemPrice) || 0,
        thumbnail: url, // Use the uploaded file as thumbnail too
        assetUrl: assetUrl,
        creator: user?.displayName || 'Tú'
      };

      if (socket) {
        socket.emit("publish-item", newItem);
        alert(`¡${newItemName} publicado en tiempo real!`);
      } else {
        setStoreItems([...storeItems, newItem]);
        alert(`¡${newItemName} publicado localmente!`);
      }
      setNewItemName('');
      setNewItemFile(null);
      setActiveTab('store');
    } catch (err) {
      console.error("Error publishing item:", err);
      alert("Error al publicar el objeto");
    }
  };

  // Equip from Store
  const handleEquipItem = (item: StoreItem) => {
    if (socket && user) {
      socket.emit("use-clothing", { itemId: item.id, username: user.username });
    }

    if (item.type === 'face') {
       onUpdateConfig({ ...currentConfig, faceTextureUrl: item.assetUrl, hideFace: false });
    } else if (item.type === 'hat') {
       onUpdateConfig({ 
          ...currentConfig, 
          accessories: { ...currentConfig.accessories, hatModelUrl: item.assetUrl }
       });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1c1e] text-white">
      {/* Top Bar for Editor */}
      <div className="flex border-b border-[#393b3d]">
        <button 
           onClick={() => setActiveTab('body')}
           className={`flex-1 py-4 font-bold text-sm ${activeTab === 'body' ? 'border-b-2 border-white text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Cuerpo y Cara
        </button>
        <button 
           onClick={() => setActiveTab('clothing')}
           className={`flex-1 py-4 font-bold text-sm ${activeTab === 'clothing' ? 'border-b-2 border-white text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Ropa y Accesorios
        </button>
        <button 
           onClick={() => setActiveTab('animations')}
           className={`flex-1 py-4 font-bold text-sm ${activeTab === 'animations' ? 'border-b-2 border-white text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Animaciones
        </button>
        <button 
           onClick={() => setActiveTab('paint')}
           className={`flex-1 py-4 font-bold text-sm ${activeTab === 'paint' ? 'border-b-2 border-white text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <Edit2 size={16} className="inline mr-1" /> Pintar Cara
        </button>
        <button 
           onClick={() => setActiveTab('create')}
           className={`flex-1 py-4 font-bold text-sm ${activeTab === 'create' ? 'border-b-2 border-white text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Crear y Publicar
        </button>
        <button 
           onClick={() => setActiveTab('store')}
           className={`flex-1 py-4 font-bold text-sm ${activeTab === 'store' ? 'border-b-2 border-white text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Tienda
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        
        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div className="space-y-6">
            <div className="bg-[#111214] p-4 rounded-xl border border-white/5 relative aspect-square max-w-[300px] mx-auto overflow-hidden group">
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                    <button 
                        onClick={() => setViewMode('2D')} 
                        className={`p-2 rounded-lg text-xs font-bold transition-all ${viewMode === '2D' ? 'bg-blue-600 text-white' : 'bg-black/60 text-gray-400'}`}
                    >2D</button>
                    <button 
                        onClick={() => setViewMode('3D')} 
                        className={`p-2 rounded-lg text-xs font-bold transition-all ${viewMode === '3D' ? 'bg-blue-600 text-white' : 'bg-black/60 text-gray-400'}`}
                    >3D</button>
                </div>

                {viewMode === '3D' ? (
                    <div className="w-full h-full">
                        <AvatarScene config={currentConfig} />
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                        <svg viewBox="0 0 100 200" className="h-full w-auto drop-shadow-2xl">
                            {/* Head */}
                            <rect 
                                x="35" y="10" width="30" height="30" rx="5" 
                                fill={currentConfig.bodyColors.head} 
                                className={`cursor-pointer transition-all hover:stroke-white hover:stroke-1 ${selectedPart === 'head' ? 'stroke-blue-500 stroke-2' : ''}`}
                                onClick={() => setSelectedPart('head')}
                            />
                            {/* Torso */}
                            <rect 
                                x="30" y="45" width="40" height="60" rx="4"
                                fill={currentConfig.bodyColors.torso}
                                className={`cursor-pointer transition-all hover:stroke-white hover:stroke-1 ${selectedPart === 'torso' ? 'stroke-blue-500 stroke-2' : ''}`}
                                onClick={() => setSelectedPart('torso')}
                            />
                            {/* Left Arm */}
                            <rect 
                                x="10" y="45" width="15" height="50" rx="4"
                                fill={currentConfig.bodyColors.leftArm}
                                className={`cursor-pointer transition-all hover:stroke-white hover:stroke-1 ${selectedPart === 'leftArm' ? 'stroke-blue-500 stroke-2' : ''}`}
                                onClick={() => setSelectedPart('leftArm')}
                            />
                            {/* Right Arm */}
                            <rect 
                                x="75" y="45" width="15" height="50" rx="4"
                                fill={currentConfig.bodyColors.rightArm}
                                className={`cursor-pointer transition-all hover:stroke-white hover:stroke-1 ${selectedPart === 'rightArm' ? 'stroke-blue-500 stroke-2' : ''}`}
                                onClick={() => setSelectedPart('rightArm')}
                            />
                            {/* Left Leg */}
                            <rect 
                                x="30" y="110" width="18" height="65" rx="4"
                                fill={currentConfig.bodyColors.leftLeg}
                                className={`cursor-pointer transition-all hover:stroke-white hover:stroke-1 ${selectedPart === 'leftLeg' ? 'stroke-blue-500 stroke-2' : ''}`}
                                onClick={() => setSelectedPart('leftLeg')}
                            />
                            {/* Right Leg */}
                            <rect 
                                x="52" y="110" width="18" height="65" rx="4"
                                fill={currentConfig.bodyColors.rightLeg}
                                className={`cursor-pointer transition-all hover:stroke-white hover:stroke-1 ${selectedPart === 'rightLeg' ? 'stroke-blue-500 stroke-2' : ''}`}
                                onClick={() => setSelectedPart('rightLeg')}
                            />
                        </svg>
                    </div>
                )}
            </div>

            <div className="bg-blue-600/5 p-4 rounded-xl border border-blue-500/20">
               <h3 className="font-bold mb-3 text-blue-400 uppercase text-[10px] tracking-widest flex items-center gap-2">
                 <Palette size={14} /> Color de {selectedPart === 'head' ? 'Cabeza' : selectedPart === 'torso' ? 'Torso' : 'Extremidad'}
               </h3>
               <div className="grid grid-cols-6 gap-2">
                  {COLORS.map(color => (
                    <button 
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${currentConfig.bodyColors[selectedPart] === color ? 'border-white scale-110 shadow-lg' : 'border-white/10'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => updateColor(selectedPart, color)}
                    />
                  ))}
               </div>
            </div>

            <div className="h-px bg-white/5 my-4" />

            <div>
               <h3 className="font-bold mb-2 text-gray-300 uppercase text-xs">Cara</h3>
               <div className="flex flex-col gap-3">
                 <label className="flex items-center gap-3 p-3 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 transition">
                    <Upload size={20} className="text-blue-400" />
                    <span className="text-sm">Subir Foto/GIF de Cara</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'face')} />
                 </label>

                 <label className="flex items-center gap-3 p-3 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 transition">
                    <Upload size={20} className="text-orange-400" />
                    <span className="text-sm">Subir Video de Cara</span>
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'videoFace')} />
                 </label>
                 
                 <button 
                   onClick={() => onUpdateConfig({...currentConfig, hideFace: !currentConfig.hideFace})}
                   className={`p-2 rounded text-sm font-bold ${currentConfig.hideFace ? 'bg-red-500' : 'bg-gray-700'}`}
                 >
                   {currentConfig.hideFace ? 'Mostrar Ojos/Boca' : 'Ocultar Ojos/Boca (Sin cara)'}
                 </button>

                 <button 
                   onClick={() => onUpdateConfig({...currentConfig, invisible: !currentConfig.invisible})}
                   className={`p-2 rounded text-sm font-bold ${currentConfig.invisible ? 'bg-blue-500' : 'bg-gray-700'}`}
                 >
                   {currentConfig.invisible ? 'Avatar Invisible: ON' : 'Avatar Invisible: OFF'}
                 </button>

                 <button 
                   onClick={() => onUpdateConfig({...currentConfig, faceTextureUrl: null, faceVideoUrl: null, hideFace: false})}
                   className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center justify-center gap-2"
                 >
                   <Trash2 size={14} /> Restaurar Cara Original
                 </button>
               </div>
            </div>
          </div>
        )}

        {/* PAINT TAB */}
        {activeTab === 'paint' && (
            <div className="space-y-6">
                <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden relative">
                    <canvas 
                        ref={canvasRef}
                        width={256}
                        height={256}
                        className="w-full aspect-square cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                    <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[9px] uppercase font-bold tracking-widest text-blue-400">
                      Lienzo de Cara (256x256)
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                             <Pencil size={14} className="text-blue-400" /> Color del Lápiz
                        </span>
                        <div className="flex gap-1">
                            {['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00'].map(c => (
                                <button 
                                    key={c}
                                    onClick={() => setBrushColor(c)}
                                    className={`w-6 h-6 rounded-full border ${brushColor === c ? 'border-white scale-110' : 'border-white/10'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            <input 
                                type="color" 
                                value={brushColor} 
                                onChange={(e) => setBrushColor(e.target.value)}
                                className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs text-gray-500 font-bold">
                            <span>GROSOR</span>
                            <span>{brushSize}px</span>
                        </div>
                        <input 
                            type="range" min="1" max="25" 
                            value={brushSize} 
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    <button 
                        onClick={() => {
                            const ctx = canvasRef.current?.getContext('2d');
                            if (ctx) {
                                ctx.fillStyle = '#ffffff';
                                ctx.fillRect(0, 0, 256, 256);
                                stopDrawing();
                            }
                        }}
                        className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded-xl text-xs font-bold transition-all border border-red-500/10"
                    >
                        LIMPIAR LIENZO
                    </button>
                </div>
            </div>
        )}

        {/* CLOTHING/ACCESSORIES TAB */}
        {activeTab === 'clothing' && (
          <div className="space-y-6">
             <div>
                <h3 className="font-bold mb-2 text-gray-300 uppercase text-xs">Sombreros / Accesorios 3D</h3>
                <label className="flex items-center gap-3 p-3 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 transition">
                    <Upload size={20} />
                    <span className="text-sm">Importar Objeto 3D (.glb / .gltf / .fbx)</span>
                    <input type="file" accept=".glb,.gltf,.fbx" className="hidden" onChange={(e) => handleFileUpload(e, 'hat')} />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                   El modelo se adjuntará a la cabeza. Asegúrate de que la escala sea correcta.
                </p>
                
                {currentConfig.accessories.hatModelUrl && (
                  <button 
                   onClick={() => onUpdateConfig({...currentConfig, accessories: { ...currentConfig.accessories, hatModelUrl: null }})}
                   className="mt-3 w-full p-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded text-sm flex items-center justify-center gap-2"
                 >
                   <Trash2 size={14} /> Quitar Accesorio
                 </button>
                )}
             </div>
          </div>
        )}

        {/* ANIMATIONS TAB */}
        {activeTab === 'animations' && (
          <div className="space-y-4">
            <h3 className="font-bold mb-2 text-gray-300 uppercase text-xs">Seleccionar Animación</h3>
            <div className="grid grid-cols-1 gap-2">
              {ANIMATIONS.map(anim => (
                <button 
                  key={anim}
                  onClick={() => updateAnimation(anim)}
                  className={`w-full p-4 rounded-lg font-bold text-left transition-all ${currentConfig.selectedAnimation === anim ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {anim}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CREATE / PUBLISH TAB */}
        {activeTab === 'create' && (
          <div className="bg-gray-800 p-4 rounded-lg space-y-6">
            <div className="border-b border-white/5 pb-6">
                <h3 className="font-bold mb-4 text-blue-400 text-sm flex items-center gap-2">
                    <Box size={18} /> Avatar Personalizado (Replacement)
                </h3>
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-700 bg-gray-900/50 rounded-2xl cursor-pointer hover:border-blue-500 transition group">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload size={24} className="text-blue-400" />
                    </div>
                    <div className="text-center">
                        <span className="text-sm font-bold block">Importar Avatar con Animaciones</span>
                        <span className="text-[10px] text-gray-500 mt-1 uppercase">Soporta .GLB o .FBX</span>
                    </div>
                    <input type="file" accept=".glb,.gltf,.fbx" className="hidden" onChange={(e) => handleFileUpload(e, 'customModel')} />
                </label>
                {currentConfig.customModelUrl && (
                    <div className="mt-4 flex items-center justify-between bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Box size={16} className="text-blue-400 shrink-0" />
                            <span className="text-xs font-mono truncate text-blue-300">{currentConfig.customModelUrl}</span>
                        </div>
                        <button 
                            onClick={() => onUpdateConfig({...currentConfig, customModelUrl: null})}
                            className="p-1 hover:text-red-400 transition"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="pt-2">
                <h3 className="font-bold mb-4 text-white">Publicar en el Mercado</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nombre del objeto</label>
                <input 
                  type="text" 
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                  placeholder="Ej: Máscara Cyberpunk"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Tipo</label>
                <div className="flex gap-2">
                   <button 
                     onClick={() => setNewItemType('face')}
                     className={`flex-1 py-2 text-sm rounded ${newItemType === 'face' ? 'bg-[#00a2ff]' : 'bg-gray-700'}`}
                   >Cara</button>
                   <button 
                     onClick={() => setNewItemType('hat')}
                     className={`flex-1 py-2 text-sm rounded ${newItemType === 'hat' ? 'bg-[#00a2ff]' : 'bg-gray-700'}`}
                   >Objeto 3D</button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Precio (Voxels)</label>
                <input 
                  type="number" 
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Archivo ({newItemType === 'face' ? 'Imagen' : '.GLB / .FBX'})</label>
                <input 
                  type="file" 
                  accept={newItemType === 'face' ? "image/*" : ".glb,.gltf,.fbx"}
                  onChange={(e) => setNewItemFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#00a2ff] file:text-white hover:file:bg-[#008bd9]"
                />
              </div>

              <button 
                onClick={handlePublish}
                disabled={!newItemFile || !newItemName}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4"
              >
                <Save size={18} /> Publicar Objeto
              </button>
            </div>
            </div>
          </div>
        )}

        {/* STORE TAB */}
        {activeTab === 'store' && (
          <div>
            <h3 className="font-bold mb-4 text-gray-300 uppercase text-xs">Tienda de la Comunidad</h3>
            <div className="grid grid-cols-2 gap-3">
               {storeItems.map(item => (
                 <div key={item.id} className="bg-gray-800 p-2 rounded hover:bg-gray-700 transition cursor-pointer" onClick={() => handleEquipItem(item)}>
                    <div className="aspect-square bg-gray-900 rounded mb-2 flex items-center justify-center overflow-hidden relative">
                       {item.type === 'face' ? (
                          <img src={item.assetUrl || item.thumbnail || undefined} className="w-full h-full object-cover" />
                       ) : (
                          <div className="text-gray-500 text-xs">Vista Previa 3D</div>
                       )}
                       <div className="absolute top-1 right-1 bg-black/60 px-1 rounded text-[10px]">
                         {item.type === 'face' ? 'Cara' : '3D'}
                       </div>
                    </div>
                    <div className="font-bold text-sm truncate">{item.name}</div>
                    <div className="flex justify-between items-center mt-1">
                       <span className="text-xs text-gray-400">{item.creator}</span>
                       <span className="text-xs font-bold text-green-400">{item.price === 0 ? 'GRATIS' : `V$ ${item.price}`}</span>
                    </div>
                    <button className="w-full mt-2 bg-white/10 hover:bg-white/20 text-xs font-bold py-1 rounded">
                       Usar
                    </button>
                 </div>
               ))}
               
               {storeItems.length === 0 && (
                 <p className="text-gray-500 text-sm col-span-2">No hay objetos. ¡Crea uno en la pestaña Crear!</p>
               )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};