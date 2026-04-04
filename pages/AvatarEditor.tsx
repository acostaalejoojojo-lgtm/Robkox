import React, { useState } from 'react';
import { Upload, Trash2, ShoppingBag, Save, Plus } from 'lucide-react';
import { AvatarConfig, StoreItem } from '../types';
import { AvatarScene } from '../components/AvatarScene';

interface AvatarEditorProps {
  currentConfig: AvatarConfig;
  onUpdateConfig: (newConfig: AvatarConfig) => void;
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
  { id: '1', name: 'Gorra Roja', type: 'hat', price: 0, thumbnail: '', assetUrl: '', creator: 'VoxelSphere' },
  { id: '2', name: 'Cara Feliz', type: 'face', price: 50, thumbnail: '', assetUrl: '', creator: 'User123' },
];

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ currentConfig, onUpdateConfig }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'clothing' | 'store' | 'create'>('body');
  const [subTab, setSubTab] = useState<'skin' | 'face' | 'hats'>('skin');
  const [storeItems, setStoreItems] = useState<StoreItem[]>(INITIAL_STORE_ITEMS);
  
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

  // Handler for File Uploads (Preview)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'face' | 'hat' | 'shirt' | 'videoFace') => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
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
      }
    }
  };

  // Publish Logic
  const handlePublish = () => {
    if (!newItemFile || !newItemName) return;
    
    const url = URL.createObjectURL(newItemFile);
    const isFbx = newItemFile.name.toLowerCase().endsWith('.fbx');
    const assetUrl = isFbx ? url + '#fbx' : url;

    const newItem: StoreItem = {
      id: Date.now().toString(),
      name: newItemName,
      type: newItemType,
      price: parseInt(newItemPrice) || 0,
      thumbnail: 'https://via.placeholder.com/150', // Simplified
      assetUrl: assetUrl,
      creator: 'Tú'
    };

    setStoreItems([...storeItems, newItem]);
    alert(`¡${newItemName} publicado en la tienda por ${newItemPrice} Robux!`);
    setNewItemName('');
    setNewItemFile(null);
    setActiveTab('store');
  };

  // Equip from Store
  const handleEquipItem = (item: StoreItem) => {
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
            <div>
               <h3 className="font-bold mb-2 text-gray-300 uppercase text-xs">Piel</h3>
               <div className="grid grid-cols-6 gap-2">
                  {COLORS.map(color => (
                    <button 
                      key={color}
                      className="w-8 h-8 rounded-full border border-gray-600 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        // Apply to all for simplicity, or add selector for specific parts
                        updateColor('head', color);
                        updateColor('leftArm', color);
                        updateColor('rightArm', color);
                        updateColor('torso', color);
                        updateColor('leftLeg', color);
                        updateColor('rightLeg', color);
                      }}
                    />
                  ))}
               </div>
            </div>

            <div className="h-px bg-gray-700 my-4" />

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
                   onClick={() => onUpdateConfig({...currentConfig, faceTextureUrl: null, faceVideoUrl: null, hideFace: false})}
                   className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center justify-center gap-2"
                 >
                   <Trash2 size={14} /> Restaurar Cara Original
                 </button>
               </div>
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

        {/* CREATE / PUBLISH TAB */}
        {activeTab === 'create' && (
          <div className="bg-gray-800 p-4 rounded-lg">
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
                <label className="text-xs text-gray-400 block mb-1">Precio (Robux)</label>
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
                       <span className="text-xs font-bold text-green-400">{item.price === 0 ? 'GRATIS' : `R$ ${item.price}`}</span>
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