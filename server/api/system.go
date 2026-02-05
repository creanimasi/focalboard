package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"
)

func (a *API) registerSystemRoutes(r *mux.Router) {
	// System APIs
	r.HandleFunc("/hello", a.handleHello).Methods("GET")
	r.HandleFunc("/ping", a.handlePing).Methods("GET")
	// Avatar GET - no CSRF required for img src loading
	r.HandleFunc("/api/v2/users/{userID}/avatar", a.handleGetAvatar).Methods("GET")
}

func (a *API) handleHello(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /hello hello
	//
	// Responds with `Hello` if the web service is running.
	//
	// ---
	// produces:
	// - text/plain
	// responses:
	//   '200':
	//     description: success
	stringResponse(w, "Hello")
}

func (a *API) handlePing(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /ping ping
	//
	// Responds with server metadata if the web service is running.
	//
	// ---
	// produces:
	// - application/json
	// responses:
	//   '200':
	//     description: success
	serverMetadata := a.app.GetServerMetadata()

	if a.singleUserToken != "" {
		serverMetadata.SKU = "personal_desktop"
	}

	if serverMetadata.Edition == "plugin" {
		serverMetadata.SKU = "suite"
	}

	bytes, err := json.Marshal(serverMetadata)
	if err != nil {
		a.errorResponse(w, r, err)
	}

	jsonStringResponse(w, 200, string(bytes))
}

func (a *API) handleGetAvatar(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /users/{userID}/avatar getAvatar
	//
	// Get user avatar
	//
	// ---
	// produces:
	// - image/jpeg
	// - image/png
	// - image/gif
	// parameters:
	// - name: userID
	//   in: path
	//   description: User ID
	//   required: true
	//   type: string
	// responses:
	//   '200':
	//     description: success
	//   '404':
	//     description: avatar not found

	vars := mux.Vars(r)
	userID := vars["userID"]

	avatarsDir := filepath.Join(a.app.GetConfig().FilesPath, "avatars")

	// Try different extensions
	for _, ext := range []string{".jpg", ".png", ".gif", ".webp"} {
		avatarPath := filepath.Join(avatarsDir, userID+ext)
		if _, err := os.Stat(avatarPath); err == nil {
			// File exists, serve it
			contentType := "image/jpeg"
			switch ext {
			case ".png":
				contentType = "image/png"
			case ".gif":
				contentType = "image/gif"
			case ".webp":
				contentType = "image/webp"
			}
			w.Header().Set("Content-Type", contentType)
			w.Header().Set("Cache-Control", "public, max-age=86400") // Cache for 24 hours
			http.ServeFile(w, r, avatarPath)
			return
		}
	}

	// No avatar found, return 404
	http.NotFound(w, r)
}
