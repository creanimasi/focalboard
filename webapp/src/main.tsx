// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'
import ReactDOM from 'react-dom'
import {Provider as ReduxProvider} from 'react-redux'
import {store as emojiMartStore} from 'emoji-mart'

import App from './app'
import {initThemes} from './theme'
import {importNativeAppSettings} from './nativeApp'
import {UserSettings} from './userSettings'

import {IUser} from './user'
import {getMe} from './store/users'
import {useAppSelector, useAppDispatch} from './store/hooks'
import {setCurrentUserId, receiveNotification} from './store/notifications'
import wsClient from './wsclient'
import {UserNotification} from './octoClient'

import '@mattermost/compass-icons/css/compass-icons.css'

import './styles/variables.scss'
import './styles/main.scss'
import './styles/labels.scss'
import './styles/_markdown.scss'

import store from './store'
import WithWebSockets from './components/withWebSockets'

emojiMartStore.setHandlers({getter: UserSettings.getEmojiMartSetting, setter: UserSettings.setEmojiMartSetting})
importNativeAppSettings()

initThemes()

const MainApp = () => {
    const me = useAppSelector<IUser|null>(getMe)
    const dispatch = useAppDispatch()

    // Set current user ID when user is loaded
    useEffect(() => {
        if (me?.id) {
            dispatch(setCurrentUserId(me.id))
        }
    }, [me?.id, dispatch])

    // Register WebSocket notification handler
    useEffect(() => {
        const handleNotification = (_client: typeof wsClient, notification: UserNotification) => {
            // Only process notifications for the current user
            if (me?.id && notification.targetUserId === me.id) {
                dispatch(receiveNotification(notification))
            }
        }

        wsClient.addOnNotification(handleNotification)

        return () => {
            wsClient.removeOnNotification(handleNotification)
        }
    }, [me?.id, dispatch])

    return (
        <WithWebSockets userId={me?.id}>
            <App/>
        </WithWebSockets>
    )
}

ReactDOM.render(
    (
        <ReduxProvider store={store}>
            <MainApp/>
        </ReduxProvider>
    ),
    document.getElementById('focalboard-app'),
)
