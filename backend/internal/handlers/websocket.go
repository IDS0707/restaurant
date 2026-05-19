package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

var (
	clients   = make(map[*Client]bool)
	clientsMu sync.RWMutex
)

func WSHandler(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{conn: conn}
	clientsMu.Lock()
	clients[client] = true
	clientsMu.Unlock()

	defer func() {
		clientsMu.Lock()
		delete(clients, client)
		clientsMu.Unlock()
		conn.Close()
	}()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func BroadcastMessage(msgType string, payload interface{}) {
	msg := models.WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	clientsMu.RLock()
	defer clientsMu.RUnlock()

	for client := range clients {
		client.mu.Lock()
		client.conn.WriteMessage(websocket.TextMessage, data)
		client.mu.Unlock()
	}
}
