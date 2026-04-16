"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FaMagnifyingGlass, FaUser, FaRegUser, FaGear, FaArrowRightFromBracket, FaBars } from 'react-icons/fa6';
import { G, Iris, Specular } from '@/components/ui/Glass';
import { getIdentity } from '@/lib/identity';
import { clearIdentity } from '@/lib/identity';

const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const navItems = [
        {
            label: 'Search',
            icon: <FaMagnifyingGlass />,
            href: '/search',
        },
        {
            label: 'Profile',
            icon: <FaRegUser />,
            activeIcon: <FaUser />,
            href: '/profile',
        },
    ];

    const handleLogout = () => {
        setIsDrawerOpen(false);
        clearIdentity();
        router.push('/login');
    };

    const SidebarContent = () => {
        const identity = getIdentity();

        return (
            <div
                className="flex flex-col h-full p-6"
                style={{ ...G.nav, borderRight: '1px solid rgba(255,255,255,0.62)', position: 'relative', overflow: 'hidden' }}
            >
                <Iris opacity={0.6} />
                <Specular />

                {/* Logo */}
                <div className="flex items-center justify-center mb-10">
                    <Link href="/profile" onClick={() => setIsDrawerOpen(false)}
                        className="font-black text-2xl text-primary tracking-tight">
                        bucks
                    </Link>
                </div>

                {/* Nav */}
                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                onClick={() => setIsDrawerOpen(false)}
                                className="flex items-center space-x-4 px-4 py-3 rounded-2xl transition-all duration-200 group active:scale-95"
                                style={isActive ? {
                                    background: 'linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)',
                                    boxShadow: '0 4px 20px rgba(106,0,255,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
                                    color: '#fff',
                                } : {
                                    color: 'rgba(100,0,200,0.55)',
                                }}
                            >
                                <span className={`text-xl ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                                    {isActive && item.activeIcon ? item.activeIcon : item.icon}
                                </span>
                                <span className="font-bold text-sm">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User identity mini-card */}
                {identity && (
                    <div
                        className="mb-4 p-3 rounded-2xl flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        style={G.light}
                        onClick={() => { setIsDrawerOpen(false); router.push('/profile'); }}
                    >
                        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0"
                            style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                            {identity.avatar
                                ? <img src={identity.avatar} alt={identity.username} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-lg">👤</div>
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{identity.username}</p>
                            <p className="text-[10px] text-gray-400 font-mono truncate">{identity.uuid7.split('-')[0]}</p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="space-y-1 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.38)' }}>
                    <Link href="/settings" onClick={() => setIsDrawerOpen(false)}
                        className="flex items-center space-x-3 px-4 py-2 text-secondary hover:text-foreground hover:bg-gray-50 rounded-xl transition-colors">
                        <FaGear className="text-xs" />
                        <span className="text-xs font-bold">Settings</span>
                    </Link>
                    <button onClick={handleLogout}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                        <FaArrowRightFromBracket className="text-xs" />
                        <span className="text-xs font-bold">Logout</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile hamburger */}
            <div className="md:hidden">
                <button
                    onClick={() => setIsDrawerOpen(true)}
                    className="fixed top-3 left-4 z-[100] p-2 rounded-xl text-gray-700 hover:text-primary bg-white hover:bg-gray-50 border border-gray-200 shadow-lg transition-all"
                >
                    <FaBars className="text-xl" />
                </button>

                {isDrawerOpen && (
                    <div className="fixed inset-0 z-[110]">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
                        <div className="absolute inset-y-0 left-0 w-72 shadow-2xl animate-in slide-in-from-left duration-300">
                            <SidebarContent />
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop sidebar */}
            <div className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 z-50">
                <SidebarContent />
            </div>
        </>
    );
};

export default Sidebar;
