import React from 'react';
import ChatPageClient from './ChatPageClient';

// Allow any peer_id param at runtime (no static pre-rendering needed)
export const dynamic = 'force-dynamic';

export default function ChatPage() {
    return <ChatPageClient />;
}
