import React from 'react';
import UserProfilePageClient from './UserProfilePageClient';

// Render on-demand for any user ID
export const dynamic = 'force-dynamic';

export default function UserProfilePage() {
    return <UserProfilePageClient />;
}
