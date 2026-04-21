"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    FaMagnifyingGlass,
    FaHouse,
    FaRegCompass,
    FaUser,
    FaRegUser,
    FaMessage,
    FaRegMessage,
    FaGear,
    FaArrowRightFromBracket,
    FaBars,
} from 'react-icons/fa6';
import { G, Iris, Specular } from '@/components/ui/Glass';
import { getIdentity, clearIdentity } from '@/lib/identity';
import { fetchChatUnread } from '@/lib/api';

const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [unread, setUnread] = useState(0);

    // Poll unread count every 30 seconds
    useEffect(() => {
        let cancelled = false;
        const poll = async () => {
            const count = await fetchChatUnread();
            if (!cancelled) setUnread(count);
        };
        poll();
        const id = setInterval(poll, 30000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    const navItems = [
        {
            label: 'Home',
            icon: <FaHouse />,
            href: '/',
        },
        {
            label: 'Explore',
            icon: <FaRegCompass />,
            href: '/explore',
        },
        {
            label: 'Search',
            icon: <FaMagnifyingGlass />,
            href: '/search',
        },
        {
            label: 'Messages',
            icon: <FaRegMessage />,
            activeIcon: <FaMessage />,
            href: '/messages',
            badge: unread > 0 ? (unread > 9 ? '9+' : String(unread)) : undefined,
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
                style={{
                    ...G.nav,
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <Iris opacity={0.5} />
                <Specular />

                {/* Logo */}
                <div className="flex items-center justify-center mb-10">
                    <Link href="/profile" onClick={() => setIsDrawerOpen(false)}
                        className="font-black text-2xl tracking-tight"
                        style={{ color: 'rgba(255,255,255,0.85)' }}>
                        bucks
                    </Link>
                </div>

                {/* Nav */}
                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                onClick={() => setIsDrawerOpen(false)}
                                className="flex items-center space-x-4 px-4 py-3 rounded-2xl transition-all duration-200 group active:scale-95"
                                style={isActive ? {
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 100%)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.35), inset 0 1.5px 0 rgba(255,255,255,0.20)',
                                    color: 'rgba(255,255,255,0.95)',
                                } : {
                                    color: 'rgba(255,255,255,0.38)',
                                }}
                            >
                                <span className={`text-xl ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                                    {isActive && item.activeIcon ? item.activeIcon : item.icon}
                                </span>
                                <span className="font-bold text-sm flex-1">{item.label}</span>
                                {item.badge && (
                                    <span
                                        className="text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                                        style={{
                                            background: 'rgba(255,255,255,0.18)',
                                            color: 'rgba(255,255,255,0.90)',
                                            border: '1px solid rgba(255,255,255,0.25)',
                                        }}
                                    >
                                        {item.badge}
                                    </span>
                                )}
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
                        <div
                            className="w-9 h-9 rounded-xl overflow-hidden shrink-0"
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                            {identity.avatar
                                ? <img src={identity.avatar} alt={identity.username} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>◈</div>
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{identity.username}</p>
                            <p className="text-[10px] font-mono truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{identity.uuid7.split('-')[0]}</p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="space-y-1 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <Link href="/settings" onClick={() => setIsDrawerOpen(false)}
                        className="flex items-center space-x-3 px-4 py-2 rounded-xl transition-colors"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                    >
                        <FaGear className="text-xs" />
                        <span className="text-xs font-bold">Settings</span>
                    </Link>
                    <button onClick={handleLogout}
                        className="w-full flex items-center space-x-3 px-4 py-2 rounded-xl transition-colors"
                        style={{ color: 'rgba(255,120,120,0.55)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,140,140,0.80)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,120,120,0.55)')}
                    >
                        <FaArrowRightFromBracket className="text-xs" />
                        <span className="text-xs font-bold">Logout</span>
                    </button>
                </div>
            </div>
        );
    };

    // One pattern for every breakpoint: sidebar lives behind a hamburger drawer.
    // This keeps the feed/globe free of a permanent 15rem left column and mirrors
    // the mobile affordance desktop users already recognize (Gmail, YouTube, etc).
    return (
        <>
            <button
                onClick={() => setIsDrawerOpen(true)}
                aria-label="Open navigation"
                className="fixed top-3 left-4 md:top-5 md:left-5 z-[100] p-2 rounded-xl transition-all"
                style={{
                    background: 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.70)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.40)',
                    position: 'fixed',
                }}
            >
                <FaBars className="text-xl" />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.90)', border: '1px solid rgba(255,255,255,0.25)' }}>
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {isDrawerOpen && (
                <div className="fixed inset-0 z-[110]">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
                    <div className="absolute inset-y-0 left-0 w-72 shadow-2xl animate-in slide-in-from-left duration-300">
                        <SidebarContent />
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
