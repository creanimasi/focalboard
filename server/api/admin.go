package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type AdminSetPasswordData struct {
	Password string `json:"password"`
}

// AdminUpdateUserData is the data for updating a user
type AdminUpdateUserData struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password,omitempty"`
}

func (a *API) registerAdminRoutes(r *mux.Router) {
	// Admin User Management APIs
	r.HandleFunc("/admin/users", a.sessionRequired(a.handleAdminGetAllUsers)).Methods("GET")
	r.HandleFunc("/admin/users/{userID}", a.sessionRequired(a.handleAdminGetUser)).Methods("GET")
	r.HandleFunc("/admin/users/{userID}", a.sessionRequired(a.handleAdminUpdateUser)).Methods("PUT")
	r.HandleFunc("/admin/users/{userID}", a.sessionRequired(a.handleAdminDeleteUser)).Methods("DELETE")
}

func (a *API) handleAdminSetPassword(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	username := vars["username"]

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var requestData AdminSetPasswordData
	err = json.Unmarshal(requestBody, &requestData)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "adminSetPassword", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)
	auditRec.AddMeta("username", username)

	if !strings.Contains(requestData.Password, "") {
		a.errorResponse(w, r, model.NewErrBadRequest("password is required"))
		return
	}

	err = a.app.UpdateUserPassword(username, requestData.Password)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("AdminSetPassword, username: %s", mlog.String("username", username))

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

// handleAdminGetAllUsers returns all registered users (admin only)
func (a *API) handleAdminGetAllUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	// Check if user has system admin permission
	if !a.permissions.HasPermissionTo(session.UserID, model.PermissionManageSystem) {
		a.errorResponse(w, r, model.NewErrUnauthorized("not authorized to access admin panel"))
		return
	}

	auditRec := a.makeAuditRecord(r, "adminGetAllUsers", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)

	users, err := a.app.GetAllUsers()
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	data, err := json.Marshal(users)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

// handleAdminGetUser returns a specific user by ID (admin only)
func (a *API) handleAdminGetUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	// Check if user has system admin permission
	if !a.permissions.HasPermissionTo(session.UserID, model.PermissionManageSystem) {
		a.errorResponse(w, r, model.NewErrUnauthorized("not authorized to access admin panel"))
		return
	}

	vars := mux.Vars(r)
	userID := vars["userID"]

	auditRec := a.makeAuditRecord(r, "adminGetUser", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)
	auditRec.AddMeta("userID", userID)

	user, err := a.app.GetUser(userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	data, err := json.Marshal(user)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

// handleAdminUpdateUser updates a user (admin only)
func (a *API) handleAdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	// Check if user has system admin permission
	if !a.permissions.HasPermissionTo(session.UserID, model.PermissionManageSystem) {
		a.errorResponse(w, r, model.NewErrUnauthorized("not authorized to access admin panel"))
		return
	}

	vars := mux.Vars(r)
	userID := vars["userID"]

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var updateData AdminUpdateUserData
	err = json.Unmarshal(requestBody, &updateData)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "adminUpdateUser", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)
	auditRec.AddMeta("userID", userID)

	// Get existing user
	user, err := a.app.GetUser(userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// Update fields
	if updateData.Username != "" {
		user.Username = updateData.Username
	}
	if updateData.Email != "" {
		user.Email = updateData.Email
	}

	// Update user
	updatedUser, err := a.app.UpdateUser(user)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// Update password if provided
	if updateData.Password != "" {
		err = a.app.UpdateUserPasswordByID(userID, updateData.Password)
		if err != nil {
			a.errorResponse(w, r, err)
			return
		}
	}

	a.logger.Debug("AdminUpdateUser, userID: %s", mlog.String("userID", userID))

	data, err := json.Marshal(updatedUser)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

// handleAdminDeleteUser deletes a user (admin only)
func (a *API) handleAdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	// Check if user has system admin permission
	if !a.permissions.HasPermissionTo(session.UserID, model.PermissionManageSystem) {
		a.errorResponse(w, r, model.NewErrUnauthorized("not authorized to access admin panel"))
		return
	}

	vars := mux.Vars(r)
	userID := vars["userID"]

	auditRec := a.makeAuditRecord(r, "adminDeleteUser", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)
	auditRec.AddMeta("userID", userID)

	// Prevent deleting yourself
	if userID == session.UserID {
		a.errorResponse(w, r, model.NewErrBadRequest("cannot delete yourself"))
		return
	}

	err := a.app.DeleteUser(userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("AdminDeleteUser, userID: %s", mlog.String("userID", userID))

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}
