import React, { useState } from 'react';

interface LoginProps {
  onLogin: (username: string) => void;
}

export const LoginPage: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F2F4F5] font-sans">
      {/* Top Bar Login */}
      <header className="w-full bg-white border-b border-gray-200 p-2 flex justify-between items-center shadow-sm">
        <div className="flex items-center ml-4">
            <div className="w-8 h-8 bg-black/80 rounded-lg transform rotate-12 border-4 border-white outline outline-1 outline-black/50 flex items-center justify-center mr-2">
                 <div className="w-2 h-2 bg-white"></div>
            </div>
            <h1 className="text-3xl font-bold text-[#393b3d] tracking-tighter">VoxelSphere</h1>
            <p className="text-sm text-gray-500 font-medium">Hazte lo que quieras</p>
        </div>
        
        {/* Desktop Quick Login (Simulated) */}
        <div className="hidden md:flex items-center gap-2 mr-4">
            <div className="flex flex-col">
                <input 
                   type="text" 
                   placeholder="Usuario / Correo..."
                   className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 mb-1 w-40"
                   value={username}
                   onChange={(e) => setUsername(e.target.value)}
                />
            </div>
             <div className="flex flex-col">
                <input 
                   type="password" 
                   placeholder="Contraseña"
                   className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 mb-1 w-40"
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <button 
                onClick={() => onLogin(username || 'Invitado')}
                className="bg-white border border-gray-300 text-gray-700 font-bold py-1 px-4 rounded text-sm hover:bg-gray-50 h-[30px] self-start"
            >
                Iniciar sesión
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row max-w-[1200px] w-full mx-auto p-4 md:p-10 gap-8">
         
         {/* Left Side: Promo Content */}
         <div className="flex-1 flex flex-col justify-center items-center md:items-start text-center md:text-left">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#393b3d] mb-6">
                En VoxelSphere puedes hacerte lo que quieras
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-lg">
                Únete a millones de personas y descubre una variedad infinita de experiencias inmersivas creadas por una comunidad global.
            </p>
            
            {/* Simulated App Store Badges */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-md opacity-60 grayscale hover:grayscale-0 transition-all">
                <div className="bg-black text-white p-2 rounded flex items-center justify-center gap-2 cursor-pointer">
                    <span className="text-xl font-bold">App Store</span>
                </div>
                <div className="bg-black text-white p-2 rounded flex items-center justify-center gap-2 cursor-pointer">
                   <span className="text-xl font-bold">Google Play</span>
                </div>
            </div>
         </div>

         {/* Right Side: Sign Up Card */}
         <div className="w-full md:w-[400px] bg-white rounded-lg shadow-lg border border-gray-200 p-6">
             <h3 className="text-2xl font-bold text-[#393b3d] mb-6">Regístrate y comienza a divertirte</h3>
             
             <form onSubmit={handleLogin} className="flex flex-col gap-4">
                 <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fecha de nacimiento</label>
                     <div className="flex gap-2">
                         <select className="flex-1 border border-gray-300 rounded p-2 text-gray-600 bg-gray-50">
                             <option>Mes</option>
                             <option>Enero</option>
                             <option>Febrero</option>
                             <option>Marzo</option>
                         </select>
                         <select className="flex-1 border border-gray-300 rounded p-2 text-gray-600 bg-gray-50">
                             <option>Día</option>
                             {[...Array(31)].map((_, i) => <option key={i}>{i+1}</option>)}
                         </select>
                         <select className="flex-1 border border-gray-300 rounded p-2 text-gray-600 bg-gray-50">
                             <option>Año</option>
                             <option>2010</option>
                             <option>2011</option>
                             <option>2012</option>
                         </select>
                     </div>
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Usuario</label>
                     <input 
                        type="text" 
                        placeholder="No uses tu nombre real"
                        className="w-full border border-gray-300 rounded p-2 bg-gray-50 focus:border-black transition-colors"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                     />
                     <p className="text-xs text-gray-400 mt-1">Solo contiene letras, números y _</p>
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Contraseña</label>
                     <input 
                        type="password" 
                        placeholder="Mínimo 8 caracteres"
                        className="w-full border border-gray-300 rounded p-2 bg-gray-50 focus:border-black transition-colors"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                     />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Género (Opcional)</label>
                    <div className="flex gap-4 mt-2">
                        <button type="button" className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-100 flex justify-center items-center">
                            ♀
                        </button>
                        <button type="button" className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-100 flex justify-center items-center">
                            ♂
                        </button>
                    </div>
                 </div>

                 <p className="text-xs text-gray-500 mt-2">
                     Al hacer clic en Regístrate, aceptas los <span className="text-green-600 cursor-pointer">Términos de uso</span> y la <span className="text-green-600 cursor-pointer">Política de privacidad</span>.
                 </p>

                 <button 
                    type="submit"
                    className="w-full bg-[#00a2ff] hover:bg-[#0091e6] text-white font-bold py-3 rounded-lg text-lg transition-colors shadow-md"
                 >
                     Regístrate
                 </button>
             </form>
         </div>

      </div>

      <footer className="w-full text-center p-4 text-xs text-gray-400 border-t border-gray-200 flex flex-col items-center gap-2">
         <p>© 2024 VoxelSphere Clone Corp.</p>
         <button 
            onClick={async () => {
                try {
                    const response = await fetch('/index.html');
                    const text = await response.text();
                    const blob = new Blob([text], { type: 'text/html' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'index.html';
                    a.click();
                    window.URL.revokeObjectURL(url);
                } catch (err) {
                    console.error("Error downloading index.html:", err);
                    alert("Error al descargar el archivo.");
                }
            }}
            className="text-blue-500 hover:underline font-bold"
         >
            Descargar index.html (Código Fuente)
         </button>
      </footer>
    </div>
  );
};