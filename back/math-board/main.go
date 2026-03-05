package main

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"  // 注册 GIF 解码器
	_ "image/jpeg" // 注册 JPEG 解码器
	"image/png"    // 用于输出 PNG
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"golang.design/x/clipboard"
)

// 全脏器变量，用于管理 WebSocket 连接
var (
	senderConn   *websocket.Conn
	receiverConn *websocket.Conn
	upgrader     = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

func main() {
	// 1. 初始化剪贴板（必须在程序启动时调用）
	err := clipboard.Init()
	if err != nil {
		panic(fmt.Sprintf("无法初始化剪贴板: %v", err))
	}

	r := gin.Default()

	// 路由配置
	r.GET("/ws", wsHandler)
	r.POST("/api/clipboard", clipboardHandler)

	fmt.Println("服务已启动在 :5678")
	r.Run(":5678")
}

// --- 剪贴板上传处理 ---

func clipboardHandler(c *gin.Context) {
	// 获取上传的文件
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未找到文件字段 'file'"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法打开上传文件"})
		return
	}
	defer src.Close()

	// 2. 图像转码：将输入图像(JPG/PNG/GIF) 统一转换为 PNG 字节流
	// 剪贴板库对 PNG 的支持最为标准
	img, _, err := image.Decode(src)
	if err != nil {
		// 如果解码失败，尝试直接读取原始字节（死马当活马医）
		src.Seek(0, 0)
		data, _ := io.ReadAll(src)
		writeToClipboard(data, c)
		return
	}

	// 将 image.Image 编码为 PNG 字节
	buf := new(bytes.Buffer)
	if err := png.Encode(buf, img); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "PNG 编码失败"})
		return
	}

	// 3. 写入剪贴板
	writeToClipboard(buf.Bytes(), c)
}

func writeToClipboard(data []byte, c *gin.Context) {
	// 写入系统剪贴板（图片格式）
	// 注意：这是一个同步操作，会阻塞直到写入完成
	changed := clipboard.Write(clipboard.FmtImage, data)

	// 发送通知（可选：如果有逻辑需要通知监听者，可以在这里处理）
	select {
	case <-changed:
		fmt.Println("剪贴板内容已更新")
	default:
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "已成功复制到剪贴板（未保存到磁盘）",
		"size":    len(data),
	})
}

// --- WebSocket 处理逻辑 ---

func wsHandler(c *gin.Context) {
	role := c.Query("role")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	if role == "aux" {
		senderConn = conn
	} else if role == "main" {
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

		// 简单的转发逻辑：sender(aux) -> receiver(main)
		if role == "aux" && receiverConn != nil {
			receiverConn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}
