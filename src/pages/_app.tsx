import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import PinLock from '@/components/PinLock';
import Layout from '@/components/Layout';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Public routes that don't require authentication
  const publicRoutes = ['/_error', '/_document', '/_app', '/api'];
  
  useEffect(() => {
    // Check if the user is authenticated
    const checkAuth = () => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('pinSessionToken');
        const expiresAt = localStorage.getItem('pinSessionExpiresAt');
        const authStatus = localStorage.getItem('isAuthenticated');

        if (token && expiresAt && authStatus === 'true') {
          const now = new Date().toISOString();
          if (now < expiresAt) {
            setIsAuthenticated(true);
            
            // If on index page and authenticated, redirect to orders
            if (router.pathname === '/') {
              router.push('/orders');
            }
          } else {
            // Session expired, clear token and role
            localStorage.removeItem('pinSessionToken');
            localStorage.removeItem('pinSessionExpiresAt');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('userRole');
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
    
    // Listen for storage events (for logout across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'isAuthenticated' || e.key === 'pinSessionToken') {
        checkAuth();
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if the current route is a public route
  const isPublicRoute = publicRoutes.some(route => 
    router.pathname.startsWith(route)
  );

  // If not authenticated and not a public route, show PIN lock
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div>
        <Head>
          <title>Secure Access - Ossotna Fulfillment System</title>
        </Head>
        <PinLock onPinVerified={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  // Pages that should not have the sidebar layout
  const noLayoutRoutes = ['/'];
  const shouldUseLayout = !noLayoutRoutes.includes(router.pathname);

  return (
    <>
      <Head>
        <title>Ossotna Fulfillment System</title>
      </Head>
      {shouldUseLayout ? (
        <Layout>
          <Component {...pageProps} />
        </Layout>
      ) : (
        <main className="font-sans">
          <Component {...pageProps} />
        </main>
      )}
    </>
  );
}
