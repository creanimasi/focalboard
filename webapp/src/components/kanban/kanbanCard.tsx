// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react'
import ReactDOM from 'react-dom'
import {useIntl} from 'react-intl'

import {Board, IPropertyTemplate, PropertyTypeEnum} from '../../blocks/board'
import {Card} from '../../blocks/card'
import {useSortable} from '../../hooks/sortable'
import mutator from '../../mutator'
import octoClient from '../../octoClient'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from '../../telemetry/telemetryClient'
import {Utils, IDType} from '../../utils'
import MenuWrapper from '../../widgets/menuWrapper'
import Tooltip from '../../widgets/tooltip'
import PropertyValueElement from '../propertyValueElement'
import ConfirmationDialogBox, {ConfirmationDialogBoxProps} from '../confirmationDialogBox'
import './kanbanCard.scss'
import CardBadges from '../cardBadges'
import CardActionsMenu from '../cardActionsMenu/cardActionsMenu'
import CardActionsMenuIcon from '../cardActionsMenu/cardActionsMenuIcon'
import CompassIcon from '../../widgets/icons/compassIcon'
import {useAppSelector, useAppDispatch} from '../../store/hooks'
import {getBoardUsers, getMe} from '../../store/users'
import {IUser} from '../../user'
import {BoardView} from '../../blocks/boardView'
import {createServerNotification} from '../../store/notifications'
import UserAvatar from '../userAvatar'

export const OnboardingCardClassName = 'onboardingCard'

// Trello-like label colors mapping
const labelColorMap: Record<string, string> = {
    'propColorDefault': '#b3bac5',
    'propColorGray': '#b3bac5',
    'propColorBrown': '#d29034',
    'propColorOrange': '#ff9f1a',
    'propColorYellow': '#f2d600',
    'propColorGreen': '#61bd4f',
    'propColorBlue': '#0079bf',
    'propColorPurple': '#c377e0',
    'propColorPink': '#ff78cb',
    'propColorRed': '#eb5a46',
}

type Props = {
    card: Card
    board: Board
    activeView?: BoardView
    visiblePropertyTemplates: IPropertyTemplate[]
    isSelected: boolean
    visibleBadges: boolean
    onClick?: (e: React.MouseEvent, card: Card) => void
    readonly: boolean
    onDrop: (srcCard: Card, dstCard: Card) => void
    showCard: (cardId?: string) => void
    isManualSort: boolean
}

const KanbanCard = (props: Props) => {
    const {card, board} = props
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const [isDragging, isOver, cardRef] = useSortable('card', card, !props.readonly, props.onDrop)
    const visiblePropertyTemplates = props.visiblePropertyTemplates || []
    let className = props.isSelected ? 'KanbanCard selected' : 'KanbanCard'
    if (props.isManualSort && isOver) {
        className += ' dragover'
    }

    // Quick Assign state
    const [showQuickAssign, setShowQuickAssign] = useState(false)
    const [quickAssignSearch, setQuickAssignSearch] = useState('')
    const quickAssignRef = useRef<HTMLButtonElement>(null)
    const quickAssignPopupRef = useRef<HTMLDivElement>(null)

    // Get current user
    const me = useAppSelector(getMe)

    // Get board users for member display (getBoardUsers returns Record<string, IUser>)
    const boardUsersMap = useAppSelector(getBoardUsers)
    const boardUsers = useMemo(() => Object.values(boardUsersMap), [boardUsersMap])

    // Cover image state
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)

    // Get date property for deadline
    const dateProperty = useMemo(() => board.cardProperties.find(p => p.type === 'date'), [board.cardProperties])
    const deadlineValue = useMemo(() => {
        if (!dateProperty) return null
        const value = card.fields.properties[dateProperty.id]
        if (!value) return null
        try {
            const dateObj = JSON.parse(value as string)
            if (dateObj.from) {
                return new Date(dateObj.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
        } catch {
            // Not JSON, try as timestamp
            const timestamp = parseInt(value as string, 10)
            if (!isNaN(timestamp)) {
                return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
        }
        return null
    }, [dateProperty, card.fields.properties])

    // Get members (person/multiPerson property)
    const personProperty = useMemo(() => board.cardProperties.find(p => p.type === 'person' || p.type === 'multiPerson'), [board.cardProperties])
    const assignedMembers = useMemo(() => {
        if (!personProperty) return []
        const value = card.fields.properties[personProperty.id]
        if (!value) return []
        const memberIds = Array.isArray(value) ? value : [value]
        return memberIds.map(id => boardUsers.find(u => u.id === id)).filter(Boolean) as IUser[]
    }, [personProperty, card.fields.properties, boardUsers])

    // Helper to get initials
    const getInitials = (user: IUser) => {
        const name = user.nickname || user.username || user.email || ''
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
    }

    // Helper to generate color from string
    const stringToColor = (str: string) => {
        const colors = ['#0079bf', '#d29034', '#519839', '#b04632', '#89609e', '#cd5a91', '#4bbf6b', '#00aecc']
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        return colors[Math.abs(hash) % colors.length]
    }

    // Quick Assign functions
    const getAssignedMemberIds = useCallback((): string[] => {
        if (!personProperty) return []
        const value = card.fields.properties[personProperty.id]
        if (typeof value === 'string' && value !== '') {
            return [value]
        } else if (Array.isArray(value)) {
            return value as string[]
        }
        return []
    }, [personProperty, card.fields.properties])

    const toggleQuickAssign = useCallback(async (userId: string) => {
        let prop = personProperty
        if (!prop) {
            // Create person property if it doesn't exist
            if (!props.activeView) return
            const template: IPropertyTemplate = {
                id: Utils.createGuid(IDType.BlockID),
                name: 'Assigned',
                type: 'multiPerson' as PropertyTypeEnum,
                options: [],
            }
            await mutator.insertPropertyTemplate(board, props.activeView, -1, template)
            return
        }
        
        const isMulti = prop.type === 'multiPerson'
        const currentMembers = getAssignedMemberIds()
        const isRemoving = currentMembers.includes(userId)
        
        let newValue: string | string[]
        if (isMulti) {
            if (isRemoving) {
                newValue = currentMembers.filter(id => id !== userId)
            } else {
                newValue = [...currentMembers, userId]
            }
        } else {
            if (isRemoving) {
                newValue = ''
            } else {
                newValue = userId
            }
        }
        
        await mutator.changePropertyValue(board.id, card, prop.id, newValue)
        setShowQuickAssign(false)
        
        // Send notification to the affected user (not to yourself)
        const user = boardUsersMap[userId]
        if (user && me && userId !== me.id) {
            const myDisplayName = me.nickname || me.username || me.email || 'Someone'
            
            // Create notification on server (server will broadcast via WebSocket)
            dispatch(createServerNotification({
                targetUserId: userId,
                actorUserId: me.id,
                actorName: myDisplayName,
                type: isRemoving ? 'unassigned' : 'assigned',
                cardId: card.id,
                cardTitle: card.title || 'Untitled',
                boardId: board.id,
            }))
        }
    }, [board, card, personProperty, props.activeView, getAssignedMemberIds, boardUsersMap, dispatch, me])

    const filteredUsersForQuickAssign = useMemo(() => {
        return boardUsers.filter(user => {
            const searchLower = quickAssignSearch.toLowerCase()
            return (
                user.username?.toLowerCase().includes(searchLower) ||
                user.nickname?.toLowerCase().includes(searchLower) ||
                user.email?.toLowerCase().includes(searchLower)
            )
        })
    }, [boardUsers, quickAssignSearch])

    // Close quick assign on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                quickAssignPopupRef.current && 
                !quickAssignPopupRef.current.contains(event.target as Node) &&
                quickAssignRef.current &&
                !quickAssignRef.current.contains(event.target as Node)
            ) {
                setShowQuickAssign(false)
                setQuickAssignSearch('')
            }
        }
        
        if (showQuickAssign) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showQuickAssign])

    // Get quick assign popup position
    const getQuickAssignPosition = useCallback(() => {
        if (!quickAssignRef.current) return {top: 0, left: 0}
        const rect = quickAssignRef.current.getBoundingClientRect()
        return {
            top: rect.bottom + 4,
            left: Math.min(rect.left, window.innerWidth - 220)
        }
    }, [])

    // Load cover image when card has coverFileId
    useEffect(() => {
        const loadCoverImage = async () => {
            if (card.fields.coverFileId) {
                try {
                    const fileInfo = await octoClient.getFileAsDataUrl(board.id, card.fields.coverFileId)
                    if (fileInfo.url) {
                        setCoverImageUrl(fileInfo.url)
                    }
                } catch (e) {
                    Utils.logError(`Failed to load cover image: ${e}`)
                }
            } else {
                setCoverImageUrl(null)
            }
        }
        loadCoverImage()
    }, [card.fields.coverFileId, board.id])

    const [showConfirmationDialogBox, setShowConfirmationDialogBox] = useState<boolean>(false)
    const handleDeleteCard = useCallback(() => {
        if (!card) {
            Utils.assertFailure()
            return
        }
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DeleteCard, {board: board.id, card: card.id})
        mutator.deleteBlock(card, 'delete card')
    }, [card, board.id])

    const confirmDialogProps: ConfirmationDialogBoxProps = useMemo(() => {
        return {
            heading: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-heading', defaultMessage: 'Confirm card delete!'}),
            confirmButtonText: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-button-text', defaultMessage: 'Delete'}),
            onConfirm: handleDeleteCard,
            onClose: () => {
                setShowConfirmationDialogBox(false)
            },
        }
    }, [handleDeleteCard])

    const handleDeleteButtonOnClick = useCallback(() => {
        // user trying to delete a card with blank name
        // but content present cannot be deleted without
        // confirmation dialog
        if (card?.title === '' && card?.fields?.contentOrder?.length === 0) {
            handleDeleteCard()
            return
        }
        setShowConfirmationDialogBox(true)
    }, [handleDeleteCard, card.title, card?.fields?.contentOrder?.length])

    const handleOnClick = useCallback((e: React.MouseEvent) => {
        if (props.onClick) {
            props.onClick(e, card)
        }
    }, [props.onClick, card])

    // Get select/multiSelect properties for label strips
    const labelTemplates = useMemo(() => {
        return visiblePropertyTemplates.filter(
            (t) => t.type === 'select' || t.type === 'multiSelect'
        )
    }, [visiblePropertyTemplates])

    // Get other properties (non-label)
    const otherTemplates = useMemo(() => {
        return visiblePropertyTemplates.filter(
            (t) => t.type !== 'select' && t.type !== 'multiSelect'
        )
    }, [visiblePropertyTemplates])

    // Extract label colors for strip display
    const cardLabels = useMemo(() => {
        const labels: {id: string, color: string}[] = []
        labelTemplates.forEach((template) => {
            const value = card.fields.properties[template.id]
            if (value) {
                const values = Array.isArray(value) ? value : [value]
                values.forEach((v) => {
                    const option = template.options?.find((o) => o.id === v)
                    if (option) {
                        const colorClass = `propColor${option.color?.charAt(0).toUpperCase()}${option.color?.slice(1) || 'Default'}`
                        labels.push({
                            id: option.id,
                            color: labelColorMap[colorClass] || labelColorMap['propColorDefault']
                        })
                    }
                })
            }
        })
        return labels
    }, [card.fields.properties, labelTemplates])

    return (
        <>
            <div
                ref={props.readonly ? () => null : cardRef}
                className={`${className}${coverImageUrl ? ' has-cover' : ''}`}
                draggable={!props.readonly}
                style={{opacity: isDragging ? 0.5 : 1}}
                onClick={handleOnClick}
            >
                {/* Cover Image - Trello style */}
                {coverImageUrl && (
                    <div className='kanban-card-cover'>
                        <img 
                            src={coverImageUrl} 
                            alt='Card cover'
                            draggable={false}
                        />
                    </div>
                )}

                {!props.readonly &&
                <MenuWrapper
                    className={'optionsMenu'}
                    stopPropagationOnToggle={true}
                >
                    <CardActionsMenuIcon/>
                    <CardActionsMenu
                        cardId={card!.id}
                        boardId={card!.boardId}
                        onClickDelete={handleDeleteButtonOnClick}
                        onClickDuplicate={() => {
                            TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DuplicateCard, {board: board.id, card: card.id})
                            mutator.duplicateCard(
                                card.id,
                                board.id,
                                false,
                                'duplicate card',
                                false,
                                {},
                                async (newCardId) => {
                                    props.showCard(newCardId)
                                },
                                async () => {
                                    props.showCard(undefined)
                                },
                            )
                        }}
                    />
                </MenuWrapper>
                }

                {/* Trello-style label strips at top */}
                {cardLabels.length > 0 && (
                    <div className='kanban-card-labels'>
                        {cardLabels.map((label) => (
                            <div
                                key={label.id}
                                className='kanban-label'
                                style={{backgroundColor: label.color}}
                            />
                        ))}
                    </div>
                )}

                {/* Main card content */}
                <div className='kanban-card-content'>
                    <div className='octo-icontitle'>
                        <div
                            key='__title'
                            className='octo-titletext'
                        >
                            {card.title || intl.formatMessage({id: 'KanbanCard.untitled', defaultMessage: 'Untitled'})}
                        </div>
                    </div>

                    {/* Other properties (non-select) */}
                    {otherTemplates.length > 0 && (
                        <div className='kanban-card-properties'>
                            {otherTemplates.map((template) => (
                                <Tooltip
                                    key={template.id}
                                    title={template.name}
                                >
                                    <PropertyValueElement
                                        board={board}
                                        readOnly={true}
                                        card={card}
                                        propertyTemplate={template}
                                        showEmptyPlaceholder={false}
                                    />
                                </Tooltip>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with deadline and members */}
                {(deadlineValue || assignedMembers.length > 0 || props.visibleBadges || !props.readonly) && (
                    <div className='kanban-card-footer'>
                        <div className='footer-left'>
                            {/* Deadline */}
                            {deadlineValue && (
                                <div className='card-deadline'>
                                    <CompassIcon icon='clock-outline'/>
                                    <span>{deadlineValue}</span>
                                </div>
                            )}
                            {/* Badges */}
                            {props.visibleBadges && <CardBadges card={card}/>}
                        </div>
                        <div className='footer-right'>
                            {/* Quick Assign Button */}
                            {!props.readonly && (
                                <button 
                                    ref={quickAssignRef}
                                    className='quick-assign-btn'
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setShowQuickAssign(!showQuickAssign)
                                    }}
                                    title={intl.formatMessage({id: 'KanbanCard.assignMember', defaultMessage: 'Assign member'})}
                                >
                                    <CompassIcon icon='account-plus-outline'/>
                                </button>
                            )}
                            {/* Members avatars */}
                            {assignedMembers.length > 0 && (
                                <div className='card-members'>
                                    {assignedMembers.slice(0, 3).map((member) => (
                                        <Tooltip key={member.id} title={member.nickname || member.username || member.email || ''}>
                                            <UserAvatar
                                                userId={member.id}
                                                name={member.nickname || member.username}
                                                size='small'
                                                className='member-avatar'
                                            />
                                        </Tooltip>
                                    ))}
                                    {assignedMembers.length > 3 && (
                                        <div className='member-avatar more'>
                                            +{assignedMembers.length - 3}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Quick Assign Popup */}
                {showQuickAssign && ReactDOM.createPortal(
                    <div 
                        ref={quickAssignPopupRef}
                        className='quick-assign-popup'
                        style={{
                            position: 'fixed',
                            top: getQuickAssignPosition().top,
                            left: getQuickAssignPosition().left,
                            zIndex: 10000
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className='quick-assign-header'>
                            {intl.formatMessage({id: 'KanbanCard.assignMember', defaultMessage: 'Assign member'})}
                        </div>
                        <input
                            type='text'
                            className='quick-assign-search'
                            placeholder={intl.formatMessage({id: 'KanbanCard.searchMembers', defaultMessage: 'Search...'})}
                            value={quickAssignSearch}
                            onChange={(e) => setQuickAssignSearch(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className='quick-assign-list'>
                            {filteredUsersForQuickAssign.map(user => {
                                const displayName = user.nickname || user.username || user.email || 'Unknown'
                                const isAssigned = getAssignedMemberIds().includes(user.id)
                                return (
                                    <div 
                                        key={user.id}
                                        className={`quick-assign-item ${isAssigned ? 'assigned' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleQuickAssign(user.id)
                                        }}
                                    >
                                        <UserAvatar
                                            userId={user.id}
                                            name={displayName}
                                            size='small'
                                            className='member-avatar'
                                        />
                                        <span className='member-name'>{displayName}</span>
                                        {isAssigned && <CompassIcon icon='check' className='check-icon'/>}
                                    </div>
                                )
                            })}
                            {filteredUsersForQuickAssign.length === 0 && (
                                <div className='quick-assign-empty'>
                                    {intl.formatMessage({id: 'KanbanCard.noMembers', defaultMessage: 'No members found'})}
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {showConfirmationDialogBox && <ConfirmationDialogBox dialogBox={confirmDialogProps}/>}

        </>
    )
}

export default React.memo(KanbanCard)
