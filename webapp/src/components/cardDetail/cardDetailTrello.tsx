// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Card} from '../../blocks/card'
import {BoardView} from '../../blocks/boardView'
import {Board, IPropertyTemplate} from '../../blocks/board'
import {CommentBlock} from '../../blocks/commentBlock'
import {AttachmentBlock} from '../../blocks/attachmentBlock'
import {ContentBlock} from '../../blocks/contentBlock'
import {Block} from '../../blocks/block'
import mutator from '../../mutator'
import octoClient from '../../octoClient'
import {Utils} from '../../utils'
import {Focusable} from '../../widgets/editable'
import EditableArea from '../../widgets/editableArea'
import CompassIcon from '../../widgets/icons/compassIcon'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from '../../telemetry/telemetryClient'
import Menu from '../../widgets/menu'
import MenuWrapper from '../../widgets/menuWrapper'

import {contentRegistry} from '../content/contentRegistry'

import {useAppDispatch, useAppSelector} from '../../store/hooks'
import {setCurrent as setCurrentCard} from '../../store/cards'
import {Permission} from '../../constants'
import {useHasCurrentBoardPermissions} from '../../hooks/permissions'
import {getBoardUsers} from '../../store/users'
import {IUser} from '../../user'

import CommentsList from './commentsList'
import {CardDetailProvider} from './cardDetailContext'
import CardDetailContents from './cardDetailContents'
import CardDetailContentsMenu from './cardDetailContentsMenu'
import useImagePaste from './imagePaste'
import AttachmentList from './attachment'
import {LabelsPopup, DatesPopup, ChecklistPopup, MembersPopup} from './trelloPopups'
import Label from '../../widgets/label'
import MemberActivityLog from './memberActivityLog'
import UserAvatar from '../userAvatar'

import './cardDetailTrello.scss'

type Props = {
    board: Board
    activeView: BoardView
    views: BoardView[]
    cards: Card[]
    card: Card
    comments: CommentBlock[]
    attachments: AttachmentBlock[]
    contents: Array<ContentBlock|ContentBlock[]>
    readonly: boolean
    onClose: () => void
    onDelete: (block: Block) => void
    addAttachment: () => void
}

const CardDetailTrello = (props: Props): JSX.Element|null => {
    const {card, board, comments, attachments, onDelete, addAttachment} = props
    const {limited} = card
    const [title, setTitle] = useState(card.title)
    const [serverTitle, setServerTitle] = useState(card.title)
    const titleRef = useRef<Focusable>(null)
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
    const [showActivity, setShowActivity] = useState(true)
    const [showAddMenu, setShowAddMenu] = useState(false)
    
    // Popup states
    const [showLabelsPopup, setShowLabelsPopup] = useState(false)
    const [showDatesPopup, setShowDatesPopup] = useState(false)
    const [showChecklistPopup, setShowChecklistPopup] = useState(false)
    const [showMembersPopup, setShowMembersPopup] = useState(false)
    
    // Button refs for popup positioning
    const labelsButtonRef = useRef<HTMLButtonElement>(null)
    const datesButtonRef = useRef<HTMLButtonElement>(null)
    const checklistButtonRef = useRef<HTMLButtonElement>(null)
    const membersButtonRef = useRef<HTMLButtonElement>(null)
    
    const intl = useIntl()
    
    const saveTitle = useCallback(() => {
        if (title !== card.title) {
            mutator.changeBlockTitle(props.board.id, card.id, card.title, title)
        }
    }, [card.title, title])
    
    const canEditBoardCards = useHasCurrentBoardPermissions([Permission.ManageBoardCards])
    const canEditBoardProperties = useHasCurrentBoardPermissions([Permission.ManageBoardProperties])
    const canCommentBoardCards = useHasCurrentBoardPermissions([Permission.CommentBoardCards])

    const saveTitleRef = useRef<() => void>(saveTitle)
    saveTitleRef.current = saveTitle

    useImagePaste(props.board.id, card.id, card.fields.contentOrder)

    // Load cover image
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

    useEffect(() => {
        if (!title) {
            setTimeout(() => titleRef.current?.focus(), 300)
        }
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ViewCard, {board: props.board.id, view: props.activeView.id, card: card.id})
    }, [])

    useEffect(() => {
        if (serverTitle === title) {
            setTitle(card.title)
        }
        setServerTitle(card.title)
    }, [card.title, title])

    useEffect(() => {
        return () => {
            saveTitleRef.current && saveTitleRef.current()
        }
    }, [])

    const removeCover = useCallback(async () => {
        await mutator.changeCardCover(board.id, card.id, card.fields.coverFileId || '', '', 'remove cover')
    }, [board.id, card.id, card.fields.coverFileId])

    const dispatch = useAppDispatch()
    useEffect(() => {
        dispatch(setCurrentCard(card.id))
    }, [card.id])

    if (!card) {
        return null
    }

    // Get image attachments for cover selection
    const imageAttachments = useMemo(() => {
        return attachments.filter(att => {
            const ext = att.title?.toLowerCase().split('.').pop() || ''
            return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)
        })
    }, [attachments])

    // Get Labels (multiSelect property)
    const labelProperty = useMemo(() => board.cardProperties.find(p => p.type === 'multiSelect'), [board.cardProperties])
    const cardLabels = useMemo(() => {
        if (!labelProperty) return []
        const labelIds = card.fields.properties[labelProperty.id]
        if (!Array.isArray(labelIds)) return []
        return labelIds.map(id => labelProperty.options.find(opt => opt.id === id)).filter(Boolean)
    }, [labelProperty, card.fields.properties])

    // Get Due Date (date property)
    const dateProperty = useMemo(() => board.cardProperties.find(p => p.type === 'date'), [board.cardProperties])
    const dueDate = useMemo(() => {
        if (!dateProperty || !card.fields.properties[dateProperty.id]) return null
        try {
            const dateVal = JSON.parse(card.fields.properties[dateProperty.id] as string)
            if (dateVal.from) {
                return new Date(dateVal.from)
            }
        } catch (e) { /* invalid */ }
        return null
    }, [dateProperty, card.fields.properties])

    // Check if due date is overdue, due soon, or completed
    const dueDateStatus = useMemo(() => {
        if (!dueDate) return null
        const now = new Date()
        const diffMs = dueDate.getTime() - now.getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)
        
        if (diffMs < 0) return 'overdue'
        if (diffDays <= 1) return 'due-soon'
        return 'upcoming'
    }, [dueDate])

    // Get checkbox properties for checklist display
    const checkboxProperties = useMemo(() => {
        return board.cardProperties.filter(p => p.type === 'checkbox')
    }, [board.cardProperties])
    
    // Get Members (person/multiPerson property)
    const boardUsersById = useAppSelector<{[key: string]: IUser}>(getBoardUsers)
    const personProperty = useMemo(() => board.cardProperties.find(p => p.type === 'person' || p.type === 'multiPerson'), [board.cardProperties])
    const assignedMembers = useMemo(() => {
        if (!personProperty) return []
        const value = card.fields.properties[personProperty.id]
        let memberIds: string[] = []
        if (typeof value === 'string' && value !== '') {
            memberIds = [value]
        } else if (Array.isArray(value)) {
            memberIds = value as string[]
        }
        return memberIds.map(id => boardUsersById[id]).filter(Boolean)
    }, [personProperty, card.fields.properties, boardUsersById])
    
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

    // Check if any properties are set to show the section
    const hasPropertyData = cardLabels.length > 0 || dueDate || checkboxProperties.length > 0

    return (
        <div className='CardDetailTrello'>
            {/* Cover Image Section */}
            <div className='card-cover-section'>
                {coverImageUrl ? (
                    <>
                        <img 
                            src={coverImageUrl} 
                            alt='Card cover' 
                            className='cover-image'
                        />
                        {!props.readonly && canEditBoardCards && (
                            <div className='cover-actions'>
                                <button 
                                    className='Button'
                                    onClick={removeCover}
                                >
                                    <CompassIcon icon='image-off-outline'/>
                                    <span>{intl.formatMessage({id: 'CardDetail.removeCover', defaultMessage: 'Remove cover'})}</span>
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className='cover-placeholder'>
                        {imageAttachments.length > 0 ? (
                            <span>{intl.formatMessage({id: 'CardDetail.selectCover', defaultMessage: 'Select an attachment as cover from below'})}</span>
                        ) : (
                            <>
                                <CompassIcon icon='image-outline'/>
                                <span>{intl.formatMessage({id: 'CardDetail.noCover', defaultMessage: 'No cover image'})}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Main Content Area - Two Columns */}
            <div className='card-main-content'>
                {/* Left Column */}
                <div className='card-left-column'>
                    {/* Card Header */}
                    <div className='card-header'>
                        <div className='card-title-area'>
                            <EditableArea
                                ref={titleRef}
                                className='title'
                                value={title}
                                placeholderText='Untitled'
                                onChange={(newTitle: string) => setTitle(newTitle)}
                                saveOnEsc={true}
                                onSave={saveTitle}
                                onCancel={() => setTitle(props.card.title)}
                                readonly={props.readonly || !canEditBoardCards || limited}
                                spellCheck={true}
                            />
                            <div className='card-location'>
                                <FormattedMessage
                                    id='CardDetail.inList'
                                    defaultMessage='in list'
                                /> <strong>{board.title}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Trello-style Popups */}
                    {showLabelsPopup && (
                        <LabelsPopup
                            board={board}
                            card={card}
                            activeView={props.activeView}
                            onClose={() => setShowLabelsPopup(false)}
                            anchorRef={labelsButtonRef}
                        />
                    )}
                    {showDatesPopup && (
                        <DatesPopup
                            board={board}
                            card={card}
                            activeView={props.activeView}
                            onClose={() => setShowDatesPopup(false)}
                            anchorRef={datesButtonRef}
                        />
                    )}
                    {showChecklistPopup && (
                        <ChecklistPopup
                            board={board}
                            card={card}
                            activeView={props.activeView}
                            onClose={() => setShowChecklistPopup(false)}
                            anchorRef={checklistButtonRef}
                        />
                    )}
                    {showMembersPopup && (
                        <MembersPopup
                            board={board}
                            card={card}
                            activeView={props.activeView}
                            onClose={() => setShowMembersPopup(false)}
                            anchorRef={membersButtonRef}
                        />
                    )}

                    {/* Card Property Details Section - Trello Style (horizontal) */}
                    <div className='card-property-details-trello'>
                        {/* Members */}
                        <div className='property-column'>
                            <div className='property-title'>Members</div>
                            <div className='property-content members-content'>
                                <div className='member-avatars'>
                                    {assignedMembers.map(user => {
                                        const displayName = user.nickname || user.username || user.email || 'Unknown'
                                        return (
                                            <UserAvatar
                                                key={user.id}
                                                userId={user.id}
                                                name={displayName}
                                                size='medium'
                                                className='member-avatar'
                                            />
                                        )
                                    })}
                                </div>
                                <button 
                                    className='add-btn'
                                    ref={membersButtonRef}
                                    onClick={() => setShowMembersPopup(true)}
                                >
                                    <CompassIcon icon='plus'/>
                                </button>
                            </div>
                        </div>

                        {/* Due Date */}
                        <div className='property-column'>
                            <div className='property-title'>Due date</div>
                            <button 
                                className='property-content date-content' 
                                ref={datesButtonRef}
                                onClick={() => setShowDatesPopup(true)}
                            >
                                {dueDate ? (
                                    <>
                                        <span className='date-text'>
                                            {dueDate.toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}, {dueDate.toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </span>
                                        {dueDateStatus && (
                                            <span className={`date-status ${dueDateStatus}`}>
                                                {dueDateStatus === 'overdue' && 'Overdue'}
                                                {dueDateStatus === 'due-soon' && 'Due soon'}
                                            </span>
                                        )}
                                        <CompassIcon icon='chevron-down'/>
                                    </>
                                ) : (
                                    <span className='no-date'>Set due date...</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Description/Content Section */}
                    {!limited && (
                        <div className='card-section description-section'>
                            <div className='section-header'>
                                <div className='section-title'>
                                    <CompassIcon icon='text-box-outline'/>
                                    <span>{intl.formatMessage({id: 'CardDetail.description', defaultMessage: 'Description'})}</span>
                                </div>
                            </div>
                            <div className='section-content'>
                                <CardDetailProvider card={card}>
                                    <CardDetailContents
                                        card={props.card}
                                        contents={props.contents}
                                        readonly={props.readonly || !canEditBoardCards}
                                    />
                                    {!props.readonly && canEditBoardCards && <CardDetailContentsMenu/>}
                                </CardDetailProvider>
                            </div>
                        </div>
                    )}

                    {/* Attachments Section */}
                    <div className='card-section attachments-section'>
                        <div className='section-header'>
                            <div className='section-title'>
                                <CompassIcon icon='paperclip'/>
                                <span>{intl.formatMessage({id: 'CardDetail.attachments', defaultMessage: 'Attachments'})} ({attachments.length})</span>
                            </div>
                            {!props.readonly && canEditBoardCards && (
                                <button className='add-attachment-btn' onClick={addAttachment}>
                                    <CompassIcon icon='plus'/>
                                </button>
                            )}
                        </div>
                        <div className='section-content'>
                            {attachments.length > 0 ? (
                                <AttachmentList
                                    attachments={attachments}
                                    card={card}
                                    onDelete={onDelete}
                                    addAttachment={addAttachment}
                                />
                            ) : (
                                <div className='empty-attachments'>
                                    <button className='upload-btn' onClick={addAttachment}>
                                        <CompassIcon icon='paperclip'/>
                                        <span>{intl.formatMessage({id: 'CardDetail.addAttachment', defaultMessage: 'Add attachment'})}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Member Activity Log - below Attachments */}
                    {!limited && (
                        <MemberActivityLog
                            card={card}
                            board={board}
                        />
                    )}
                </div>

                {/* Right Column - Activity */}
                <div className='card-right-column'>
                    <div className='card-section activity-section'>
                        <div className='activity-header'>
                            <div className='activity-title'>
                                <CompassIcon icon='message-text-outline'/>
                                <span>{intl.formatMessage({id: 'CardDetail.commentsAndActivity', defaultMessage: 'Comments and activity'})}</span>
                            </div>
                            <span 
                                className='hide-details-btn'
                                onClick={() => setShowActivity(!showActivity)}
                            >
                                {showActivity 
                                    ? intl.formatMessage({id: 'CardDetail.hideDetails', defaultMessage: 'Hide details'})
                                    : intl.formatMessage({id: 'CardDetail.showDetails', defaultMessage: 'Show details'})
                                }
                            </span>
                        </div>

                        {showActivity && !limited && (
                            <CommentsList
                                comments={comments}
                                boardId={card.boardId}
                                cardId={card.id}
                                readonly={props.readonly || !canCommentBoardCards}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CardDetailTrello
