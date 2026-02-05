// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/focalboard/server/model"
)

// CreateUserNotification creates a new user notification
func (a *App) CreateUserNotification(notification *model.UserNotification) (*model.UserNotification, error) {
	return a.store.CreateUserNotification(notification)
}

// GetUserNotifications retrieves notifications for a user
func (a *App) GetUserNotifications(userID string, limit int) ([]*model.UserNotification, error) {
	return a.store.GetUserNotifications(userID, limit)
}

// GetUnreadNotificationCount gets the count of unread notifications
func (a *App) GetUnreadNotificationCount(userID string) (int, error) {
	return a.store.GetUnreadNotificationCount(userID)
}

// MarkNotificationAsRead marks a notification as read
func (a *App) MarkNotificationAsRead(notificationID, userID string) error {
	return a.store.MarkNotificationAsRead(notificationID, userID)
}

// MarkAllNotificationsAsRead marks all notifications for a user as read
func (a *App) MarkAllNotificationsAsRead(userID string) error {
	return a.store.MarkAllNotificationsAsRead(userID)
}

// DeleteUserNotification deletes a notification
func (a *App) DeleteUserNotification(notificationID, userID string) error {
	return a.store.DeleteUserNotification(notificationID, userID)
}

// CreateAndBroadcastNotification creates a notification and broadcasts it via WebSocket
func (a *App) CreateAndBroadcastNotification(notification *model.UserNotification) (*model.UserNotification, error) {
	created, err := a.store.CreateUserNotification(notification)
	if err != nil {
		return nil, err
	}

	// Broadcast to the target user via WebSocket
	a.wsAdapter.BroadcastUserNotification(notification.TargetUserID, created)

	return created, nil
}
