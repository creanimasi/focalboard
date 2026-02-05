// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MemberNotification, receiveNotification} from '../store/notifications'
import {Store} from 'redux'

const CHANNEL_NAME = 'focalboard_notifications'

class NotificationBroadcast {
    private channel: BroadcastChannel | null = null
    private store: Store | null = null

    initialize(store: Store) {
        this.store = store
        console.log('[NotificationBroadcast] Initialized')
        
        if (typeof BroadcastChannel !== 'undefined') {
            this.channel = new BroadcastChannel(CHANNEL_NAME)
            console.log('[NotificationBroadcast] BroadcastChannel created')
            
            this.channel.onmessage = (event) => {
                const {type, payload} = event.data
                console.log('[NotificationBroadcast] Received message:', type, payload)
                
                if (type === 'NEW_NOTIFICATION' && this.store) {
                    this.store.dispatch(receiveNotification(payload))
                }
            }
        }
        
        // Also listen for localStorage changes (for cross-tab in same browser)
        window.addEventListener('storage', (event) => {
            if (event.key?.startsWith('focalboard_notifications_') && event.newValue && this.store) {
                console.log('[NotificationBroadcast] Storage event detected:', event.key)
                try {
                    const notifications = JSON.parse(event.newValue)
                    if (notifications.length > 0) {
                        // Get the latest notification and dispatch it
                        const latest = notifications[0]
                        this.store.dispatch(receiveNotification(latest))
                    }
                } catch (e) {
                    console.error('[NotificationBroadcast] Failed to parse storage event', e)
                }
            }
        })
    }

    broadcast(notification: MemberNotification) {
        console.log('[NotificationBroadcast] Broadcasting notification:', notification)
        
        if (this.channel) {
            this.channel.postMessage({
                type: 'NEW_NOTIFICATION',
                payload: notification,
            })
            console.log('[NotificationBroadcast] Sent via BroadcastChannel')
        }
        
        // Also save to localStorage for the target user (for when they're not online)
        try {
            const key = `focalboard_notifications_${notification.targetUserId}`
            const existing = localStorage.getItem(key)
            let notifications: MemberNotification[] = []
            
            if (existing) {
                notifications = JSON.parse(existing)
            }
            
            // Check if already exists
            if (!notifications.some(n => n.id === notification.id)) {
                notifications.unshift(notification)
                
                // Keep only last 50
                if (notifications.length > 50) {
                    notifications = notifications.slice(0, 50)
                }
                
                localStorage.setItem(key, JSON.stringify(notifications))
                console.log('[NotificationBroadcast] Saved to localStorage for user:', notification.targetUserId)
            }
        } catch (e) {
            console.error('[NotificationBroadcast] Failed to save notification to localStorage', e)
        }
    }

    close() {
        if (this.channel) {
            this.channel.close()
            this.channel = null
        }
    }
}

const notificationBroadcast = new NotificationBroadcast()
export default notificationBroadcast
