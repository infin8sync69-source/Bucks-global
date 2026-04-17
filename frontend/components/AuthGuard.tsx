"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const did = localStorage.getItem('bucks_peer_id');
            const auth = localStorage.getItem('isAuthenticated') === 'true';

            if (did && auth) {
                setIsAuthenticated(true);

                // ── Auto re-register with backend ──────────────────────────────
                // If the backend was offline when the user first signed up, their
                // profile never made it into the database.  We silently re-register
                // on every startup so they're always discoverable via search.
                try {
                    const { getIdentity } = await import('@/lib/identity');
                    const { ensureRegistered } = await import('@/lib/sync');
                    const identity = getIdentity();
                    if (identity?.uuid7) {
                        // fire-and-forget — don't block rendering
                        ensureRegistered(identity).catch(() => {});
                    }
                } catch {
                    // never break auth over a registration failure
                }

                // ── Onboarding redirect (legacy v1 profiles) ───────────────────
                if (pathname !== '/settings' && pathname !== '/login') {
                    try {
                        const { fetchProfile } = await import('@/lib/api');
                        const profile = await fetchProfile();
                        if (profile.onboarding) {
                            router.push('/settings?onboarding=true');
                        }
                    } catch {
                        // Backend offline — not an auth failure, skip silently
                    }
                }
            } else {
                setIsAuthenticated(false);
                if (pathname !== '/login' && pathname !== '/recover') {
                    router.push('/login');
                }
            }
        };

        checkAuth();

        window.addEventListener('storage', checkAuth);
        return () => window.removeEventListener('storage', checkAuth);
    }, [pathname, router]);

    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/10 border-t-white/40"></div>
            </div>
        );
    }

    return <>{children}</>;
}
