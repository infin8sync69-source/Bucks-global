"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import TopRightActions from '@/components/TopRightActions';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import { fetchProfile } from '@/lib/api';

// Pages where we hide ALL navigation chrome
const FULL_SCREEN_PAGES = ['/login', '/create', '/recover', '/qr-scan'];
// Pages with their own internal header — hide global TopRightActions + Sidebar but keep BottomNav
const GLOBE_PAGES = ['/'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isFullScreen = FULL_SCREEN_PAGES.some(p => pathname.startsWith(p));
    const isGlobePage = GLOBE_PAGES.includes(pathname);
    const hideGlobalChrome = isFullScreen || isGlobePage;

    React.useEffect(() => {
        // Fetch profile once on mount to populate localStorage cache
        if (typeof window !== 'undefined' && localStorage.getItem('bucks_peer_id')) {
            fetchProfile().catch((err: any) => {
                // Silently ignore network errors (backend offline) — not actionable for the user
                if (err?.code !== 'ERR_NETWORK' && err?.message !== 'Network Error') {
                    console.error('Profile prefetch failed', err);
                }
            });
        }
    }, [pathname]);

    return (
        <div className="min-h-screen relative" style={{ background: 'transparent' }}>
            {!hideGlobalChrome && <TopRightActions />}
            {!hideGlobalChrome && <Sidebar />}

            <div className={`transition-all duration-300 ${!hideGlobalChrome ? 'md:pl-64' : ''}`}>
                <div className="flex justify-center min-h-screen">
                    <main className={`w-full min-h-screen ${!hideGlobalChrome ? 'md:max-w-2xl' : ''}`}>
                        <div key={pathname} className="animate-in fade-in zoom-in-95 duration-300">
                            {children}
                        </div>
                    </main>
                </div>
            </div>

            {/* Bottom nav — mobile only, all pages except full-screen flows */}
            {!isFullScreen && <BottomNav />}
        </div>
    );
}
