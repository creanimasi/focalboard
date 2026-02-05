// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/utils"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

var userNotificationFields = []string{
	"id",
	"target_user_id",
	"actor_user_id",
	"actor_name",
	"type",
	"card_id",
	"card_title",
	"board_id",
	"is_read",
	"create_at",
	"update_at",
}

func (s *SQLStore) userNotificationFromRows(rows *sql.Rows) ([]*model.UserNotification, error) {
	notifications := []*model.UserNotification{}

	for rows.Next() {
		var notification model.UserNotification
		err := rows.Scan(
			&notification.ID,
			&notification.TargetUserID,
			&notification.ActorUserID,
			&notification.ActorName,
			&notification.Type,
			&notification.CardID,
			&notification.CardTitle,
			&notification.BoardID,
			&notification.Read,
			&notification.CreateAt,
			&notification.UpdateAt,
		)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, &notification)
	}
	return notifications, nil
}

func (s *SQLStore) createUserNotification(db sq.BaseRunner, notification *model.UserNotification) (*model.UserNotification, error) {
	now := utils.GetMillis()
	notification.ID = utils.NewID(utils.IDTypeNone)
	notification.CreateAt = now
	notification.UpdateAt = now

	query := s.getQueryBuilder(db).Insert(s.tablePrefix+"user_notifications").
		Columns(userNotificationFields...).
		Values(
			notification.ID,
			notification.TargetUserID,
			notification.ActorUserID,
			notification.ActorName,
			notification.Type,
			notification.CardID,
			notification.CardTitle,
			notification.BoardID,
			notification.Read,
			notification.CreateAt,
			notification.UpdateAt,
		)

	if _, err := query.Exec(); err != nil {
		s.logger.Error("Cannot create user notification",
			mlog.String("target_user_id", notification.TargetUserID),
			mlog.Err(err),
		)
		return nil, err
	}
	return notification, nil
}

func (s *SQLStore) getUserNotifications(db sq.BaseRunner, userID string, limit int) ([]*model.UserNotification, error) {
	query := s.getQueryBuilder(db).
		Select(userNotificationFields...).
		From(s.tablePrefix + "user_notifications").
		Where(sq.Eq{"target_user_id": userID}).
		OrderBy("create_at DESC")

	if limit > 0 {
		query = query.Limit(uint64(limit))
	}

	rows, err := query.Query()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return s.userNotificationFromRows(rows)
}

func (s *SQLStore) getUnreadNotificationCount(db sq.BaseRunner, userID string) (int, error) {
	query := s.getQueryBuilder(db).
		Select("COUNT(*)").
		From(s.tablePrefix + "user_notifications").
		Where(sq.Eq{"target_user_id": userID, "is_read": false})

	row := query.QueryRow()

	var count int
	if err := row.Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (s *SQLStore) markNotificationAsRead(db sq.BaseRunner, notificationID, userID string) error {
	now := utils.GetMillis()
	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"user_notifications").
		Set("is_read", true).
		Set("update_at", now).
		Where(sq.Eq{"id": notificationID, "target_user_id": userID})

	result, err := query.Exec()
	if err != nil {
		return err
	}

	count, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if count == 0 {
		s.logger.Warn("notification not found or already read",
			mlog.String("notification_id", notificationID),
			mlog.String("user_id", userID),
		)
	}

	return nil
}

func (s *SQLStore) markAllNotificationsAsRead(db sq.BaseRunner, userID string) error {
	now := utils.GetMillis()
	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"user_notifications").
		Set("is_read", true).
		Set("update_at", now).
		Where(sq.Eq{"target_user_id": userID, "is_read": false})

	_, err := query.Exec()
	return err
}

func (s *SQLStore) deleteUserNotification(db sq.BaseRunner, notificationID, userID string) error {
	query := s.getQueryBuilder(db).
		Delete(s.tablePrefix + "user_notifications").
		Where(sq.Eq{"id": notificationID, "target_user_id": userID})

	_, err := query.Exec()
	return err
}
