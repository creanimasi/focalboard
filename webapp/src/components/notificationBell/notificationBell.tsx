// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {useHistory} from 'react-router-dom'

import {useAppSelector, useAppDispatch} from '../../store/hooks'
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    MemberNotification,
} from '../../store/notifications'
import {getMe} from '../../store/users'
import {IUser} from '../../user'
import BellIcon from '../../widgets/icons/bell'
import IconButton from '../../widgets/buttons/iconButton'
import {Utils} from '../../utils'

import './notificationBell.scss'

const NotificationBell = (): JSX.Element => {
    const [showDropdown, setShowDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const dispatch = useAppDispatch()
    const intl = useIntl()
    const history = useHistory()
    const me = useAppSelector<IUser|null>(getMe)

    const notifications = useAppSelector(getNotifications)
    const unreadCount = useAppSelector(getUnreadCount)

    // Fetch notifications from server on mount and when clicking bell
    useEffect(() => {
        if (me?.id) {
            dispatch(fetchNotifications(50))
        }
    }, [me?.id, dispatch])

    const refreshNotifications = () => {
        if (me?.id) {
            console.log('[NotificationBell] Fetching notifications from server for user:', me.id)
            dispatch(fetchNotifications(50))
        }
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleNotificationClick = (notification: MemberNotification) => {
        // Mark as read on server
        dispatch(markNotificationRead(notification.id))
        
        // Navigate to the card
        if (notification.cardId && notification.boardId) {
            // Close dropdown first
            setShowDropdown(false)
            
            // Navigate to the board with the card open
            // URL format: /board/{boardId}/{viewId}/{cardId}
            // Using 0 as viewId placeholder - router will use default view
            const path = `/board/${notification.boardId}/0/${notification.cardId}`
            history.push(path)
        }
    }

    const handleMarkAllRead = () => {
        // Mark all as read on server
        dispatch(markAllNotificationsRead())
    }

    const handleClearAll = () => {
        dispatch(clearNotifications())
    }

    const getNotificationIcon = (type: MemberNotification['type']): string => {
        switch (type) {
            case 'assigned':
                return '👤'
            case 'unassigned':
                return '🚫'
            case 'mentioned':
                return '💬'
            default:
                return '🔔'
        }
    }

    const getNotificationMessage = (notification: MemberNotification): JSX.Element => {
        switch (notification.type) {
            case 'assigned':
                return (
                    <FormattedMessage
                        id='NotificationBell.youAssigned'
                        defaultMessage='{actorName} added you to "{cardTitle}"'
                        values={{
                            actorName: <strong>{notification.actorName || 'Someone'}</strong>,
                            cardTitle: notification.cardTitle,
                        }}
                    />
                )
            case 'unassigned':
                return (
                    <FormattedMessage
                        id='NotificationBell.youUnassigned'
                        defaultMessage='{actorName} removed you from "{cardTitle}"'
                        values={{
                            actorName: <strong>{notification.actorName || 'Someone'}</strong>,
                            cardTitle: notification.cardTitle,
                        }}
                    />
                )
            case 'mentioned':
                return (
                    <FormattedMessage
                        id='NotificationBell.mentioned'
                        defaultMessage='{actorName} mentioned you in "{cardTitle}"'
                        values={{
                            actorName: <strong>{notification.actorName || 'Someone'}</strong>,
                            cardTitle: notification.cardTitle,
                        }}
                    />
                )
            default:
                return <span>{notification.cardTitle}</span>
        }
    }

    const formatTimestamp = (timestamp: number): string => {
        const now = Date.now()
        const diff = now - timestamp
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) {
            return intl.formatMessage({id: 'NotificationBell.justNow', defaultMessage: 'Just now'})
        } else if (minutes < 60) {
            return intl.formatMessage(
                {id: 'NotificationBell.minutesAgo', defaultMessage: '{count}m ago'},
                {count: minutes}
            )
        } else if (hours < 24) {
            return intl.formatMessage(
                {id: 'NotificationBell.hoursAgo', defaultMessage: '{count}h ago'},
                {count: hours}
            )
        } else {
            return intl.formatMessage(
                {id: 'NotificationBell.daysAgo', defaultMessage: '{count}d ago'},
                {count: days}
            )
        }
    }

    return (
        <div className='NotificationBell' ref={dropdownRef}>
            <div 
                className='notification-bell-button'
                onClick={() => {
                    refreshNotifications()  // Refresh from localStorage when clicking
                    setShowDropdown(!showDropdown)
                }}
                title={intl.formatMessage({id: 'NotificationBell.title', defaultMessage: 'Notifications'})}
            >
                <BellIcon />
                {unreadCount > 0 && (
                    <span className='notification-badge'>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </div>

            {showDropdown && (
                <div className='notification-dropdown'>
                    <div className='notification-header'>
                        <span className='notification-title'>
                            <FormattedMessage
                                id='NotificationBell.notifications'
                                defaultMessage='Notifications'
                            />
                        </span>
                        <div className='notification-actions'>
                            {unreadCount > 0 && (
                                <button
                                    className='mark-all-read'
                                    onClick={handleMarkAllRead}
                                    title={intl.formatMessage({id: 'NotificationBell.markAllRead', defaultMessage: 'Mark all as read'})}
                                >
                                    <FormattedMessage
                                        id='NotificationBell.markAllRead'
                                        defaultMessage='Mark all as read'
                                    />
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    className='clear-all'
                                    onClick={handleClearAll}
                                    title={intl.formatMessage({id: 'NotificationBell.clearAll', defaultMessage: 'Clear all'})}
                                >
                                    <FormattedMessage
                                        id='NotificationBell.clearAll'
                                        defaultMessage='Clear all'
                                    />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className='notification-list'>
                        {notifications.length === 0 ? (
                            <div className='no-notifications'>
                                <span className='empty-icon'>🔔</span>
                                <FormattedMessage
                                    id='NotificationBell.empty'
                                    defaultMessage='No notifications yet'
                                />
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <span className='notification-icon'>
                                        {getNotificationIcon(notification.type)}
                                    </span>
                                    <div className='notification-content'>
                                        <div className='notification-message'>
                                            {getNotificationMessage(notification)}
                                        </div>
                                        <div className='notification-time'>
                                            {formatTimestamp(notification.timestamp)}
                                        </div>
                                    </div>
                                    {!notification.read && (
                                        <span className='unread-dot'></span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificationBell
