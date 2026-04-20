"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FaHouse, FaChartLine, FaGrip,
    FaBitcoinSign, FaRegUser, FaUser,
    FaMessage, FaRegMessage,
} from 'react-icons/fa6';
import { G } from '@/components/ui/Glass';
import { fetchChatUnread } from '@/lib/api';

const PURPLE = 'rgba(155,63,255,1)';
const PURPLE_GLOW = '0 0 10px rgba(155,63,255,0.60)';
const DIM = 'rgba(255,255,255,0.35)';

const tabs = [
    { label: 'Home',       href: '/feed',      icon: <FaHouse />,         activeIcon: <FaHouse /> },
    { label: 'Trends',     href: '/recommended', icon: <FaChartLine />,   activeIcon: <FaChartLine /> },
    { label: 'Services',   href: '/services',  icon: <FaGrip />,           activeIcon: <FaGrip />, isCta: true },
    { label: 'Messages',   href: '/messages',  icon: <FaRegMessage />,     activeIcon: <FaMessage /> },
    { label: 'Account',    href: '/profile',   icon: <FaRegUser />,        activeIcon: <FaUser /> },
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
                borderTop: '1px solid rgba(255,255,255,0.08)',
                borderBottom: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="flex items-center justify-around px-1 h-16">
                {tabs.map(tab => {
                    const isActive =
                        pathname === tab.href ||
                        (tab.href !== '/feed' && pathname.startsWith(tab.href + '/'));
                    const badgeCount = tab.href === '/messages' && unread > 0 ? unread : 0;

                    if (tab.isCta) {
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className="relative flex flex-col items-center justify-center flex-1 gap-0.5 py-2 transition-all active:scale-90"
                            >
                                <span
                                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-base shadow-lg transition-all duration-200"
                                    style={{
                                        background: isActive
                                            ? 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)'
                                            : 'rgba(255,255,255,0.07)',
                                        border: isActive
                                            ? '1px solid rgba(155,63,255,0.50)'
                                            : '1px solid rgba(255,255,255,0.10)',
                                        color: isActive ? '#fff' : DIM,
                                        boxShadow: isActive ? '0 4px 20px rgba(106,0,255,0.50)' : 'none',
                                    }}
                                >
                                    {tab.icon}
                                </span>
                                <span
                                    className="text-[9px] font-bold uppercase tracking-wide"
                                    style={{ color: isActive ? PURPLE : DIM }}
                                >
                                    {tab.label}
                                </span>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all active:scale-90"
                        >
                            <span
                                className="text-xl transition-all duration-200"
                                style={{
                                    color: isActive ? PURPLE : DIM,
                                    filter: isActive ? `drop-shadow(${PURPLE_GLOW})` : 'none',
                                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                                }}
                            >
                                {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                            </span>
                            <span
                                className="text-[9px] font-bold uppercase tracking-wide leading-none"
                                style={{ color: isActive ? 'rgba(155,63,255,0.90)' : DIM }}
                            >
                                {tab.label}
                            </span>

                            {/* Active indicator dot */}
                            {isActive && (
                                <span
                                    className="absolute bottom-0 w-4 h-0.5 rounded-full"
                                    style={{ background: 'linear-gradient(90deg, #9B3FFF, #6A00FF)' }}
                                />
                            )}

                            {/* Unread badge */}
                            {badgeCount > 0 && (
                                <span
                                    className="absolute top-1.5 right-3.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center"
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
