"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FaHouse, FaMagnifyingGlass,
    FaPlus, FaMessage, FaRegMessage,
    FaUser, FaRegUser,
} from 'react-icons/fa6';
import { G } from '@/components/ui/Glass';
import { fetchChatUnread } from '@/lib/api';

const ACTIVE  = 'rgba(255,255,255,0.95)';
const ACTIVE_GLOW = 'drop-shadow(0 0 7px rgba(255,255,255,0.40))';
const DIM     = 'rgba(255,255,255,0.36)';

const tabs = [
    { label: 'Home',     href: '/',         icon: <FaHouse />,       activeIcon: <FaHouse /> },
    { label: 'Search',   href: '/search',   icon: <FaMagnifyingGlass />, activeIcon: <FaMagnifyingGlass /> },
    { label: 'Create',   href: '/create',   icon: null,              isCta: true },
    { label: 'Messages', href: '/messages', icon: <FaRegMessage />,  activeIcon: <FaMessage /> },
    { label: 'Profile',  href: '/profile',  icon: <FaRegUser />,     activeIcon: <FaUser /> },
];

export default function BottomNav() {
    const pathname = usePathname();
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const poll = async () => {
            const count = await fetchChatUnread();
            if (!cancelled) setUnread(count);
        };
        poll();
        const id = setInterval(poll, 30_000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
            style={{
                ...G.nav,
                borderTop: '1px solid rgba(255,255,255,0.12)',
                borderBottom: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="flex items-center justify-around px-2 h-16">
                {tabs.map((tab: any) => {
                    const isActive =
                        pathname === tab.href ||
                        (tab.href !== '/' && pathname.startsWith(tab.href + '/'));
                    const badgeCount = tab.href === '/messages' && unread > 0 ? unread : 0;

                    /* Centre CTA — liquid glass pill */
                    if (tab.isCta) {
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className="relative flex items-center justify-center w-14 h-12 rounded-2xl text-white text-lg transition-all active:scale-90"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
                                    border: '1px solid rgba(255,255,255,0.26)',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.30), inset 0 1.5px 0 rgba(255,255,255,0.28)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    marginBottom: 10,
                                    color: 'rgba(255,255,255,0.90)',
                                }}
                            >
                                <FaPlus />
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all active:scale-90"
                        >
                            {/* Active bg pill */}
                            {isActive && (
                                <span
                                    className="absolute top-1 w-9 h-8 rounded-xl"
                                    style={{
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                    }}
                                />
                            )}

                            <span
                                className="relative text-[18px] transition-all duration-200"
                                style={{
                                    color:     isActive ? ACTIVE : DIM,
                                    filter:    isActive ? ACTIVE_GLOW : 'none',
                                    transform: isActive ? 'scale(1.14) translateY(-1px)' : 'scale(1)',
                                }}
                            >
                                {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                            </span>

                            <span
                                className="text-[9px] font-bold uppercase tracking-wide leading-none relative"
                                style={{ color: isActive ? 'rgba(255,255,255,0.82)' : DIM }}
                            >
                                {tab.label}
                            </span>

                            {/* Active indicator */}
                            {isActive && (
                                <span
                                    className="absolute bottom-0 w-5 h-0.5 rounded-full"
                                    style={{ background: 'rgba(255,255,255,0.65)' }}
                                />
                            )}

                            {/* Unread badge */}
                            {badgeCount > 0 && (
                                <span
                                    className="absolute top-1 right-4 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center"
                                    style={{
                                        background: 'rgba(255,255,255,0.85)',
                                        color: 'rgba(0,0,0,0.80)',
                                    }}
                                >
                                    {badgeCount > 9 ? '9+' : badgeCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
