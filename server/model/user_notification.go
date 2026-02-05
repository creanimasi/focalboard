package model

import (
	"encoding/json"
	"io"
	"time"

	"github.com/mattermost/focalboard/server/utils"
)

// UserNotification represents a notification for a user
// swagger:model
type UserNotification struct {
	// The notification ID
	// required: true
	ID string `json:"id"`

	// The user ID who should receive this notification
	// required: true
	TargetUserID string `json:"targetUserId"`

	// The user ID who performed the action
	// required: true
	ActorUserID string `json:"actorUserId"`

	// The actor's display name
	// required: true
	ActorName string `json:"actorName"`

	// The notification type (assigned, unassigned, mentioned)
	// required: true
	Type string `json:"type"`

	// The card ID related to this notification
	// required: true
	CardID string `json:"cardId"`

	// The card title
	// required: true
	CardTitle string `json:"cardTitle"`

	// The board ID
	// required: true
	BoardID string `json:"boardId"`

	// Whether the notification has been read
	// required: true
	Read bool `json:"read"`

	// Created time in milliseconds since epoch
	// required: true
	CreateAt int64 `json:"createAt"`

	// Updated time in milliseconds since epoch
	// required: true
	UpdateAt int64 `json:"updateAt"`
}

// UserNotificationFromJSON parses a UserNotification from JSON
func UserNotificationFromJSON(data io.Reader) (*UserNotification, error) {
	var notification UserNotification
	if err := json.NewDecoder(data).Decode(&notification); err != nil {
		return nil, err
	}
	return &notification, nil
}

// NewUserNotification creates a new UserNotification with generated ID and timestamps
func NewUserNotification(targetUserID, actorUserID, actorName, notifType, cardID, cardTitle, boardID string) *UserNotification {
	now := time.Now().UnixMilli()
	return &UserNotification{
		ID:           utils.NewID(utils.IDTypeNone),
		TargetUserID: targetUserID,
		ActorUserID:  actorUserID,
		ActorName:    actorName,
		Type:         notifType,
		CardID:       cardID,
		CardTitle:    cardTitle,
		BoardID:      boardID,
		Read:         false,
		CreateAt:     now,
		UpdateAt:     now,
	}
}
