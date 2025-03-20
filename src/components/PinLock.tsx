import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

interface PinLockProps {
  onPinVerified?: () => void;
  redirectPath?: string;
}

const PinLock: React.FC<PinLockProps> = ({ onPinVerified, redirectPath = '/orders' }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePinChange = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  // Memoize verifyPin to avoid dependency issues
  const verifyPin = useCallback(async () => {
    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store the token in localStorage
        localStorage.setItem('pinSessionToken', data.token);
        localStorage.setItem('pinSessionExpiresAt', data.expiresAt);
        localStorage.setItem('isAuthenticated', 'true');
        
        if (onPinVerified) {
          onPinVerified();
        }
        
        if (redirectPath) {
          router.push(redirectPath);
        }
      } else {
        setError(data.error || 'Failed to verify PIN');
        setPin('');
      }
    } catch (error) {
      setError('Failed to verify PIN');
      console.error('PIN verification error:', error);
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [pin, onPinVerified, router, redirectPath]);

  // Auto verify when PIN is complete
  useEffect(() => {
    if (pin.length === 6) {
      verifyPin();
    }
  }, [pin, verifyPin]);

  // Check if session is still valid on component mount
  useEffect(() => {
    const checkSession = () => {
      const token = localStorage.getItem('pinSessionToken');
      const expiresAt = localStorage.getItem('pinSessionExpiresAt');
      const isAuthenticated = localStorage.getItem('isAuthenticated');

      if (token && expiresAt && isAuthenticated === 'true') {
        const now = new Date().toISOString();
        if (now < expiresAt) {
          if (onPinVerified) {
            onPinVerified();
          }
          if (redirectPath && router.pathname !== redirectPath) {
            router.push(redirectPath);
          }
        } else {
          // Session expired, clear token
          localStorage.removeItem('pinSessionToken');
          localStorage.removeItem('pinSessionExpiresAt');
          localStorage.removeItem('isAuthenticated');
        }
      }
    };

    checkSession();
  }, [onPinVerified, redirectPath, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-blue-900 to-black">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96 max-w-[90%]">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-6">Secure Access</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2 mb-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-10 h-10 border-2 rounded flex items-center justify-center text-xl font-bold ${
                i < pin.length ? 'border-blue-600 bg-blue-100 text-blue-700' : 'border-gray-300 bg-gray-100 text-gray-400'
              }`}
            >
              {i < pin.length ? '•' : ''}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
            <button
              key={number}
              onClick={() => handlePinChange(number.toString())}
              disabled={loading}
              className="w-14 h-14 rounded-full bg-blue-600 text-white text-2xl font-bold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors disabled:opacity-50"
            >
              {number}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="w-14 h-14 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </button>
          <button
            onClick={() => handlePinChange('0')}
            disabled={loading}
            className="w-14 h-14 rounded-full bg-blue-600 text-white text-2xl font-bold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="w-14 h-14 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="mt-4 text-center text-gray-600 flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Verifying PIN...
          </div>
        )}
      </div>
    </div>
  );
};

export default PinLock;
