import React from 'react';
import { useRouter } from 'next/router';

const LogoutButton: React.FC = () => {
  const router = useRouter();

  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem('pinSessionToken');
    localStorage.removeItem('pinSessionExpiresAt');
    localStorage.removeItem('isAuthenticated');
    
    // Redirect to home page
    router.push('/');
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm10 8a1 1 0 01-1 1H7.5a1 1 0 110-2H12a1 1 0 011 1zm-4-3a1 1 0 110-2h1.5a1 1 0 110 2H9zm4 6a1 1 0 100-2H7.5a1 1 0 100 2H13z" clipRule="evenodd" />
      </svg>
      Logout
    </button>
  );
};

export default LogoutButton;
