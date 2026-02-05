// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useCallback} from 'react'
import ReactDOM from 'react-dom'

import {useAppSelector, useAppDispatch} from '../../store/hooks'
import {getShowToast, getCurrentToast, dismissToast, MemberNotification} from '../../store/notifications'
import UserAvatar from '../userAvatar'

import './memberNotificationToast.scss'

const MemberNotificationToast = (): JSX.Element | null => {
    const dispatch = useAppDispatch()
    const showToast = useAppSelector(getShowToast)
    const currentToast = useAppSelector(getCurrentToast)

    const handleDismiss = useCallback(() => {
        dispatch(dismissToast())
    }, [dispatch])

    // Auto-dismiss after 5 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                handleDismiss()
            }, 5000)
            return () => clearTimeout(timer)
        }
        return undefined
    }, [showToast, handleDismiss])

    if (!showToast || !currentToast) {
        return null
    }

    const getNotificationIcon = (type: MemberNotification['type']): string => {
        switch (type) {
            case 'assigned':
                return '👤'
            case 'unassigned':
                return '👤'
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
                    <>
                        <strong>{notification.actorName || 'Someone'}</strong> menambahkan Anda ke kartu <strong>"{notification.cardTitle}"</strong>
                    </>
                )
            case 'unassigned':
                return (
                    <>
                        <strong>{notification.actorName || 'Someone'}</strong> menghapus Anda dari kartu <strong>"{notification.cardTitle}"</strong>
                    </>
                )
            case 'mentioned':
                return (
                    <>
                        <strong>{notification.actorName || 'Someone'}</strong> menyebut Anda di kartu <strong>"{notification.cardTitle}"</strong>
                    </>
                )
            default:
                return <span>Notifikasi baru</span>
        }
    }

    const toast = (
        <div className={`member-notification-toast ${showToast ? 'show' : ''}`}>
            <div className="toast-content">
                <div className="toast-icon">
                    {getNotificationIcon(currentToast.type)}
                </div>
                <UserAvatar
                    userId={currentToast.targetUserId}
                    name={currentToast.actorName || currentToast.memberName}
                    size='small'
                    className='toast-avatar'
                />
                <div className="toast-message">
                    <div className="toast-title">
                        {currentToast.type === 'assigned' ? 'Anda Ditambahkan' : 
                         currentToast.type === 'unassigned' ? 'Anda Dihapus' : 'Notifikasi'}
                    </div>
                    <div className="toast-text">
                        {getNotificationMessage(currentToast)}
                    </div>
                </div>
                <button 
                    className="toast-close"
                    onClick={handleDismiss}
                    title="Tutup"
                >
                    ×
                </button>
            </div>
            <div className="toast-progress">
                <div className="toast-progress-bar"></div>
            </div>
        </div>
    )

    return ReactDOM.createPortal(toast, document.body)
}

export default MemberNotificationToast
