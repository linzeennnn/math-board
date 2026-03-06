package main

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"golang.design/x/clipboard"
)

var (
	senderConn   *websocket.Conn
	receiverConn *websocket.Conn

	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

func main() {
	// 初始化剪贴板
	if err := clipboard.Init(); err != nil {
		panic(err)
	}

	r := gin.Default()

	// ===== API 路由 =====
	r.GET("/ws", wsHandler)
	r.POST("/api/clipboard", clipboardHandler)

	// ===== 静态文件（绝对路径）=====
	webRoot := getWebRoot()

	r.NoRoute(func(c *gin.Context) {
		path := filepath.Join(webRoot, c.Request.URL.Path)

		// 如果文件存在且不是目录，直接返回
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			c.File(path)
			return
		}

		// 默认返回首页
		c.File(filepath.Join(webRoot, "index.html"))
	})

	fmt.Println("服务启动 :5678")
	r.Run(":5678")
}

// ===== 剪贴板处理 =====

func clipboardHandler(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "未找到文件字段 file"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(500, gin.H{"error": "无法打开文件"})
		return
	}
	defer src.Close()

	img, _, err := image.Decode(src)
	if err != nil {
		// 兜底：直接读取原始数据
		src.Seek(0, 0)
		data, _ := io.ReadAll(src)
		writeToClipboard(data, c)
		return
	}

	buf := new(bytes.Buffer)
	if err := png.Encode(buf, img); err != nil {
		c.JSON(500, gin.H{"error": "PNG编码失败"})
		return
	}

	writeToClipboard(buf.Bytes(), c)
}

func writeToClipboard(data []byte, c *gin.Context) {
	changed := clipboard.Write(clipboard.FmtImage, data)

	select {
	case <-changed:
	default:
	}

	c.JSON(200, gin.H{
		"message": "已写入剪贴板",
		"size":    len(data),
	})
}

// ===== WebSocket =====

func wsHandler(c *gin.Context) {
	role := c.Query("role")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	if role == "aux" {
		senderConn = conn
	} else {
		receiverConn = conn
	}

	go listen(conn, role)
}

func listen(conn *websocket.Conn, role string) {
	defer conn.Close()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		if role == "aux" && receiverConn != nil {
			receiverConn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}

// ===== 工具函数 =====

// 获取 web 目录绝对路径（基于可执行文件）
func getWebRoot() string {
	exe, err := os.Executable()
	if err != nil {
		panic(err)
	}

	return filepath.Join(filepath.Dir(exe), "web")
}
