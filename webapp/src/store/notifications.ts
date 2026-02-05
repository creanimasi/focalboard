// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction, createAsyncThunk} from '@reduxjs/toolkit'

import octoClient, {UserNotification} from '../octoClient'

// Frontend notification type that matches server's UserNotification
export interface MemberNotification {
    id: string
    type: 'assigned' | 'unassigned' | 'mentioned' | string
    cardTitle: string
    cardId: string
    boardId: string
    memberName: string
    memberUsername: string
    targetUserId: string
    actorName: string
    timestamp: number
    read: boolean
}

// Convert server notification to frontend format
const convertFromServer = (serverNotif: UserNotification): MemberNotification => ({
    id: serverNotif.id,
    type: serverNotif.type,
    cardTitle: serverNotif.cardTitle,
    cardId: serverNotif.cardId,
    boardId: serverNotif.boardId,
    memberName: serverNotif.actorName,
    memberUsername: serverNotif.actorName,
    targetUserId: serverNotif.targetUserId,
    actorName: serverNotif.actorName,
    timestamp: serverNotif.createAt,
    read: serverNotif.read,
})

interface NotificationsState {
    notifications: MemberNotification[]
    showToast: boolean
    currentToast: MemberNotification | null
    currentUserId: string | null
    loading: boolean
}

const initialState: NotificationsState = {
    notifications: [],
    showToast: false,
    currentToast: null,
    currentUserId: null,
    loading: false,
}

// Async thunks for server communication
export const fetchNotifications = createAsyncThunk(
    'notifications/fetchNotifications',
    async (limit: number = 50) => {
        const notifications = await octoClient.getNotifications(limit)
        return notifications.map(convertFromServer)
    },
)

export const createServerNotification = createAsyncThunk(
    'notifications/createServerNotification',
    async (notification: {
        targetUserId: string
        actorUserId: string
        actorName: string
        type: string
        cardId: string
        cardTitle: string
        boardId: string
    }) => {
        const created = await octoClient.createNotification(notification)
        if (created) {
            return convertFromServer(created)
        }
        return null
    },
)

export const markNotificationRead = createAsyncThunk(
    'notifications/markNotificationRead',
    async (notificationId: string) => {
        await octoClient.markNotificationAsRead(notificationId)
        return notificationId
    },
)

export const markAllNotificationsRead = createAsyncThunk(
    'notifications/markAllNotificationsRead',
    async () => {
        await octoClient.markAllNotificationsAsRead()
        return true
    },
)

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        setCurrentUserId: (state, action: PayloadAction<string>) => {
            state.currentUserId = action.payload
            console.log('[Notifications] setCurrentUserId:', action.payload)
        },
        // Add notification locally (from WebSocket)
        addNotification: (state, action: PayloadAction<Omit<MemberNotification, 'id' | 'timestamp' | 'read'>>) => {
            const notification: MemberNotification = {
                ...action.payload,
                id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                read: false,
            }
            console.log('[Notifications] addNotification (local):', notification)
            state.notifications.unshift(notification)
            state.currentToast = notification
            state.showToast = true

            // Keep only last 50 notifications
            if (state.notifications.length > 50) {
                state.notifications = state.notifications.slice(0, 50)
            }
        },
        // Receive notification from WebSocket
        receiveNotification: (state, action: PayloadAction<MemberNotification | UserNotification>) => {
            let notification: MemberNotification

            // Check if it's a server notification format
            if ('createAt' in action.payload) {
                notification = convertFromServer(action.payload as UserNotification)
            } else {
                notification = action.payload as MemberNotification
            }

            console.log('[Notifications] receiveNotification via WebSocket:', notification)

            // Check if we already have this notification
            const exists = state.notifications.some(n => n.id === notification.id)
            if (!exists) {
                state.notifications.unshift(notification)
                state.currentToast = notification
                state.showToast = true

                // Keep only last 50 notifications
                if (state.notifications.length > 50) {
                    state.notifications = state.notifications.slice(0, 50)
                }
                console.log('[Notifications] Added notification from WebSocket, total:', state.notifications.length)
            }
        },
        dismissToast: (state) => {
            state.showToast = false
            state.currentToast = null
        },
        markAsRead: (state, action: PayloadAction<string>) => {
            const notification = state.notifications.find(n => n.id === action.payload)
            if (notification) {
                notification.read = true
            }
        },
        markAllAsRead: (state) => {
            state.notifications.forEach(n => {
                n.read = true
            })
        },
        clearNotifications: (state) => {
            state.notifications = []
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotifications.pending, (state) => {
                state.loading = true
            })
            .addCase(fetchNotifications.fulfilled, (state, action) => {
                state.loading = false
                state.notifications = action.payload
                console.log('[Notifications] Fetched from server:', action.payload.length)
            })
            .addCase(fetchNotifications.rejected, (state) => {
                state.loading = false
                console.error('[Notifications] Failed to fetch from server')
            })
            .addCase(createServerNotification.fulfilled, (state, action) => {
                if (action.payload) {
                    // The notification will be received via WebSocket, 
                    // so we don't need to add it here
                    console.log('[Notifications] Created on server:', action.payload.id)
                }
            })
            .addCase(markNotificationRead.fulfilled, (state, action) => {
                const notification = state.notifications.find(n => n.id === action.payload)
                if (notification) {
                    notification.read = true
                }
            })
            .addCase(markAllNotificationsRead.fulfilled, (state) => {
                state.notifications.forEach(n => {
                    n.read = true
                })
            })
    },
})

export const {
    setCurrentUserId,
    addNotification,
    receiveNotification,
    dismissToast,
    markAsRead,
    markAllAsRead,
    clearNotifications,
} = notificationsSlice.actions

export const notificationsReducer = notificationsSlice.reducer

// Selectors - using state.notifications directly with type assertion to avoid circular import issues
export const getNotifications = (state: {notifications: NotificationsState}): MemberNotification[] => state.notifications.notifications
export const getUnreadCount = (state: {notifications: NotificationsState}): number => state.notifications.notifications.filter((n: MemberNotification) => !n.read).length
export const getShowToast = (state: {notifications: NotificationsState}): boolean => state.notifications.showToast
export const getCurrentToast = (state: {notifications: NotificationsState}): MemberNotification | null => state.notifications.currentToast
export const getNotificationsLoading = (state: {notifications: NotificationsState}): boolean => state.notifications.loading
