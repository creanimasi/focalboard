// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Simple event emitter for avatar updates
 * This allows components to be notified when an avatar is updated
 * so they can refresh without a page reload
 */

type AvatarEventListener = (userId: string, timestamp: number) => void

class AvatarEventEmitter {
    private listeners: Set<AvatarEventListener> = new Set()
    private avatarVersions: Map<string, number> = new Map()

    /**
     * Subscribe to avatar update events
     */
    subscribe(listener: AvatarEventListener): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    /**
     * Emit an avatar update event
     * Call this after successfully uploading a new avatar
     */
    emit(userId: string): void {
        const timestamp = Date.now()
        this.avatarVersions.set(userId, timestamp)
        this.listeners.forEach(listener => {
            try {
                listener(userId, timestamp)
            } catch (e) {
                console.error('Error in avatar event listener:', e)
            }
        })
    }

    /**
     * Get the version timestamp for a user's avatar
     * Used to bust browser cache by appending to URL
     */
    getVersion(userId: string): number {
        return this.avatarVersions.get(userId) || 0
    }
}

// Singleton instance
const avatarEvents = new AvatarEventEmitter()

export default avatarEvents
