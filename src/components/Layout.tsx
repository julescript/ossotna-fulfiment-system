import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900">
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed(c => !c)} />
      <div className={`mt-14 transition-all duration-200 ${collapsed ? 'md:ml-16' : 'md:ml-52'} min-h-[calc(100vh-3.5rem)]`}>
        {children}
      </div>
    </div>
  );
};

export default Layout;
