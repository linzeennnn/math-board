package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var senderConn *websocket.Conn
var receiverConn *websocket.Conn

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	r := gin.Default()

	r.GET("/ws", wsHandler)

	r.Run(":5678")
}

func wsHandler(c *gin.Context) {

	role := c.Query("role")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	// ⭐ 直接绑定角色连接
	if role == "aux" {
		senderConn = conn
	}

	if role == "main" {
		receiverConn = conn
	}

	// 监听消息
	go listen(conn, role)
}

func listen(conn *websocket.Conn, role string) {

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		// ⭐ sender → receiver 转发
		if role == "aux" && receiverConn != nil {
			receiverConn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}
