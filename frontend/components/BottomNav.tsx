"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FaHouse, FaCirclePlay, FaGrip,
    FaChartSimple, FaRegUser, FaUser,
} from 'react-icons/fa6';

const ACTIVE_COLOR  = 'rgba(255,255,255,0.95)';
const ACTIVE_GLOW   = 'drop-shadow(0 0 8px rgba(255,255,255,0.45))';
const DIM           = 'rgba(255,255,255,0.38)';

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
                background: 'rgba(8,8,16,0.72)',
                backdropFilter: 'blur(56px) saturate(200%) brightness(1.06)',
                WebkitBackdropFilter: 'blur(56px) saturate(200%) brightness(1.06)',
                borderTop: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 -4px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.14)',
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
                            {/* Active background pill */}
                            {isActive && (
                                <span
                                    className="absolute top-1 w-9 h-8 rounded-2xl"
                                    style={{
                                        background: 'rgba(255,255,255,0.09)',
                                        border: '1px solid rgba(255,255,255,0.13)',
                                    }}
                                />
                            )}

                            <span
                                className="relative text-[18px] transition-all duration-200"
                                style={{
                                    color:  isActive ? ACTIVE_COLOR : DIM,
                                    filter: isActive ? ACTIVE_GLOW : 'none',
                                    transform: isActive ? 'scale(1.15) translateY(-1px)' : 'scale(1)',
                                }}
                            >
                                {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                            </span>

                            <span
                                className="text-[9px] font-bold uppercase tracking-wide leading-none"
                                style={{ color: isActive ? 'rgba(255,255,255,0.85)' : DIM }}
                            >
                                {tab.label}
                            </span>

                            {/* Active indicator line — bright white */}
                            {isActive && (
                                <span
                                    className="absolute bottom-0 w-5 h-0.5 rounded-full"
                                    style={{ background: 'rgba(255,255,255,0.70)' }}
                                />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
