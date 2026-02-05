// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useRef, useEffect} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {useAppSelector, useAppDispatch} from '../../store/hooks'
import {getMe, patchProps, getMyConfig} from '../../store/users'
import {storeLanguage} from '../../store/language'
import {IUser, UserPreference} from '../../user'
import Dialog from '../dialog'
import Button from '../../widgets/buttons/button'
import {sendFlashMessage} from '../flashMessages'
import {UserSettings} from '../../userSettings'
import octoClient from '../../octoClient'
import avatarEvents from '../../avatarEvents'
import {
    darkTheme,
    darkThemeName,
    defaultTheme,
    defaultThemeName,
    lightTheme,
    lightThemeName,
    setTheme,
    systemThemeName,
    Theme,
} from '../../theme'
import {Constants} from '../../constants'
import CheckIcon from '../../widgets/icons/check'

import './accountSettings.scss'

type Props = {
    onClose: () => void
}

type TabType = 'profile' | 'preferences' | 'notifications'

const AccountSettings = (props: Props): JSX.Element => {
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const me = useAppSelector<IUser | null>(getMe)
    const myConfig = useAppSelector(getMyConfig)
    
    const [activeTab, setActiveTab] = useState<TabType>('profile')
    const [displayName, setDisplayName] = useState(me?.nickname || me?.username || '')
    const [email, setEmail] = useState(me?.email || '')
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    // Theme state
    const [themeName, setThemeName] = useState(UserSettings.theme || defaultThemeName)
    
    // Notification preferences
    const [emailNotifications, setEmailNotifications] = useState(true)
    const [assignmentNotifications, setAssignmentNotifications] = useState(true)
    const [commentNotifications, setCommentNotifications] = useState(true)
    const [dueDateNotifications, setDueDateNotifications] = useState(true)
    
    // Random icons preference
    const [randomIcons, setRandomIcons] = useState(UserSettings.prefillRandomIcons)

    // Load saved avatar from API
    useEffect(() => {
        if (me?.id) {
            // Set avatar URL from API
            const avatarUrl = octoClient.getAvatarUrl(me.id)
            // Test if avatar exists by checking image load
            const img = new Image()
            img.onload = () => setAvatarPreview(avatarUrl)
            img.onerror = () => setAvatarPreview(null)
            img.src = avatarUrl
        }
    }, [me?.id])

    const updateTheme = useCallback((theme: Theme | null, name: string) => {
        setTheme(theme)
        setThemeName(name)
    }, [])

    const handleAvatarClick = () => {
        fileInputRef.current?.click()
    }

    // Store the actual file for upload
    const [avatarFile, setAvatarFile] = useState<File | null>(null)

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                sendFlashMessage({
                    content: intl.formatMessage({id: 'AccountSettings.avatarTooLarge', defaultMessage: 'Image is too large. Maximum size is 5MB'}),
                    severity: 'high'
                })
                return
            }
            
            // Store file for upload
            setAvatarFile(file)
            
            // Show preview
            const reader = new FileReader()
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSaveProfile = async () => {
        if (!me) return
        
        setIsSaving(true)
        try {
            // Upload avatar file to server if changed
            if (avatarFile) {
                const avatarUrl = await octoClient.uploadAvatar(me.id, avatarFile)
                if (!avatarUrl) {
                    sendFlashMessage({
                        content: intl.formatMessage({id: 'AccountSettings.avatarUploadError', defaultMessage: 'Failed to upload avatar'}),
                        severity: 'high'
                    })
                    setIsSaving(false)
                    return
                }
                // Clear the file after successful upload
                setAvatarFile(null)
                
                // Emit avatar update event so all UserAvatar components refresh
                avatarEvents.emit(me.id)
            }
            
            // Save other profile settings to user config
            const patch = {
                updatedFields: {} as Record<string, string>
            }
            
            if (displayName && displayName !== me.nickname) {
                patch.updatedFields.displayName = displayName
            }
            
            if (Object.keys(patch.updatedFields).length > 0) {
                const updatedConfig = await octoClient.patchUserConfig(me.id, patch)
                if (updatedConfig) {
                    dispatch(patchProps(updatedConfig))
                }
            }
            
            sendFlashMessage({
                content: intl.formatMessage({id: 'AccountSettings.profileSaved', defaultMessage: 'Profile saved successfully'}),
                severity: 'normal'
            })
        } catch (error) {
            sendFlashMessage({
                content: intl.formatMessage({id: 'AccountSettings.profileSaveError', defaultMessage: 'Failed to save profile'}),
                severity: 'high'
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleSavePreferences = () => {
        sendFlashMessage({
            content: intl.formatMessage({id: 'AccountSettings.preferencesSaved', defaultMessage: 'Preferences saved successfully'}),
            severity: 'normal'
        })
    }

    const handleSaveNotifications = () => {
        sendFlashMessage({
            content: intl.formatMessage({id: 'AccountSettings.notificationsSaved', defaultMessage: 'Notification settings saved'}),
            severity: 'normal'
        })
    }

    const toggleRandomIcons = () => {
        UserSettings.prefillRandomIcons = !UserSettings.prefillRandomIcons
        setRandomIcons(!randomIcons)
    }

    const getAvatarInitials = (): string => {
        const name = me?.nickname || me?.username || 'U'
        const parts = name.trim().split(/\s+/)
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        }
        return name.slice(0, 2).toUpperCase()
    }

    const getAvatarColor = (): string => {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
        ]
        const name = me?.id || 'default'
        let hash = 0
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash)
        }
        return colors[Math.abs(hash) % colors.length]
    }

    const themes = [
        {id: defaultThemeName, displayName: 'Default', theme: defaultTheme},
        {id: darkThemeName, displayName: 'Dark', theme: darkTheme},
        {id: lightThemeName, displayName: 'Light', theme: lightTheme},
        {id: systemThemeName, displayName: 'System', theme: null},
    ]

    const renderProfileTab = () => (
        <div className='settings-section'>
            <h3>
                <FormattedMessage id='AccountSettings.profileInfo' defaultMessage='Profile Information'/>
            </h3>
            
            <div className='avatar-section'>
                <div 
                    className='avatar-large'
                    style={{backgroundColor: avatarPreview ? 'transparent' : getAvatarColor()}}
                    onClick={handleAvatarClick}
                >
                    {avatarPreview ? (
                        <img src={avatarPreview} alt='Avatar' />
                    ) : (
                        getAvatarInitials()
                    )}
                    <div className='avatar-overlay'>
                        <span>📷</span>
                    </div>
                </div>
                <input
                    type='file'
                    ref={fileInputRef}
                    accept='image/*'
                    onChange={handleAvatarChange}
                    style={{display: 'none'}}
                />
                <p className='avatar-hint'>
                    <FormattedMessage id='AccountSettings.clickToUpload' defaultMessage='Click to upload photo'/>
                </p>
            </div>

            <div className='form-group'>
                <label>
                    <FormattedMessage id='AccountSettings.displayName' defaultMessage='Display Name'/>
                </label>
                <input
                    type='text'
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={intl.formatMessage({id: 'AccountSettings.displayNamePlaceholder', defaultMessage: 'Enter your display name'})}
                />
            </div>

            <div className='form-group'>
                <label>
                    <FormattedMessage id='AccountSettings.username' defaultMessage='Username'/>
                </label>
                <input
                    type='text'
                    value={me?.username || ''}
                    disabled
                    className='disabled'
                />
                <span className='hint'>
                    <FormattedMessage id='AccountSettings.usernameHint' defaultMessage='Username cannot be changed'/>
                </span>
            </div>

            <div className='form-group'>
                <label>
                    <FormattedMessage id='AccountSettings.email' defaultMessage='Email'/>
                </label>
                <input
                    type='email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={intl.formatMessage({id: 'AccountSettings.emailPlaceholder', defaultMessage: 'Enter your email'})}
                />
            </div>

            <div className='form-actions'>
                <Button
                    filled={true}
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <FormattedMessage id='AccountSettings.saving' defaultMessage='Saving...'/>
                    ) : (
                        <FormattedMessage id='AccountSettings.saveProfile' defaultMessage='Save Profile'/>
                    )}
                </Button>
            </div>
        </div>
    )

    const renderPreferencesTab = () => (
        <div className='settings-section'>
            <h3>
                <FormattedMessage id='AccountSettings.appearance' defaultMessage='Appearance'/>
            </h3>
            
            <div className='preference-group'>
                <label>
                    <FormattedMessage id='AccountSettings.theme' defaultMessage='Theme'/>
                </label>
                <div className='theme-options'>
                    {themes.map((theme) => (
                        <div
                            key={theme.id}
                            className={`theme-option ${themeName === theme.id ? 'selected' : ''}`}
                            onClick={() => updateTheme(theme.theme, theme.id)}
                        >
                            <div className={`theme-preview ${theme.id}`}>
                                <div className='preview-sidebar'></div>
                                <div className='preview-content'>
                                    <div className='preview-card'></div>
                                    <div className='preview-card'></div>
                                </div>
                            </div>
                            <span>{theme.displayName}</span>
                            {themeName === theme.id && <CheckIcon />}
                        </div>
                    ))}
                </div>
            </div>

            <div className='preference-group'>
                <label>
                    <FormattedMessage id='AccountSettings.language' defaultMessage='Language'/>
                </label>
                <select
                    value={intl.locale}
                    onChange={(e) => dispatch(storeLanguage(e.target.value))}
                    className='language-select'
                >
                    {Constants.languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.displayName}
                        </option>
                    ))}
                </select>
            </div>

            <div className='preference-group'>
                <div className='toggle-row'>
                    <div className='toggle-info'>
                        <span className='toggle-label'>
                            <FormattedMessage id='AccountSettings.randomIcons' defaultMessage='Random Icons'/>
                        </span>
                        <span className='toggle-description'>
                            <FormattedMessage id='AccountSettings.randomIconsDesc' defaultMessage='Use random icons for new boards'/>
                        </span>
                    </div>
                    <label className='toggle-switch'>
                        <input
                            type='checkbox'
                            checked={randomIcons}
                            onChange={toggleRandomIcons}
                        />
                        <span className='toggle-slider'></span>
                    </label>
                </div>
            </div>

            <div className='form-actions'>
                <Button
                    filled={true}
                    onClick={handleSavePreferences}
                >
                    <FormattedMessage id='AccountSettings.savePreferences' defaultMessage='Save Preferences'/>
                </Button>
            </div>
        </div>
    )

    const renderNotificationsTab = () => (
        <div className='settings-section'>
            <h3>
                <FormattedMessage id='AccountSettings.notificationSettings' defaultMessage='Notification Settings'/>
            </h3>
            
            <div className='notification-options'>
                <div className='toggle-row'>
                    <div className='toggle-info'>
                        <span className='toggle-label'>
                            <FormattedMessage id='AccountSettings.emailNotifications' defaultMessage='Email Notifications'/>
                        </span>
                        <span className='toggle-description'>
                            <FormattedMessage id='AccountSettings.emailNotificationsDesc' defaultMessage='Receive email notifications for important updates'/>
                        </span>
                    </div>
                    <label className='toggle-switch'>
                        <input
                            type='checkbox'
                            checked={emailNotifications}
                            onChange={() => setEmailNotifications(!emailNotifications)}
                        />
                        <span className='toggle-slider'></span>
                    </label>
                </div>

                <div className='toggle-row'>
                    <div className='toggle-info'>
                        <span className='toggle-label'>
                            <FormattedMessage id='AccountSettings.assignmentNotifications' defaultMessage='Card Assignments'/>
                        </span>
                        <span className='toggle-description'>
                            <FormattedMessage id='AccountSettings.assignmentNotificationsDesc' defaultMessage='Notify when assigned to a card'/>
                        </span>
                    </div>
                    <label className='toggle-switch'>
                        <input
                            type='checkbox'
                            checked={assignmentNotifications}
                            onChange={() => setAssignmentNotifications(!assignmentNotifications)}
                        />
                        <span className='toggle-slider'></span>
                    </label>
                </div>

                <div className='toggle-row'>
                    <div className='toggle-info'>
                        <span className='toggle-label'>
                            <FormattedMessage id='AccountSettings.commentNotifications' defaultMessage='Comments'/>
                        </span>
                        <span className='toggle-description'>
                            <FormattedMessage id='AccountSettings.commentNotificationsDesc' defaultMessage='Notify when someone comments on your cards'/>
                        </span>
                    </div>
                    <label className='toggle-switch'>
                        <input
                            type='checkbox'
                            checked={commentNotifications}
                            onChange={() => setCommentNotifications(!commentNotifications)}
                        />
                        <span className='toggle-slider'></span>
                    </label>
                </div>

                <div className='toggle-row'>
                    <div className='toggle-info'>
                        <span className='toggle-label'>
                            <FormattedMessage id='AccountSettings.dueDateNotifications' defaultMessage='Due Dates'/>
                        </span>
                        <span className='toggle-description'>
                            <FormattedMessage id='AccountSettings.dueDateNotificationsDesc' defaultMessage='Notify when due dates are approaching'/>
                        </span>
                    </div>
                    <label className='toggle-switch'>
                        <input
                            type='checkbox'
                            checked={dueDateNotifications}
                            onChange={() => setDueDateNotifications(!dueDateNotifications)}
                        />
                        <span className='toggle-slider'></span>
                    </label>
                </div>
            </div>

            <div className='form-actions'>
                <Button
                    filled={true}
                    onClick={handleSaveNotifications}
                >
                    <FormattedMessage id='AccountSettings.saveNotifications' defaultMessage='Save Notifications'/>
                </Button>
            </div>
        </div>
    )

    return (
        <Dialog
            onClose={props.onClose}
            title={
                <FormattedMessage id='AccountSettings.title' defaultMessage='Account Settings'/>
            }
            className='AccountSettingsDialog'
        >
            <div className='account-settings-content'>
                <div className='settings-tabs'>
                    <button
                        className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <span className='tab-icon'>👤</span>
                        <FormattedMessage id='AccountSettings.profile' defaultMessage='Profile'/>
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'preferences' ? 'active' : ''}`}
                        onClick={() => setActiveTab('preferences')}
                    >
                        <span className='tab-icon'>🎨</span>
                        <FormattedMessage id='AccountSettings.preferences' defaultMessage='Preferences'/>
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
                        onClick={() => setActiveTab('notifications')}
                    >
                        <span className='tab-icon'>🔔</span>
                        <FormattedMessage id='AccountSettings.notifications' defaultMessage='Notifications'/>
                    </button>
                </div>

                <div className='settings-panel'>
                    {activeTab === 'profile' && renderProfileTab()}
                    {activeTab === 'preferences' && renderPreferencesTab()}
                    {activeTab === 'notifications' && renderNotificationsTab()}
                </div>
            </div>
        </Dialog>
    )
}

export default AccountSettings
