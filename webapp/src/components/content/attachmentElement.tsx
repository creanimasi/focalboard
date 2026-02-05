// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'
import ReactDOM from 'react-dom'
import {useIntl} from 'react-intl'

import octoClient from '../../octoClient'
import mutator from '../../mutator'

import {AttachmentBlock} from '../../blocks/attachmentBlock'
import {Block, FileInfo} from '../../blocks/block'
import {Card} from '../../blocks/card'
import Files from '../../file'
import FileIcons from '../../fileIcons'

import BoardPermissionGate from '../../components/permissions/boardPermissionGate'
import ConfirmationDialogBox, {ConfirmationDialogBoxProps} from '../../components/confirmationDialogBox'
import {Utils} from '../../utils'
import {getUploadPercent} from '../../store/attachments'
import {useAppSelector} from '../../store/hooks'
import {Permission} from '../../constants'

import ArchivedFile from './archivedFile/archivedFile'

import './attachmentElement.scss'
import CompassIcon from './../../widgets/icons/compassIcon'
import Tooltip from './../../widgets/tooltip'

// Image Lightbox Component
type ImageLightboxProps = {
    imageUrl: string
    fileName: string
    onClose: () => void
    onDownload: () => void
}

const ImageLightbox = ({imageUrl, fileName, onClose, onDownload}: ImageLightboxProps): JSX.Element => {
    const [scale, setScale] = useState(1)
    const [position, setPosition] = useState({x: 0, y: 0})
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({x: 0, y: 0})

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            } else if (e.key === '+' || e.key === '=') {
                setScale(s => Math.min(s + 0.25, 5))
            } else if (e.key === '-') {
                setScale(s => Math.max(s - 0.25, 0.25))
            } else if (e.key === '0') {
                setScale(1)
                setPosition({x: 0, y: 0})
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        document.body.style.overflow = 'hidden'
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = ''
        }
    }, [onClose])

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setScale(s => Math.min(Math.max(s + delta, 0.25), 5))
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true)
            setDragStart({x: e.clientX - position.x, y: e.clientY - position.y})
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            })
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const resetView = () => {
        setScale(1)
        setPosition({x: 0, y: 0})
    }

    const lightboxContent = (
        <div 
            className='image-lightbox-overlay'
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className='lightbox-header'>
                <span className='lightbox-filename'>{fileName}</span>
                <div className='lightbox-controls'>
                    <button 
                        className='lightbox-btn'
                        onClick={() => setScale(s => Math.max(s - 0.25, 0.25))}
                        title='Zoom out (-)'
                    >
                        <CompassIcon icon='minus'/>
                    </button>
                    <span className='lightbox-zoom-level'>{Math.round(scale * 100)}%</span>
                    <button 
                        className='lightbox-btn'
                        onClick={() => setScale(s => Math.min(s + 0.25, 5))}
                        title='Zoom in (+)'
                    >
                        <CompassIcon icon='plus'/>
                    </button>
                    <button 
                        className='lightbox-btn'
                        onClick={resetView}
                        title='Reset view (0)'
                    >
                        <CompassIcon icon='refresh'/>
                    </button>
                    <div className='lightbox-divider'/>
                    <button 
                        className='lightbox-btn'
                        onClick={onDownload}
                        title='Download'
                    >
                        <CompassIcon icon='download-outline'/>
                    </button>
                    <button 
                        className='lightbox-btn lightbox-close'
                        onClick={onClose}
                        title='Close (Esc)'
                    >
                        <CompassIcon icon='close'/>
                    </button>
                </div>
            </div>
            <div 
                className='lightbox-image-container'
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'}}
            >
                <img 
                    src={imageUrl}
                    alt={fileName}
                    className='lightbox-image'
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease'
                    }}
                    draggable={false}
                />
            </div>
            <div className='lightbox-footer'>
                <span>Scroll to zoom • Drag to pan • Press Esc to close</span>
            </div>
        </div>
    )

    return ReactDOM.createPortal(lightboxContent, document.body)
}

type Props = {
    block: AttachmentBlock
    card?: Card
    onDelete?: (block: Block) => void
}

const AttachmentElement = (props: Props): JSX.Element|null => {
    const {block, card, onDelete} = props
    const [fileInfo, setFileInfo] = useState<FileInfo>({})
    const [fileSize, setFileSize] = useState<string>()
    const [fileIcon, setFileIcon] = useState<string>('file-text-outline-larg')
    const [fileName, setFileName] = useState<string>()
    const [showConfirmationDialogBox, setShowConfirmationDialogBox] = useState<boolean>(false)
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
    const [showLightbox, setShowLightbox] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [menuPosition, setMenuPosition] = useState({top: 0, left: 0})
    const menuButtonRef = React.useRef<HTMLButtonElement>(null)
    const uploadPercent = useAppSelector(getUploadPercent(block.id))
    const intl = useIntl()

    // Check if this attachment is an image (can be used as cover)
    const isImage = fileInfo.extension && ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(fileInfo.extension.toLowerCase())
    const isCover = card?.fields?.coverFileId === block.fields.fileId

    // Handle menu toggle with portal positioning
    const handleMenuToggle = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!showMenu && menuButtonRef.current) {
            const rect = menuButtonRef.current.getBoundingClientRect()
            setMenuPosition({
                top: rect.bottom + 4,
                left: rect.right - 200, // Menu width ~200px, align right edge
            })
        }
        setShowMenu(!showMenu)
    }

    // Close menu on outside click
    useEffect(() => {
        if (!showMenu) return

        const handleClickOutside = (e: MouseEvent) => {
            setShowMenu(false)
        }

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowMenu(false)
            }
        }

        // Delay to avoid immediate close
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside)
            document.addEventListener('keydown', handleEscape)
        }, 0)

        return () => {
            document.removeEventListener('click', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [showMenu])

    const handleSetAsCover = async () => {
        setShowMenu(false)
        if (card) {
            await mutator.changeCardCover(
                card.boardId,
                card.id,
                card.fields.coverFileId || '',
                block.fields.fileId,
                'set card cover'
            )
        }
    }

    const handleRemoveCover = async () => {
        setShowMenu(false)
        if (card) {
            await mutator.changeCardCover(
                card.boardId,
                card.id,
                card.fields.coverFileId || '',
                '',
                'remove card cover'
            )
        }
    }

    useEffect(() => {
        const loadFile = async () => {
            if (block.isUploading) {
                setFileInfo({
                    name: block.title,
                    extension: block.title.split('.').slice(0, -1).join('.'),
                })
                return
            }
            const attachmentInfo = await octoClient.getFileInfo(block.boardId, block.fields.fileId)
            setFileInfo(attachmentInfo)
        }
        loadFile()
    }, [])

    useEffect(() => {
        if (fileInfo.size && !fileSize) {
            setFileSize(Utils.humanFileSize(fileInfo.size))
        }
        if (fileInfo.name && !fileName) {
            const generateFileName = (fName: string) => {
                if (fName.length > 18) {
                    let result = fName.slice(0, 15)
                    result += '...'
                    return result
                }
                return fName
            }
            setFileName(generateFileName(fileInfo.name))
        }
    }, [fileInfo.size, fileInfo.name])

    useEffect(() => {
        if (fileInfo.extension) {
            const getFileIcon = (fileExt: string) => {
                const extType = (Object.keys(Files) as string[]).find((key) => Files[key].find((ext) => ext === fileExt))
                if (extType) {
                    setFileIcon(FileIcons[extType])
                } else {
                    setFileIcon('file-generic-outline-large')
                }
            }
            getFileIcon(fileInfo.extension.substring(1))
        }
    }, [fileInfo.extension])

    // Load image preview for image files
    useEffect(() => {
        const loadImagePreview = async () => {
            if (isImage && !block.isUploading) {
                try {
                    const attachment = await octoClient.getFileAsDataUrl(block.boardId, block.fields.fileId)
                    if (attachment.url) {
                        setImagePreviewUrl(attachment.url)
                    }
                } catch (e) {
                    // Failed to load preview
                    setImagePreviewUrl(null)
                }
            }
        }
        loadImagePreview()
    }, [isImage, block.isUploading, block.boardId, block.fields.fileId])

    const deleteAttachment = () => {
        if (onDelete) {
            onDelete(block)
        }
    }

    const confirmDialogProps: ConfirmationDialogBoxProps = {
        heading: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-attachment', defaultMessage: 'Confirm Attachment delete!'}),
        confirmButtonText: intl.formatMessage({id: 'AttachmentElement.delete-confirmation-dialog-button-text', defaultMessage: 'Delete'}),
        onConfirm: deleteAttachment,
        onClose: () => {
            setShowConfirmationDialogBox(false)
        },
    }

    const handleDeleteButtonClick = () => {
        setShowMenu(false)
        setShowConfirmationDialogBox(true)
    }

    if (fileInfo.archived) {
        return (
            <ArchivedFile fileInfo={fileInfo}/>
        )
    }

    const attachmentDownloadHandler = async () => {
        const attachment = await octoClient.getFileAsDataUrl(block.boardId, block.fields.fileId)
        const anchor = document.createElement('a')
        anchor.href = attachment.url || ''
        anchor.download = fileInfo.name || ''
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
    }

    return (
        <div className={`FileElement ${isImage ? 'has-preview' : ''}`}>
            {showConfirmationDialogBox && <ConfirmationDialogBox dialogBox={confirmDialogProps}/>}
            
            {/* Image Lightbox */}
            {showLightbox && imagePreviewUrl && (
                <ImageLightbox
                    imageUrl={imagePreviewUrl}
                    fileName={fileInfo.name || 'Image'}
                    onClose={() => setShowLightbox(false)}
                    onDownload={attachmentDownloadHandler}
                />
            )}
            
            {/* Show image preview for images, icon for other files */}
            {isImage && imagePreviewUrl ? (
                <div 
                    className='fileElement-image-preview'
                    onClick={() => setShowLightbox(true)}
                    title='Click to view full image'
                >
                    <img 
                        src={imagePreviewUrl} 
                        alt={fileInfo.name || 'attachment'} 
                        className='preview-image'
                        loading='lazy'
                        decoding='async'
                    />
                    <div className='preview-overlay'>
                        <CompassIcon icon='eye-outline'/>
                        <span>View</span>
                    </div>
                    {isCover && (
                        <div className='cover-indicator'>
                            <CompassIcon icon='star'/>
                            <span>Cover</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className='fileElement-icon-division'>
                    <CompassIcon
                        icon={fileIcon}
                        className='fileElement-icon'
                    />
                </div>
            )}
            
            <div className='fileElement-file-details'>
                <Tooltip
                    title={fileInfo.name ? fileInfo.name : ''}
                    placement='bottom'
                >
                    <div className='fileElement-file-name'>
                        {fileName}
                        {isCover && <span className='fileElement-cover-badge'><CompassIcon icon='star'/> Cover</span>}
                    </div>
                </Tooltip>
                {!block.isUploading && <div className='fileElement-file-ext-and-size'>
                    Added {new Date(block.createAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div> }
                {block.isUploading && <div className='fileElement-file-uploading'>
                    {intl.formatMessage({
                        id: 'AttachmentElement.upload-percentage',
                        defaultMessage: 'Uploading...({uploadPercent}%)',
                    }, {
                        uploadPercent,
                    })}
                </div>}
            </div>
            {block.isUploading &&
                <div className='progress'>
                    <span
                        className='progress-bar'
                        style={{width: uploadPercent + '%'}}
                    >
                        {''}
                    </span>
                </div>}
            {!block.isUploading &&
            <div className='fileElement-delete-download'>
                <BoardPermissionGate permissions={[Permission.ManageBoardCards]}>
                    <button
                        ref={menuButtonRef}
                        className='fileElement-menu-btn'
                        onClick={handleMenuToggle}
                    >
                        <CompassIcon icon='dots-vertical'/>
                    </button>
                    {showMenu && ReactDOM.createPortal(
                        <div 
                            className='attachment-menu-portal'
                            style={{
                                position: 'fixed',
                                top: menuPosition.top,
                                left: menuPosition.left,
                                zIndex: 99999,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className='attachment-menu-content'>
                                {/* Set as cover option for images */}
                                {isImage && card && !isCover && (
                                    <div className='attachment-menu-item' onClick={handleSetAsCover}>
                                        <CompassIcon icon='image-outline'/>
                                        <span>{intl.formatMessage({id: 'AttachmentElement.set-as-cover', defaultMessage: 'Set as cover'})}</span>
                                    </div>
                                )}
                                {/* Remove cover option if this is the cover */}
                                {isImage && card && isCover && (
                                    <div className='attachment-menu-item' onClick={handleRemoveCover}>
                                        <CompassIcon icon='image-off-outline'/>
                                        <span>{intl.formatMessage({id: 'AttachmentElement.remove-cover', defaultMessage: 'Remove cover'})}</span>
                                    </div>
                                )}
                                <div className='attachment-menu-item delete' onClick={handleDeleteButtonClick}>
                                    <CompassIcon icon='trash-can-outline'/>
                                    <span>{intl.formatMessage({id: 'AttachmentElement.delete', defaultMessage: 'Delete'})}</span>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </BoardPermissionGate>
                {/* Cover indicator badge */}
                {isCover && (
                    <Tooltip
                        title={intl.formatMessage({id: 'AttachmentElement.cover-badge', defaultMessage: 'Card cover'})}
                        placement='bottom'
                    >
                        <div className='fileElement-cover-badge'>
                            <CompassIcon icon='image-outline'/>
                        </div>
                    </Tooltip>
                )}
                <Tooltip
                    title={intl.formatMessage({id: 'AttachmentElement.download', defaultMessage: 'Download'})}
                    placement='bottom'
                >
                    <div
                        className='fileElement-download-btn mt-3 mr-2'
                        onClick={attachmentDownloadHandler}
                    >
                        <CompassIcon
                            icon='download-outline'
                        />
                    </div>
                </Tooltip>
            </div> }
        </div>
    )
}

export default React.memo(AttachmentElement)
