// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react'
import octoClient from '../octoClient'
import avatarEvents from '../avatarEvents'

import './userAvatar.scss'

type Props = {
    userId: string
    name?: string
    size?: 'small' | 'medium' | 'large'
    className?: string
}

/**
 * Get initials from name/username
 */
const getInitials = (name: string): string => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase() || '?'
}

/**
 * Generate consistent color based on user ID
 */
const getAvatarColor = (userId: string): string => {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
        '#4CAF50', '#2196F3', '#9C27B0', '#FF9800'
    ]
    let hash = 0
    const id = userId || 'default'
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}

/**
 * UserAvatar component - displays user avatar with fallback to initials
 * Fetches avatar from public API endpoint so all users can see each other's avatars
 */
const UserAvatar = ({userId, name, size = 'medium', className = ''}: Props): JSX.Element => {
    const [hasAvatar, setHasAvatar] = useState(true)
    const [avatarUrl, setAvatarUrl] = useState<string>('')
    const [version, setVersion] = useState<number>(avatarEvents.getVersion(userId))
    
    useEffect(() => {
        if (userId) {
            // Use the public avatar API endpoint with cache busting
            const baseUrl = octoClient.getAvatarUrl(userId)
            const currentVersion = avatarEvents.getVersion(userId)
            const url = currentVersion ? `${baseUrl}?v=${currentVersion}` : baseUrl
            setAvatarUrl(url)
            setHasAvatar(true)
        }
    }, [userId, version])
    
    // Subscribe to avatar update events
    useEffect(() => {
        const unsubscribe = avatarEvents.subscribe((updatedUserId, timestamp) => {
            if (updatedUserId === userId) {
                setVersion(timestamp)
            }
        })
        return unsubscribe
    }, [userId])
    
    const displayName = name || '?'
    const initials = getInitials(displayName)
    const bgColor = getAvatarColor(userId)
    
    const sizeClass = `avatar-${size}`
    
    const handleImageError = () => {
        setHasAvatar(false)
    }
    
    return (
        <div 
            className={`UserAvatar ${sizeClass} ${className}`}
            style={hasAvatar ? {} : {backgroundColor: bgColor}}
        >
            {hasAvatar && avatarUrl ? (
                <img 
                    src={avatarUrl} 
                    alt={displayName} 
                    onError={handleImageError}
                />
            ) : (
                <span className='avatar-initials'>{initials}</span>
            )}
        </div>
    )
}

export default React.memo(UserAvatar)

// Export utility functions for use in other components
export {getInitials, getAvatarColor}
