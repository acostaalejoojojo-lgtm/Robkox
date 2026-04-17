import React from 'react';
import { Home, Gamepad2, User as UserIcon, MessageSquare, Users, Shirt, MonitorPlay, Hammer, Settings as SettingsIcon } from 'lucide-react';
import { Page } from '../types';

interface SidebarProps {
  isOpen: boolean;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  userName: string;
  t: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentPage, onNavigate, userName, t }) => {
  const sidebarClass = isOpen ? "w-64" : "w-0 md:w-16";
  
  const navItems = [
    { id: Page.HOME, icon: Home, label: t.home },
    { id: Page.PROFILE, icon: UserIcon, label: t.profile },
    { id: Page.GAMES, icon: MonitorPlay, label: t.experiences },
    { id: Page.AVATAR, icon: Shirt, label: t.avatar },
    { id: Page.STUDIO, icon: Hammer, label: t.create },
    { id: Page.SOCIAL, icon: Users, label: t.friends },
    { id: Page.SETTINGS, icon: SettingsIcon, label: t.settings },
  ];

  return (
    <aside className={`${sidebarClass} fixed left-0 top-[50px] bottom-0 z-40 flex flex-col bg-[#232527] transition-all duration-300 overflow-hidden border-r border-[#393b3d]`}>
      <div className="flex flex-col py-2">
        
        <div className={`px-4 py-4 flex items-center gap-3 mb-2 ${!isOpen && 'md:justify-center'}`}>
           <div className="w-8 h-8 min-w-[32px] rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 border border-gray-600"></div>
           <span className={`font-bold text-base truncate text-white ${!isOpen && 'hidden'}`}>{userName}</span>
        </div>

        <div className="h-px bg-[#393b3d] w-11/12 mx-auto mb-2"></div>

        <ul className="flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <li key={item.label}>
              <button
                onClick={() => {
                   if (item.id === Page.HOME || item.id === Page.PROFILE || item.id === Page.AVATAR || item.id === Page.STUDIO || item.id === Page.SOCIAL || item.id === Page.SETTINGS || item.id === Page.GAMES) {
                       onNavigate(item.id as Page);
                   }
                }}
                className={`flex items-center gap-3 w-full p-2 rounded-md transition-colors ${
                  currentPage === item.id 
                    ? "bg-white/10 text-white" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                } ${!isOpen && 'md:justify-center'}`}
              >
                <item.icon size={22} />
                <span className={`font-medium text-sm ${!isOpen && 'hidden'}`}>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="mt-auto p-4">
        {isOpen && (
             <div className="text-xs text-gray-500">
               <p>© 2024 Glidrovia Corp.</p>
               <p className="mt-1">Términos • Privacidad</p>
             </div>
        )}
      </div>
    </aside>
  );
};