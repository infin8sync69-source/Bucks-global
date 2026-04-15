"use client";

import React from 'react';
import Link from 'next/link';
import { FaMagnifyingGlass, FaMessage, FaRegBell } from 'react-icons/fa6';
import { usePathname } from 'next/navigation';
import { G } from '@/components/ui/Glass';

const TopRightActions = () => {
    const pathname = usePathname();
    const isHome = pathname === '/';

    const glassIconStyle: React.CSSProperties = {
        ...G.btn,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: "50%",
        color: isHome ? "#fff" : "#6A00FF",
        transition: "opacity 0.2s, transform 0.15s",
        position: "relative",
    };

    return (
        <div className={`fixed top-4 right-4 md:top-6 md:right-6 z-[60] items-center space-x-2
            ${isHome ? 'flex' : 'hidden md:flex'}
        `}>
            {/* Search */}
            <Link href="/search" style={glassIconStyle}>
                <FaMagnifyingGlass className="text-sm" />
            </Link>

            {/* Messages */}
            <Link href="/messages" style={{ ...glassIconStyle, position: "relative" }}>
                <FaMessage className="text-sm" />
                <div className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-transparent"></div>
            </Link>

            {/* Notifications */}
            <Link href="/notifications" style={{ ...glassIconStyle, position: "relative" }}>
                <FaRegBell className="text-sm" />
                <div className="absolute top-2 right-3 w-1.5 h-1.5 bg-[#6A00FF] rounded-full"></div>
            </Link>
        </div>
    );
};

export default TopRightActions;
