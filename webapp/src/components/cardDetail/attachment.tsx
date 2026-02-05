// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'

import {useIntl} from 'react-intl'

import AttachmentElement from '../../components/content/attachmentElement'
import {AttachmentBlock} from '../../blocks/attachmentBlock'
import {Card} from '../../blocks/card'

import './attachment.scss'
import {Block} from '../../blocks/block'
import CompassIcon from '../../widgets/icons/compassIcon'
import BoardPermissionGate from '../../components/permissions/boardPermissionGate'
import {Permission} from '../../constants'

type Props = {
    attachments: AttachmentBlock[]
    card: Card
    onDelete: (block: Block) => void
    addAttachment: () => void
}

const INITIAL_VISIBLE_COUNT = 4

const AttachmentList = (props: Props): JSX.Element => {
    const {attachments, card, onDelete, addAttachment} = props
    const intl = useIntl()
    const [isExpanded, setIsExpanded] = useState(false)
    
    const hasMoreAttachments = attachments.length > INITIAL_VISIBLE_COUNT
    const visibleAttachments = isExpanded ? attachments : attachments.slice(0, INITIAL_VISIBLE_COUNT)
    const hiddenCount = attachments.length - INITIAL_VISIBLE_COUNT

    return (
        <div className='Attachment'>
            <div className='attachment-header'>
                <div className='attachment-title mb-2'>{intl.formatMessage({id: 'Attachment.Attachment-title', defaultMessage: 'Attachment'})} {`(${attachments.length})`}</div>
                <BoardPermissionGate permissions={[Permission.ManageBoardCards]}>
                    <div
                        className='attachment-plus-btn'
                        onClick={addAttachment}
                    >
                        <CompassIcon
                            icon='plus'
                            className='attachment-plus-icon'
                        />
                    </div>
                </BoardPermissionGate>
            </div>
            <div className='attachment-content'>
                {visibleAttachments.map((block: AttachmentBlock) => {
                    return (
                        <div key={block.id}>
                            <AttachmentElement
                                block={block}
                                card={card}
                                onDelete={onDelete}
                            />
                        </div>)
                })
                }
            </div>
            {hasMoreAttachments && (
                <button 
                    className='attachment-toggle-btn'
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <CompassIcon icon={isExpanded ? 'chevron-up' : 'chevron-down'}/>
                    <span>
                        {isExpanded 
                            ? intl.formatMessage({id: 'Attachment.showLess', defaultMessage: 'Show fewer attachments'})
                            : intl.formatMessage({id: 'Attachment.showMore', defaultMessage: 'View all attachments ({count})'}, {count: hiddenCount})
                        }
                    </span>
                </button>
            )}
        </div>
    )
}

export default AttachmentList
