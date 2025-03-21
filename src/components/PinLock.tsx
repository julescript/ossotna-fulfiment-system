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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="bg-gray-900 p-8 rounded-xl shadow-2xl w-[400px] max-w-[90%]">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center border-2 border-gray-700 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        {/* <h2 className="text-2xl font-bold text-center mb-8 text-gray-200">Secure Access</h2> */}
        <img src="/ossotna-FC-logo.svg" alt="Ossotna Logo" className="h-10 mb-8 mr-auto ml-auto" />
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 text-red-200 rounded-lg text-center border border-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-3 mb-8">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-2xl font-bold ${
                i < pin.length ? 'border-gray-500 bg-gray-700 text-gray-200' : 'border-gray-700 bg-gray-800 text-gray-600'
              }`}
              aria-label={i < pin.length ? 'PIN digit entered' : 'PIN digit empty'}
            >
              {i < pin.length ? '•' : ''}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
            <button
              key={number}
              onClick={() => handlePinChange(number.toString())}
              disabled={loading}
              className="w-full h-16 rounded-lg bg-gray-800 text-gray-200 text-2xl font-semibold hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 transition-colors disabled:opacity-50 border border-gray-700 shadow-md"
              aria-label={`Number ${number}`}
            >
              {number}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="w-full h-16 rounded-lg bg-gray-700 text-gray-300 flex items-center justify-center hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 border border-gray-600 shadow-md"
            aria-label="Delete last digit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </button>
          <button
            onClick={() => handlePinChange('0')}
            disabled={loading}
            className="w-full h-16 rounded-lg bg-gray-800 text-gray-200 text-2xl font-semibold hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 transition-colors disabled:opacity-50 border border-gray-700 shadow-md"
            aria-label="Number 0"
          >
            0
          </button>
          <button
            onClick={verifyPin}
            disabled={loading || pin.length !== 6}
            className="w-full h-16 rounded-lg bg-gray-700 text-gray-300 flex items-center justify-center hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 border border-gray-600 shadow-md"
            aria-label="Submit PIN"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="mt-6 text-center text-gray-400 flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg">Verifying PIN...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PinLock;
