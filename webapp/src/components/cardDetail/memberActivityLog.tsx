// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo} from 'react'
import {useIntl} from 'react-intl'

import {Card} from '../../blocks/card'
import {Board} from '../../blocks/board'
import CompassIcon from '../../widgets/icons/compassIcon'
import {useAppSelector} from '../../store/hooks'
import {getBoardUsers} from '../../store/users'
import {IUser} from '../../user'
import UserAvatar from '../userAvatar'

import './memberActivityLog.scss'

type Props = {
    card: Card
    board: Board
}

// Helper function to get initials from user
const getInitials = (user: IUser): string => {
    const name = user.nickname || user.username || user.email || ''
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase() || '?'
}

// Helper function to generate color from string
const stringToColor = (str: string): string => {
    const colors = [
        '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#E91E63',
        '#00BCD4', '#795548', '#607D8B', '#FF5722', '#3F51B5',
        '#009688', '#673AB7', '#8BC34A', '#FFC107', '#03A9F4'
    ]
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}

// Format relative time
const formatRelativeTime = (date: Date, intl: ReturnType<typeof useIntl>): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) {
        return intl.formatMessage({id: 'MemberActivity.justNow', defaultMessage: 'just now'})
    } else if (diffMins < 60) {
        return intl.formatMessage({id: 'MemberActivity.minutesAgo', defaultMessage: '{minutes} min ago'}, {minutes: diffMins})
    } else if (diffHours < 24) {
        return intl.formatMessage({id: 'MemberActivity.hoursAgo', defaultMessage: '{hours}h ago'}, {hours: diffHours})
    } else if (diffDays < 7) {
        return intl.formatMessage({id: 'MemberActivity.daysAgo', defaultMessage: '{days}d ago'}, {days: diffDays})
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
}

type ActivityItem = {
    id: string
    type: 'assigned' | 'unassigned' | 'created'
    user: IUser | null
    targetUser?: IUser
    timestamp: Date
}

const MemberActivityLog = ({card, board}: Props): JSX.Element => {
    const intl = useIntl()
    const boardUsersById = useAppSelector<{[key: string]: IUser}>(getBoardUsers)
    const boardUsers = useMemo(() => Object.values(boardUsersById), [boardUsersById])
    
    // Get person property
    const personProperty = useMemo(() => 
        board.cardProperties.find(p => p.type === 'person' || p.type === 'multiPerson'), 
        [board.cardProperties]
    )
    
    // Get currently assigned members
    const assignedMemberIds = useMemo(() => {
        if (!personProperty) return []
        const value = card.fields.properties[personProperty.id]
        if (typeof value === 'string' && value !== '') {
            return [value]
        } else if (Array.isArray(value)) {
            return value as string[]
        }
        return []
    }, [personProperty, card.fields.properties])
    
    // Generate activity log based on current state and timestamps
    // Since we don't have real activity tracking, we simulate based on card data
    const activities = useMemo((): ActivityItem[] => {
        const items: ActivityItem[] = []
        
        // Card creation activity
        items.push({
            id: 'created',
            type: 'created',
            user: boardUsersById[card.createdBy] || null,
            timestamp: new Date(card.createAt)
        })
        
        // Member assignment activities (simulated based on current state)
        // In a real implementation, these would come from an activity log
        assignedMemberIds.forEach((memberId, index) => {
            const targetUser = boardUsersById[memberId]
            if (targetUser) {
                items.push({
                    id: `assigned-${memberId}`,
                    type: 'assigned',
                    user: boardUsersById[card.modifiedBy] || boardUsersById[card.createdBy] || null,
                    targetUser,
                    // Simulate timestamp slightly after creation or update
                    timestamp: new Date(card.updateAt - (index * 60000)) // Each 1 min apart
                })
            }
        })
        
        // Sort by timestamp, newest first
        items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        
        return items
    }, [card, assignedMemberIds, boardUsersById])

    const renderActivityItem = (activity: ActivityItem) => {
        const userName = activity.user 
            ? (activity.user.nickname || activity.user.username || 'Someone')
            : intl.formatMessage({id: 'MemberActivity.someone', defaultMessage: 'Someone'})
        
        return (
            <div key={activity.id} className='activity-item'>
                <UserAvatar
                    userId={activity.user?.id || ''}
                    name={userName}
                    size='medium'
                    className='activity-avatar'
                />
                <div className='activity-content'>
                    <div className='activity-text'>
                        {activity.type === 'created' && (
                            <>
                                <strong>{userName}</strong>
                                {' '}
                                {intl.formatMessage({id: 'MemberActivity.createdCard', defaultMessage: 'created this card'})}
                            </>
                        )}
                        {activity.type === 'assigned' && activity.targetUser && (
                            <>
                                <strong>{userName}</strong>
                                {' '}
                                {intl.formatMessage({id: 'MemberActivity.assigned', defaultMessage: 'assigned'})}
                                {' '}
                                <strong>{activity.targetUser.nickname || activity.targetUser.username}</strong>
                                {' '}
                                {intl.formatMessage({id: 'MemberActivity.toThisCard', defaultMessage: 'to this card'})}
                            </>
                        )}
                        {activity.type === 'unassigned' && activity.targetUser && (
                            <>
                                <strong>{userName}</strong>
                                {' '}
                                {intl.formatMessage({id: 'MemberActivity.unassigned', defaultMessage: 'removed'})}
                                {' '}
                                <strong>{activity.targetUser.nickname || activity.targetUser.username}</strong>
                                {' '}
                                {intl.formatMessage({id: 'MemberActivity.fromThisCard', defaultMessage: 'from this card'})}
                            </>
                        )}
                    </div>
                    <div className='activity-time'>
                        {formatRelativeTime(activity.timestamp, intl)}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className='MemberActivityLog'>
            <div className='activity-header'>
                <CompassIcon icon='history'/>
                <span>{intl.formatMessage({id: 'MemberActivity.memberActivity', defaultMessage: 'Member Activity'})}</span>
            </div>
            <div className='activity-list'>
                {activities.length > 0 ? (
                    activities.map(renderActivityItem)
                ) : (
                    <div className='no-activity'>
                        {intl.formatMessage({id: 'MemberActivity.noActivity', defaultMessage: 'No member activity yet'})}
                    </div>
                )}
            </div>
        </div>
    )
}

export default MemberActivityLog
