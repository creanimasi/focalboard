// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useRef, useCallback} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Board} from '../../blocks/board'
import mutator from '../../mutator'
import octoClient from '../../octoClient'
import Button from '../../widgets/buttons/button'
import Menu from '../../widgets/menu'
import MenuWrapper from '../../widgets/menuWrapper'
import CompassIcon from '../../widgets/icons/compassIcon'

import './boardBackgroundPicker.scss'

type Props = {
    board: Board
    readonly: boolean
}

// Preset gradient backgrounds
const presetBackgrounds = [
    {id: 'none', name: 'None', value: ''},
    {id: 'gradient1', name: 'Ocean', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'},
    {id: 'gradient2', name: 'Sunset', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'},
    {id: 'gradient3', name: 'Forest', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'},
    {id: 'gradient4', name: 'Lavender', value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'},
    {id: 'gradient5', name: 'Night', value: 'linear-gradient(135deg, #0c0c0c 0%, #434343 100%)'},
    {id: 'gradient6', name: 'Aurora', value: 'linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)'},
    {id: 'gradient7', name: 'Fire', value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'},
    {id: 'gradient8', name: 'Deep Sea', value: 'linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)'},
]

const BoardBackgroundPicker = (props: Props) => {
    const {board, readonly} = props
    const intl = useIntl()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)

    const currentBackground = (board.properties?.background as string) || ''

    const handlePresetSelect = useCallback((value: string) => {
        mutator.changeBoardBackground(board.id, currentBackground, value)
    }, [board.id, currentBackground])

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) {
            return
        }

        setUploading(true)
        try {
            const fileId = await octoClient.uploadFile(board.id, file)
            if (fileId) {
                // Store the file reference as background
                const bgValue = `file:${board.id}:${fileId}`
                await mutator.changeBoardBackground(board.id, currentBackground, bgValue)
            }
        } catch (err) {
            console.error('Failed to upload background:', err)
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }, [board.id, currentBackground])

    const triggerFileUpload = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    if (readonly) {
        return null
    }

    return (
        <div className='BoardBackgroundPicker'>
            <MenuWrapper>
                <Button
                    emphasis='default'
                    size='xsmall'
                    icon={<CompassIcon icon='image-outline'/>}
                >
                    <FormattedMessage
                        id='BoardBackgroundPicker.background'
                        defaultMessage='Background'
                    />
                </Button>
                <Menu position='bottom'>
                    <Menu.Label>
                        <b>
                            <FormattedMessage
                                id='BoardBackgroundPicker.presets'
                                defaultMessage='Preset Colors'
                            />
                        </b>
                    </Menu.Label>
                    <div className='preset-grid'>
                        {presetBackgrounds.map((preset) => (
                            <div
                                key={preset.id}
                                className={`preset-item ${currentBackground === preset.value ? 'selected' : ''}`}
                                style={{background: preset.value || '#e0e0e0'}}
                                onClick={() => handlePresetSelect(preset.value)}
                                title={preset.name}
                            >
                                {preset.id === 'none' && (
                                    <CompassIcon icon='close'/>
                                )}
                                {currentBackground === preset.value && preset.id !== 'none' && (
                                    <CompassIcon icon='check'/>
                                )}
                            </div>
                        ))}
                    </div>
                    <Menu.Separator/>
                    <Menu.Text
                        id='upload-image'
                        name={intl.formatMessage({id: 'BoardBackgroundPicker.uploadImage', defaultMessage: 'Upload image'})}
                        icon={<CompassIcon icon='upload'/>}
                        onClick={triggerFileUpload}
                    />
                    {uploading && (
                        <Menu.Label>
                            <FormattedMessage
                                id='BoardBackgroundPicker.uploading'
                                defaultMessage='Uploading...'
                            />
                        </Menu.Label>
                    )}
                </Menu>
            </MenuWrapper>
            <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                style={{display: 'none'}}
                onChange={handleFileUpload}
            />
        </div>
    )
}

export default React.memo(BoardBackgroundPicker)
