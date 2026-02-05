package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (a *API) registerNotificationsRoutes(r *mux.Router) {
	// Notifications APIs
	r.HandleFunc("/notifications", a.sessionRequired(a.handleGetNotifications)).Methods(http.MethodGet)
	r.HandleFunc("/notifications/unread-count", a.sessionRequired(a.handleGetUnreadCount)).Methods(http.MethodGet)
	r.HandleFunc("/notifications", a.sessionRequired(a.handleCreateNotification)).Methods(http.MethodPost)
	r.HandleFunc("/notifications/{notificationID}/read", a.sessionRequired(a.handleMarkAsRead)).Methods(http.MethodPost)
	r.HandleFunc("/notifications/read-all", a.sessionRequired(a.handleMarkAllAsRead)).Methods(http.MethodPost)
	r.HandleFunc("/notifications/{notificationID}", a.sessionRequired(a.handleDeleteNotification)).Methods(http.MethodDelete)
}

func (a *API) handleGetNotifications(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /notifications getNotifications
	//
	// Returns user notifications
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: limit
	//   in: query
	//   description: Maximum number of notifications to return
	//   required: false
	//   type: integer
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/UserNotification"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	userID := getUserID(r)

	limit := 50 // default
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	auditRec := a.makeAuditRecord(r, "getNotifications", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)

	notifications, err := a.app.GetUserNotifications(userID, limit)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("GetNotifications",
		mlog.String("userID", userID),
		mlog.Int("count", len(notifications)),
	)

	data, err := json.Marshal(notifications)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

func (a *API) handleGetUnreadCount(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /notifications/unread-count getUnreadCount
	//
	// Returns unread notification count
	//
	// ---
	// produces:
	// - application/json
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: object
	//       properties:
	//         count:
	//           type: integer
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	userID := getUserID(r)

	count, err := a.app.GetUnreadNotificationCount(userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	response := map[string]int{"count": count}
	data, err := json.Marshal(response)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
}

func (a *API) handleCreateNotification(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /notifications createNotification
	//
	// Creates a notification for a user
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: Body
	//   in: body
	//   description: notification to create
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/UserNotification"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/UserNotification"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var notification model.UserNotification
	if err = json.Unmarshal(requestBody, &notification); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "createNotification", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)

	// Create and broadcast notification
	created, err := a.app.CreateAndBroadcastNotification(&notification)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("CreateNotification",
		mlog.String("targetUserID", notification.TargetUserID),
		mlog.String("type", notification.Type),
	)

	data, err := json.Marshal(created)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

func (a *API) handleMarkAsRead(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /notifications/{notificationID}/read markNotificationAsRead
	//
	// Marks a notification as read
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: notificationID
	//   in: path
	//   description: Notification ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	notificationID := vars["notificationID"]
	userID := getUserID(r)

	auditRec := a.makeAuditRecord(r, "markNotificationAsRead", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)

	if err := a.app.MarkNotificationAsRead(notificationID, userID); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleMarkAllAsRead(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /notifications/read-all markAllNotificationsAsRead
	//
	// Marks all notifications as read
	//
	// ---
	// produces:
	// - application/json
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	userID := getUserID(r)

	auditRec := a.makeAuditRecord(r, "markAllNotificationsAsRead", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)

	if err := a.app.MarkAllNotificationsAsRead(userID); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleDeleteNotification(w http.ResponseWriter, r *http.Request) {
	// swagger:operation DELETE /notifications/{notificationID} deleteNotification
	//
	// Deletes a notification
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: notificationID
	//   in: path
	//   description: Notification ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	notificationID := vars["notificationID"]
	userID := getUserID(r)

	auditRec := a.makeAuditRecord(r, "deleteNotification", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)

	if err := a.app.DeleteUserNotification(notificationID, userID); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}
