// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useCallback, useRef, useEffect} from 'react'
import ReactDOM from 'react-dom'
import {useIntl} from 'react-intl'

import {Board, IPropertyOption, IPropertyTemplate, PropertyTypeEnum} from '../../blocks/board'
import {Card} from '../../blocks/card'
import {BoardView} from '../../blocks/boardView'
import mutator from '../../mutator'
import {Utils, IDType} from '../../utils'
import CompassIcon from '../../widgets/icons/compassIcon'
import Label from '../../widgets/label'
import {Constants} from '../../constants'
import {useAppSelector, useAppDispatch} from '../../store/hooks'
import {getBoardUsers, getMe} from '../../store/users'
import {IUser} from '../../user'
import {createServerNotification} from '../../store/notifications'
import UserAvatar from '../userAvatar'

import './trelloPopups.scss'

// Shared popup wrapper component
type PopupWrapperProps = {
    title: string
    onClose: () => void
    children: React.ReactNode
    anchorRef: React.RefObject<HTMLButtonElement>
}

const PopupWrapper = ({title, onClose, children, anchorRef}: PopupWrapperProps) => {
    const popupRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<{top: number, left: number} | null>(null)
    const positionCalculated = useRef(false)

    useEffect(() => {
        const calculatePosition = () => {
            // Only calculate position once when popup opens
            if (positionCalculated.current) return
            
            if (anchorRef.current) {
                const rect = anchorRef.current.getBoundingClientRect()
                const popupWidth = 320 // popup width
                const popupHeight = 400 // estimated popup height
                
                // Calculate initial position
                let top = rect.bottom + 8
                let left = rect.left

                // Ensure popup doesn't go off the right edge
                if (left + popupWidth > window.innerWidth - 20) {
                    left = window.innerWidth - popupWidth - 20
                }

                // Ensure popup doesn't go off the left edge
                if (left < 20) {
                    left = 20
                }

                // If popup would go below viewport, show it above the anchor
                if (top + popupHeight > window.innerHeight - 20) {
                    top = rect.top - popupHeight - 8
                    // If still doesn't fit, just position at top of viewport
                    if (top < 20) {
                        top = 20
                    }
                }

                setPosition({top, left})
                positionCalculated.current = true
            } else {
                // Fallback: center in viewport
                setPosition({
                    top: window.innerHeight / 2 - 200,
                    left: window.innerWidth / 2 - 160
                })
                positionCalculated.current = true
            }
        }

        // Small delay to ensure ref is attached
        const timer = setTimeout(calculatePosition, 10)

        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        
        return () => {
            clearTimeout(timer)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [onClose, anchorRef])

    // Don't render until we have a position
    if (!position) {
        return null
    }

    const popupContent = (
        <div 
            className='trello-popup-overlay'
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div 
                className='trello-popup'
                ref={popupRef}
                style={{position: 'fixed', top: position.top, left: position.left}}
            >
                <div className='popup-header'>
                    <span className='popup-title'>{title}</span>
                    <button className='popup-close' onClick={onClose}>
                        <CompassIcon icon='close'/>
                    </button>
                </div>
                <div className='popup-content'>
                    {children}
                </div>
            </div>
        </div>
    )

    // Use portal to render outside of any transform containers
    return ReactDOM.createPortal(popupContent, document.body)
}

// Labels Popup
type LabelsPopupProps = {
    board: Board
    card: Card
    activeView: BoardView
    onClose: () => void
    anchorRef: React.RefObject<HTMLButtonElement>
}

export const LabelsPopup = ({board, card, activeView, onClose, anchorRef}: LabelsPopupProps) => {
    const intl = useIntl()
    const [searchText, setSearchText] = useState('')
    const [showMore, setShowMore] = useState(false)

    // Find or create multiSelect property for labels
    const labelProperty = board.cardProperties.find(p => p.type === 'multiSelect')
    const cardLabels = labelProperty ? 
        (Array.isArray(card.fields.properties[labelProperty.id]) 
            ? card.fields.properties[labelProperty.id] as string[]
            : []) 
        : []

    const filteredOptions = labelProperty?.options.filter(opt => 
        opt.value.toLowerCase().includes(searchText.toLowerCase())
    ) || []

    const displayOptions = showMore ? filteredOptions : filteredOptions.slice(0, 6)

    const toggleLabel = useCallback(async (optionId: string) => {
        if (!labelProperty) return
        
        const newLabels = cardLabels.includes(optionId)
            ? cardLabels.filter(id => id !== optionId)
            : [...cardLabels, optionId]
        
        await mutator.changePropertyValue(board.id, card, labelProperty.id, newLabels)
    }, [board.id, card, labelProperty, cardLabels])

    const createLabel = useCallback(async () => {
        if (!searchText.trim()) return
        
        let propTemplate = labelProperty
        
        // Create property if doesn't exist
        if (!propTemplate) {
            const template: IPropertyTemplate = {
                id: Utils.createGuid(IDType.BlockID),
                name: 'Labels',
                type: 'multiSelect' as PropertyTypeEnum,
                options: [],
            }
            await mutator.insertPropertyTemplate(board, activeView, -1, template)
            return // Property will be created, user needs to try again
        }
        
        // Create new option
        const newOption: IPropertyOption = {
            id: Utils.createGuid(IDType.BlockID),
            value: searchText.trim(),
            color: 'propColorDefault',
        }
        
        await mutator.insertPropertyOption(board.id, board.cardProperties, propTemplate, newOption, 'add label')
        setSearchText('')
    }, [searchText, board, activeView, labelProperty])

    const changeOptionColor = useCallback(async (option: IPropertyOption, colorId: string) => {
        if (!labelProperty) return
        await mutator.changePropertyOptionColor(board.id, board.cardProperties, labelProperty, option, colorId)
    }, [board, labelProperty])

    return (
        <PopupWrapper title={intl.formatMessage({id: 'TrelloPopup.labels', defaultMessage: 'Labels'})} onClose={onClose} anchorRef={anchorRef}>
            <input
                type='text'
                className='popup-search'
                placeholder={intl.formatMessage({id: 'TrelloPopup.searchLabels', defaultMessage: 'Search labels...'})}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                autoFocus
            />
            
            <div className='popup-section-title'>
                {intl.formatMessage({id: 'TrelloPopup.labelsTitle', defaultMessage: 'Labels'})}
            </div>
            
            <div className='labels-list'>
                {displayOptions.map((option) => (
                    <div key={option.id} className='label-item'>
                        <input
                            type='checkbox'
                            checked={cardLabels.includes(option.id)}
                            onChange={() => toggleLabel(option.id)}
                        />
                        <div 
                            className='label-color-bar'
                            style={{backgroundColor: `var(--${option.color})`}}
                            onClick={() => toggleLabel(option.id)}
                        >
                            <Label color={option.color}>{option.value}</Label>
                        </div>
                        <button 
                            className='label-edit-btn'
                            onClick={(e) => {
                                e.stopPropagation()
                                // TODO: Open color picker
                            }}
                        >
                            <CompassIcon icon='pencil-outline'/>
                        </button>
                    </div>
                ))}
                
                {filteredOptions.length === 0 && !searchText && (
                    <div className='empty-labels'>
                        {intl.formatMessage({id: 'TrelloPopup.noLabels', defaultMessage: 'No labels yet'})}
                    </div>
                )}
            </div>

            <button className='popup-action-btn' onClick={createLabel}>
                {intl.formatMessage({id: 'TrelloPopup.createLabel', defaultMessage: 'Create a new label'})}
            </button>

            {filteredOptions.length > 6 && (
                <button className='popup-action-btn' onClick={() => setShowMore(!showMore)}>
                    {showMore 
                        ? intl.formatMessage({id: 'TrelloPopup.showLess', defaultMessage: 'Show less labels'})
                        : intl.formatMessage({id: 'TrelloPopup.showMore', defaultMessage: 'Show more labels'})
                    }
                </button>
            )}
        </PopupWrapper>
    )
}

// Dates Popup (simplified version)
type DatesPopupProps = {
    board: Board
    card: Card
    activeView: BoardView
    onClose: () => void
    anchorRef: React.RefObject<HTMLButtonElement>
}

export const DatesPopup = ({board, card, activeView, onClose, anchorRef}: DatesPopupProps) => {
    const intl = useIntl()
    const [dueDate, setDueDate] = useState('')
    const [dueTime, setDueTime] = useState('12:00')
    
    // Find date property
    const dateProperty = board.cardProperties.find(p => p.type === 'date')
    
    const saveDate = useCallback(async () => {
        let propTemplate = dateProperty
        
        // Create property if doesn't exist
        if (!propTemplate) {
            const template: IPropertyTemplate = {
                id: Utils.createGuid(IDType.BlockID),
                name: 'Due Date',
                type: 'date' as PropertyTypeEnum,
                options: [],
            }
            await mutator.insertPropertyTemplate(board, activeView, -1, template)
            onClose()
            return
        }
        
        if (dueDate) {
            const dateValue = {
                from: new Date(`${dueDate}T${dueTime}`).getTime(),
            }
            await mutator.changePropertyValue(board.id, card, propTemplate.id, JSON.stringify(dateValue))
        }
        onClose()
    }, [board, card, activeView, dateProperty, dueDate, dueTime, onClose])

    const removeDate = useCallback(async () => {
        if (dateProperty) {
            await mutator.changePropertyValue(board.id, card, dateProperty.id, '')
        }
        onClose()
    }, [board.id, card, dateProperty, onClose])

    // Initialize with existing date
    useEffect(() => {
        if (dateProperty && card.fields.properties[dateProperty.id]) {
            try {
                const dateVal = JSON.parse(card.fields.properties[dateProperty.id] as string)
                if (dateVal.from) {
                    const d = new Date(dateVal.from)
                    setDueDate(d.toISOString().split('T')[0])
                    setDueTime(d.toTimeString().slice(0, 5))
                }
            } catch (e) {
                // Invalid date
            }
        }
    }, [dateProperty, card])

    return (
        <PopupWrapper title={intl.formatMessage({id: 'TrelloPopup.dates', defaultMessage: 'Dates'})} onClose={onClose} anchorRef={anchorRef}>
            <div className='date-section'>
                <label className='date-label'>
                    {intl.formatMessage({id: 'TrelloPopup.dueDate', defaultMessage: 'Due date'})}
                </label>
                <div className='date-inputs'>
                    <input
                        type='date'
                        className='date-input'
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                    />
                    <input
                        type='time'
                        className='time-input'
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                    />
                </div>
            </div>

            <button className='popup-save-btn' onClick={saveDate}>
                {intl.formatMessage({id: 'TrelloPopup.save', defaultMessage: 'Save'})}
            </button>
            
            {dateProperty && card.fields.properties[dateProperty.id] && (
                <button className='popup-remove-btn' onClick={removeDate}>
                    {intl.formatMessage({id: 'TrelloPopup.remove', defaultMessage: 'Remove'})}
                </button>
            )}
        </PopupWrapper>
    )
}

// Checklist Popup
type ChecklistPopupProps = {
    board: Board
    card: Card
    activeView: BoardView
    onClose: () => void
    anchorRef: React.RefObject<HTMLButtonElement>
}

export const ChecklistPopup = ({board, card, activeView, onClose, anchorRef}: ChecklistPopupProps) => {
    const intl = useIntl()
    const [title, setTitle] = useState('Checklist')
    
    const addChecklist = useCallback(async () => {
        // Create checkbox property if doesn't exist
        const checkboxProperty = board.cardProperties.find(p => p.type === 'checkbox')
        
        if (!checkboxProperty) {
            const template: IPropertyTemplate = {
                id: Utils.createGuid(IDType.BlockID),
                name: title || 'Checklist',
                type: 'checkbox' as PropertyTypeEnum,
                options: [],
            }
            await mutator.insertPropertyTemplate(board, activeView, -1, template)
        }
        onClose()
    }, [board, activeView, title, onClose])

    return (
        <PopupWrapper title={intl.formatMessage({id: 'TrelloPopup.addChecklist', defaultMessage: 'Add checklist'})} onClose={onClose} anchorRef={anchorRef}>
            <div className='checklist-section'>
                <label className='input-label'>
                    {intl.formatMessage({id: 'TrelloPopup.title', defaultMessage: 'Title'})}
                </label>
                <input
                    type='text'
                    className='popup-input'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                />
            </div>

            <button className='popup-save-btn' onClick={addChecklist}>
                {intl.formatMessage({id: 'TrelloPopup.add', defaultMessage: 'Add'})}
            </button>
        </PopupWrapper>
    )
}

// Helper function to generate initials from name
const getInitials = (name: string): string => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
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

// Members Popup
type MembersPopupProps = {
    board: Board
    card: Card
    activeView: BoardView
    onClose: () => void
    anchorRef: React.RefObject<HTMLButtonElement>
}

export const MembersPopup = ({board, card, activeView, onClose, anchorRef}: MembersPopupProps) => {
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const [searchText, setSearchText] = useState('')
    
    // Get current user
    const me = useAppSelector(getMe)
    
    // Get board users from store
    const boardUsersById = useAppSelector<{[key: string]: IUser}>(getBoardUsers)
    const boardUsers = Object.values(boardUsersById)
    
    // Find person/multiPerson property
    const personProperty = board.cardProperties.find(p => p.type === 'person' || p.type === 'multiPerson')
    
    // Get currently assigned members from card
    const getAssignedMembers = (): string[] => {
        if (!personProperty) return []
        const value = card.fields.properties[personProperty.id]
        if (typeof value === 'string' && value !== '') {
            return [value]
        } else if (Array.isArray(value)) {
            return value as string[]
        }
        return []
    }
    
    const [selectedMembers, setSelectedMembers] = useState<string[]>(getAssignedMembers())
    
    // Get full user objects for assigned members
    const assignedUsers = selectedMembers.map(id => boardUsersById[id]).filter(Boolean)
    
    // Filter non-assigned members for the list
    const filteredMembers = boardUsers.filter(user => {
        const matchesSearch = (
            user.username?.toLowerCase().includes(searchText.toLowerCase()) ||
            user.nickname?.toLowerCase().includes(searchText.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchText.toLowerCase())
        )
        return matchesSearch
    })
    
    const toggleMember = useCallback(async (userId: string) => {
        if (!personProperty) {
            // Create person property if it doesn't exist
            const template: IPropertyTemplate = {
                id: Utils.createGuid(IDType.BlockID),
                name: 'Assigned',
                type: 'multiPerson' as PropertyTypeEnum,
                options: [],
            }
            await mutator.insertPropertyTemplate(board, activeView, -1, template)
            return
        }
        
        const isMulti = personProperty.type === 'multiPerson'
        const currentMembers = getAssignedMembers()
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
        
        await mutator.changePropertyValue(board.id, card, personProperty.id, newValue)
        setSelectedMembers(Array.isArray(newValue) ? newValue : (newValue ? [newValue] : []))
        
        // Send notification to the affected user (not to yourself)
        // Only send notification if the action is done by someone else to this user
        const user = boardUsersById[userId]
        if (user && me && userId !== me.id) {
            // This notification is for the user being added/removed
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
    }, [board, card, personProperty, activeView, boardUsersById, dispatch, me])

    return (
        <PopupWrapper title={intl.formatMessage({id: 'TrelloPopup.members', defaultMessage: 'Members'})} onClose={onClose} anchorRef={anchorRef}>
            <input
                type='text'
                className='popup-search'
                placeholder={intl.formatMessage({id: 'TrelloPopup.searchMembers', defaultMessage: 'Search members...'})}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                autoFocus
            />
            
            {/* Assigned members section */}
            {assignedUsers.length > 0 && (
                <>
                    <div className='popup-section-title'>
                        {intl.formatMessage({id: 'TrelloPopup.cardMembers', defaultMessage: 'Card members'})}
                    </div>
                    <div className='assigned-members'>
                        {assignedUsers.map(user => {
                            const displayName = user.nickname || user.username || user.email || 'Unknown'
                            const initials = getInitials(displayName)
                            const color = stringToColor(user.id)
                            
                            return (
                                <div key={user.id} className='assigned-member'>
                                    <UserAvatar
                                        userId={user.id}
                                        name={displayName}
                                        size='medium'
                                        className='member-avatar'
                                    />
                                    <div className='member-info'>
                                        <span className='member-name'>{displayName}</span>
                                        {user.username && user.username !== displayName && (
                                            <span className='member-username'>@{user.username}</span>
                                        )}
                                    </div>
                                    <button 
                                        className='remove-member-btn'
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleMember(user.id)
                                        }}
                                        title={intl.formatMessage({id: 'TrelloPopup.removeMember', defaultMessage: 'Remove from card'})}
                                    >
                                        <CompassIcon icon='close'/>
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
            
            <div className='popup-section-title'>
                {intl.formatMessage({id: 'TrelloPopup.boardMembers', defaultMessage: 'Board members'})}
            </div>
            
            <div className='members-list'>
                {filteredMembers.length > 0 ? (
                    filteredMembers.map(user => {
                        const displayName = user.nickname || user.username || user.email || 'Unknown'
                        const initials = getInitials(displayName)
                        const color = stringToColor(user.id)
                        const isSelected = selectedMembers.includes(user.id)
                        
                        return (
                            <div 
                                key={user.id} 
                                className={`member-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleMember(user.id)}
                            >
                                <UserAvatar
                                    userId={user.id}
                                    name={displayName}
                                    size='medium'
                                    className='member-avatar'
                                />
                                <div className='member-info'>
                                    <span className='member-name'>{displayName}</span>
                                    {user.username && user.username !== displayName && (
                                        <span className='member-username'>@{user.username}</span>
                                    )}
                                </div>
                                {isSelected && (
                                    <CompassIcon icon='check' className='member-check'/>
                                )}
                            </div>
                        )
                    })
                ) : (
                    <div className='empty-members'>
                        {boardUsers.length === 0 ? (
                            <>
                                <CompassIcon icon='account-multiple-outline' className='empty-icon'/>
                                <p>{intl.formatMessage({id: 'TrelloPopup.noBoardMembers', defaultMessage: 'No board members yet'})}</p>
                                <span className='empty-hint'>{intl.formatMessage({id: 'TrelloPopup.inviteHint', defaultMessage: 'Invite members to this board to assign them to cards'})}</span>
                            </>
                        ) : (
                            <>
                                <CompassIcon icon='magnify' className='empty-icon'/>
                                <p>{intl.formatMessage({id: 'TrelloPopup.noMembersFound', defaultMessage: 'No members found'})}</p>
                                <span className='empty-hint'>{intl.formatMessage({id: 'TrelloPopup.tryDifferentSearch', defaultMessage: 'Try a different search term'})}</span>
                            </>
                        )}
                    </div>
                )}
            </div>
        </PopupWrapper>
    )
}
