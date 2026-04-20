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

const tabs = [
    {
        label: 'Feed',
        href: '/feed',
        icon: <FaHouse />,
    },
    {
        label: 'Search',
        href: '/search',
        icon: <FaMagnifyingGlass />,
    },
    {
        label: 'Create',
        href: '/create',
        icon: null, // special FAB-style centre button
        isCta: true,
    },
    {
        label: 'Messages',
        href: '/messages',
        icon: <FaRegMessage />,
        activeIcon: <FaMessage />,
    },
    {
        label: 'Profile',
        href: '/profile',
        icon: <FaRegUser />,
        activeIcon: <FaUser />,
    },
];

export default function BottomNav() {
    const pathname = usePathname();
    const [unread, setUnread] = useState(0);

    // Poll unread count every 30 s (mirrors Sidebar.tsx)
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
                borderTop: '1px solid rgba(255,255,255,0.09)',
                borderBottom: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="flex items-center justify-around px-2 h-16">
                {tabs.map(tab => {
                    const isActive =
                        pathname === tab.href ||
                        (tab.href !== '/feed' && pathname.startsWith(tab.href + '/'));
                    const badgeCount = tab.href === '/messages' && unread > 0 ? unread : 0;

                    // Centre CTA button — Create
                    if (tab.isCta) {
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className="relative flex items-center justify-center w-14 h-14 rounded-2xl text-white text-xl shadow-2xl transition-all active:scale-90"
                                style={{
                                    background: 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)',
                                    boxShadow: '0 6px 28px rgba(106,0,255,0.55), inset 0 1.5px 0 rgba(255,255,255,0.22)',
                                    marginBottom: 12,
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
                            className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all active:scale-90"
                        >
                            {/* Icon */}
                            <span
                                className="text-xl transition-all duration-200"
                                style={{
                                    color: isActive
                                        ? 'rgba(155,63,255,1)'
                                        : 'rgba(255,255,255,0.38)',
                                    filter: isActive
                                        ? 'drop-shadow(0 0 6px rgba(155,63,255,0.60))'
                                        : 'none',
                                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                                }}
                            >
                                {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                            </span>

                            {/* Label */}
                            <span
                                className="text-[9px] font-bold uppercase tracking-wide leading-none"
                                style={{
                                    color: isActive
                                        ? 'rgba(155,63,255,0.90)'
                                        : 'rgba(255,255,255,0.28)',
                                }}
                            >
                                {tab.label}
                            </span>

                            {/* Unread badge */}
                            {badgeCount > 0 && (
                                <span
                                    className="absolute top-1 right-4 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center"
                                    style={{
                                        background: 'rgba(155,63,255,0.90)',
                                        color: '#fff',
                                        boxShadow: '0 2px 8px rgba(155,63,255,0.50)',
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
