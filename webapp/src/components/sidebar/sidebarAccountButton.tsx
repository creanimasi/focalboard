// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react'
import {useIntl} from 'react-intl'
import {useHistory} from 'react-router-dom'

import {IUser} from '../../user'
import {getMe, setMe} from '../../store/users'
import {useAppSelector, useAppDispatch} from '../../store/hooks'
import octoClient from '../../octoClient'
import CompassIcon from '../../widgets/icons/compassIcon'
import Menu from '../../widgets/menu'
import MenuWrapper from '../../widgets/menuWrapper'

import ModalWrapper from '../modalWrapper'
import AccountSettings from '../accountSettings/accountSettings'
import UserAvatar from '../userAvatar'

import './sidebarAccountButton.scss'

const SidebarAccountButton = () => {
    const dispatch = useAppDispatch()
    const history = useHistory()
    const [showAccountSettings, setShowAccountSettings] = useState(false)
    const user = useAppSelector<IUser|null>(getMe)
    const intl = useIntl()

    if (!user || user.username === 'single-user') {
        return null
    }

    return (
        <div className='SidebarAccountButton'>
            <ModalWrapper>
                <MenuWrapper>
                    <div className='account-button'>
                        <UserAvatar 
                            userId={user.id}
                            name={user.username}
                            size='medium'
                        />
                        <div className='user-info'>
                            <span className='username'>{user.username}</span>
                            <span className='email'>{user.email || 'No email'}</span>
                        </div>
                        <CompassIcon icon='chevron-up'/>
                    </div>
                    <Menu position='top'>
                        <Menu.Text
                            id='accountSettings'
                            icon={<CompassIcon icon='cog-outline'/>}
                            name={intl.formatMessage({id: 'Sidebar.account-settings', defaultMessage: 'Account settings'})}
                            onClick={() => {
                                setShowAccountSettings(true)
                            }}
                        />
                        <Menu.Text
                            id='changePassword'
                            icon={<CompassIcon icon='lock-outline'/>}
                            name={intl.formatMessage({id: 'Sidebar.changePassword', defaultMessage: 'Change password'})}
                            onClick={() => {
                                history.push('/change_password')
                            }}
                        />
                        <Menu.Separator/>
                        <Menu.Text
                            id='logout'
                            icon={<CompassIcon icon='exit-to-app'/>}
                            name={intl.formatMessage({id: 'Sidebar.logout', defaultMessage: 'Log out'})}
                            onClick={async () => {
                                await octoClient.logout()
                                dispatch(setMe(null))
                                history.push('/login')
                            }}
                        />
                    </Menu>
                </MenuWrapper>

                {showAccountSettings &&
                    <AccountSettings
                        onClose={() => {
                            setShowAccountSettings(false)
                        }}
                    />
                }
            </ModalWrapper>
        </div>
    )
}

export default React.memo(SidebarAccountButton)
