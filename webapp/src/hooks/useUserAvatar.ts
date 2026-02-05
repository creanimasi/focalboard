// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useAppSelector} from '../store/hooks'
import {getMyConfig} from '../store/users'

/**
 * Hook to get the current user's avatar from user config
 * Returns the avatar URL if set, null otherwise
 */
export const useMyAvatar = (): string | null => {
    const myConfig = useAppSelector(getMyConfig)
    return myConfig.avatar?.value || null
}

/**
 * Get avatar initials for a user
 */
export const getAvatarInitials = (name: string): string => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
}

/**
 * Generate a consistent color based on user ID
 */
export const getAvatarColor = (userId: string): string => {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ]
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}
