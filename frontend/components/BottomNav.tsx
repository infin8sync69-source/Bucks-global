"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FaHouse, FaCirclePlay, FaGrip,
    FaChartSimple, FaRegUser, FaUser,
} from 'react-icons/fa6';
import { G } from '@/components/ui/Glass';
import { fetchChatUnread } from '@/lib/api';

const PURPLE      = 'rgba(155,63,255,1)';
const PURPLE_GLOW = 'drop-shadow(0 0 8px rgba(155,63,255,0.70))';
const DIM         = 'rgba(255,255,255,0.38)';

const tabs = [
    { label: 'Home',        href: '/',            icon: <FaHouse />,       activeIcon: <FaHouse /> },
    { label: 'Feeds',       href: '/feed',         icon: <FaCirclePlay />,  activeIcon: <FaCirclePlay /> },
    { label: 'Services',    href: '/services',     icon: <FaGrip />,        activeIcon: <FaGrip /> },
    { label: 'Recommended', href: '/recommended',  icon: <FaChartSimple />, activeIcon: <FaChartSimple /> },
    { label: 'Account',     href: '/profile',      icon: <FaRegUser />,     activeIcon: <FaUser /> },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
            style={{
                background: 'rgba(6,3,14,0.88)',
                backdropFilter: 'blur(40px) saturate(160%)',
                WebkitBackdropFilter: 'blur(40px) saturate(160%)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="flex items-stretch justify-around h-16 px-1">
                {tabs.map(tab => {
                    const isActive =
                        pathname === tab.href ||
                        (tab.href !== '/' && pathname.startsWith(tab.href));

                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all active:scale-90"
                        >
                            {/* Active background glow */}
                            {isActive && (
                                <span
                                    className="absolute top-1 w-8 h-8 rounded-2xl"
                                    style={{ background: 'rgba(155,63,255,0.12)' }}
                                />
                            )}

                            <span
                                className="relative text-[18px] transition-all duration-200"
                                style={{
                                    color:  isActive ? PURPLE : DIM,
                                    filter: isActive ? PURPLE_GLOW : 'none',
                                    transform: isActive ? 'scale(1.18) translateY(-1px)' : 'scale(1)',
                                }}
                            >
                                {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                            </span>

                            <span
                                className="text-[9px] font-bold uppercase tracking-wide leading-none"
                                style={{ color: isActive ? 'rgba(155,63,255,0.92)' : DIM }}
                            >
                                {tab.label}
                            </span>

                            {/* Active indicator line */}
                            {isActive && (
                                <span
                                    className="absolute bottom-0 w-5 h-0.5 rounded-full"
                                    style={{ background: 'linear-gradient(90deg, #9B3FFF, #6A00FF)' }}
                                />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
