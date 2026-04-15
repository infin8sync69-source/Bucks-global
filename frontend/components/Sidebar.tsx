"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FaRss, FaHouseChimney, FaHouse, FaGrip,
    FaHeart, FaRegHeart, FaUser, FaRegUser,
    FaGear, FaArrowRightFromBracket, FaBars,
} from 'react-icons/fa6';
import { logout } from '@/lib/api';
import { G, Iris, Specular } from '@/components/ui/Glass';

const Sidebar = () => {
    const pathname = usePathname();
    const isHome = pathname === '/';
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const navItems = [
        { label: 'Home', icon: <FaRss />, activeIcon: <FaRss />, href: '/' },
        { label: 'Feed', icon: <FaHouse />, activeIcon: <FaHouseChimney />, href: '/feed' },
        { label: 'Services', icon: <FaGrip />, activeIcon: <FaGrip />, href: '/services' },
        { label: 'Recommended', icon: <FaRegHeart />, activeIcon: <FaHeart />, href: '/recommended' },
        { label: 'Profile', icon: <FaRegUser />, activeIcon: <FaUser />, href: '/profile' },
    ];

    const SidebarContent = () => (
        <div
            className="flex flex-col h-full p-6"
            style={{ ...G.nav, borderRight: "1px solid rgba(255,255,255,0.62)", position: "relative", overflow: "hidden" }}
        >
            <Iris opacity={0.6} />
            <Specular />
            {/* Logo */}
            <div className="flex items-center justify-center mb-10">
                <Link href="/" onClick={() => setIsDrawerOpen(false)} className="font-black text-2xl text-primary tracking-tight">
                    bucks
                </Link>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            onClick={() => setIsDrawerOpen(false)}
                            className="flex items-center space-x-4 px-4 py-3 rounded-2xl transition-all duration-200 group active:scale-95"
                            style={isActive ? {
                                background: "linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)",
                                boxShadow: "0 4px 20px rgba(106,0,255,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
                                color: "#fff",
                                position: "relative",
                                overflow: "hidden",
                            } : {
                                color: "rgba(100,0,200,0.55)",
                            }}
                        >
                            <span className={`text-xl ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                                {isActive ? (item.activeIcon || item.icon) : item.icon}
                            </span>
                            <span className="font-bold text-sm">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer Actions */}
            <div className="mt-auto space-y-1 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.38)" }}>
                <Link
                    href="/settings"
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex items-center space-x-3 px-4 py-2 text-secondary hover:text-foreground hover:bg-gray-50 rounded-xl transition-colors"
                >
                    <FaGear className="text-xs" />
                    <span className="text-xs font-bold">Settings</span>
                </Link>
                <button
                    onClick={() => { setIsDrawerOpen(false); logout(); }}
                    className="w-full flex items-center space-x-3 px-4 py-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                    <FaArrowRightFromBracket className="text-xs" />
                    <span className="text-xs font-bold">Logout</span>
                </button>
            </div>
        </div>
    );

    // Mobile Hamburger drawer — shown on ALL pages (mobile only)
    const MobileHamburger = () => (
        <>
            <button
                onClick={() => setIsDrawerOpen(true)}
                className={`fixed top-3 left-4 z-[100] p-2 rounded-xl transition-all duration-300 shadow-lg ${isHome
                    ? 'text-white/70 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10'
                    : 'text-gray-700 hover:text-primary bg-white hover:bg-gray-50 border border-gray-200'
                    }`}
            >
                <FaBars className="text-xl" />
            </button>

            {isDrawerOpen && (
                <div className="fixed inset-0 z-[110]">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
                    <div className="absolute inset-y-0 left-0 w-80 shadow-2xl animate-in slide-in-from-left duration-300">
                        <SidebarContent />
                    </div>
                </div>
            )}
        </>
    );

    return (
        <>
            {/* Hamburger — on ALL pages for mobile */}
            <div className="md:hidden">
                <MobileHamburger />
            </div>

            {/* Static desktop sidebar — always hidden on mobile, visible on desktop */}
            <div className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-50">
                <SidebarContent />
            </div>
        </>
    );
};

export default Sidebar;
