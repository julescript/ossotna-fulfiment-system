import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import VersionDisplay from './VersionDisplay';

const navItems = [
  { label: 'Orders', href: '/orders', icon: 'shopping_cart' },
  { label: 'Fulfilled', href: '/fulfilled', icon: 'check_circle' },
];

const actionItems = [
  { label: 'Scan Order', icon: 'qr_code_scanner', event: 'sidebar:scan-order', color: 'text-blue-400' },
  { label: 'Upload Images', icon: 'add_photo_alternate', event: 'sidebar:upload-images', color: 'text-green-400' },
];

const TOPBAR_HEIGHT = 'h-14';
const TOPBAR_HEIGHT_CLASS = 'top-14'; // must match

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapsed }) => {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [router.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('pinSessionToken');
    localStorage.removeItem('pinSessionExpiresAt');
    localStorage.removeItem('isAuthenticated');
    router.push('/');
  };

  const isActive = (href: string) => router.pathname === href;

  const fireAction = (eventName: string) => {
    window.dispatchEvent(new CustomEvent(eventName));
    setMobileOpen(false);
  };

  return (
    <>
      {/* Full-width top navbar */}
      <header className={`fixed top-0 left-0 right-0 z-50 ${TOPBAR_HEIGHT} bg-gray-800 border-b border-gray-700 flex items-center px-4`}>
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white p-1">
            <span className="material-symbols-outlined text-[24px]">{mobileOpen ? 'close' : 'menu'}</span>
          </button>
          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapsed}
            className="hidden md:flex text-gray-400 hover:text-white p-1 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-[22px]">{collapsed ? 'menu' : 'menu_open'}</span>
          </button>
          <img src="/ossotna-FC-logo.svg" alt="Ossotna" className="h-9" />
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - below top navbar */}
      <aside className={`
        fixed ${TOPBAR_HEIGHT_CLASS} left-0 bottom-0 z-40 bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-200
        ${collapsed ? 'md:w-16' : 'md:w-52'}
        ${mobileOpen ? 'w-52 translate-x-0' : 'w-52 -translate-x-full'} md:translate-x-0
      `}>
        {/* Nav items */}
        <nav className="py-2">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => { router.push(item.href); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors
                ${isActive(item.href)
                  ? 'bg-gray-700 text-white border-l-2 border-yellow-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }
                ${collapsed ? 'md:justify-center md:px-0' : ''}
              `}
              title={collapsed ? item.label : undefined}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className={collapsed ? 'md:hidden' : ''}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className={`border-t border-gray-700 py-2 ${collapsed ? '' : ''}`}>
          {!collapsed && <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest md:block hidden">Actions</div>}
          {actionItems.map((item) => (
            <button
              key={item.event}
              onClick={() => fireAction(item.event)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors
                ${collapsed ? 'md:justify-center md:px-0' : ''}
              `}
              title={collapsed ? item.label : undefined}
            >
              <span className={`material-symbols-outlined text-[20px] ${item.color}`}>{item.icon}</span>
              <span className={collapsed ? 'md:hidden' : ''}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom: version + logout */}
        <div className={`border-t border-gray-700 ${collapsed ? 'p-2' : 'p-3'} flex flex-col gap-2`}>
          <div className={collapsed ? 'md:hidden' : ''}><VersionDisplay /></div>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-md transition-colors
              ${collapsed ? 'md:justify-center md:p-2' : 'px-3 py-2'}
            `}
            title="Logout"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className={collapsed ? 'md:hidden' : ''}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
