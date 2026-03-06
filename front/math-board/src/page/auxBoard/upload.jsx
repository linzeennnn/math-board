import React, { useState, useRef, useEffect } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { createWS, getWSUrl } from "../../util/ws";
const Upload = ({ apiUrl = "/api/clipboard", onUploadSuccess }) => {
  const [image, setImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const cropperRef = useRef(null);
  const fileInputRef = useRef(null);
  const wsRef = useRef(null);
useEffect(() => {
  wsRef.current = createWS(getWSUrl("/ws?role=aux"));
}, []);
const sendImageViaWS = () => {
  const cropper = cropperRef.current?.cropper;
  if (!cropper) return;

  const canvas = cropper.getCroppedCanvas();
  if (!canvas) return;

  canvas.toBlob(blob => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const base64 = reader.result;

      wsRef.current?.send(JSON.stringify({
        type: "image_insert",
        payload: base64
      }));
      closeModal(); 
    };

    reader.readAsDataURL(blob);
  }, "image/png");
};
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result);
        setModalVisible(true);
      };
      reader.readAsDataURL(files[0]);
    }
  };

  // 🔹 文本自动换行函数
  const wrapText = (ctx, text, maxWidth) => {
    const chars = text.split("");
    const lines = [];
    let currentLine = "";

    for (let i = 0; i < chars.length; i++) {
      const testLine = currentLine + chars[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine !== "") {
        lines.push(currentLine);
        currentLine = chars[i];
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const handleCropWithText = (text) => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    const croppedCanvas = cropper.getCroppedCanvas();
    if (!croppedCanvas) return;

    const width = croppedCanvas.width;
    const height = croppedCanvas.height;

    const fontSize = Math.floor(width * 0.04);
    const lineHeight = fontSize * 1.4;
    const horizontalPadding = width * 0.08;
    const maxTextWidth = width - horizontalPadding * 2;

    // 先用临时 canvas 计算行数
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.font = `bold ${fontSize}px Arial`;

    const lines = wrapText(tempCtx, text, maxTextWidth);

    const extraHeight =
      lines.length * lineHeight + fontSize; // 根据行数自动扩展

    const newCanvas = document.createElement("canvas");
    newCanvas.width = width;
    newCanvas.height = height + extraHeight;

    const ctx = newCanvas.getContext("2d");

    // 绘制原图
    ctx.drawImage(croppedCanvas, 0, 0);

    // 设置文字样式
    ctx.fillStyle = "#000000";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const startY = height + fontSize * 0.5;

    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        width / 2,
        startY + index * lineHeight
      );
    });

    newCanvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("file", blob, "cropped_with_text.png");

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          onUploadSuccess?.();
          closeModal();
        } else {
          alert("上传失败");
        }
      } catch (error) {
        console.error("Upload error:", error);
      }
    }, "image/png");
  };

  const closeModal = () => {
    setModalVisible(false);
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        style={styles.triggerBtn}
      >
        上传图片
      </button>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
      />

      {modalVisible && (
        <div style={styles.fullScreenOverlay}>
          <div style={styles.header}>
            <span style={{ fontWeight: "bold" }}>裁剪图片</span>
            <button onClick={closeModal} style={styles.closeX}>
              ✕
            </button>
          </div>

          <div style={styles.cropperWrapper}>
            <Cropper
              src={image}
              style={{ height: "100%", width: "100%" }}
              initialAspectRatio={NaN}
              guides={true}
              ref={cropperRef}
              viewMode={1}
              dragMode="move"
              background={false}
              responsive={true}
              autoCropArea={0.8}
              checkOrientation={false}
            />
          </div>

          <div style={styles.footer}>
            <button onClick={closeModal} style={styles.cancelBtn}>
              取消
            </button>

            <button
              onClick={() =>
                handleCropWithText("提取以上文本为latex,并输出到代码框里")
              }
              style={styles.confirmBtn}
            >
            提取文本
            </button>

            <button
              onClick={() =>
                handleCropWithText("求解以上题目")
              }
              style={styles.confirmBtn}
            >
              解题
            </button>
            <button
            onClick={sendImageViaWS}
            style={styles.confirmBtn}
            >
            插入
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  triggerBtn: {
    padding: "8px 16px",
    background: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    zIndex: "100",
    position: "fixed",
  },
  fullScreenOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "#000",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    height: "50px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    background: "#fff",
  },
  cropperWrapper: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },
  footer: {
    height: "70px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "30px",
    background: "rgba(255, 255, 255, 0.95)",
  },
  closeX: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 30px",
    borderRadius: "25px",
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    minWidth: "100px",
  },
  confirmBtn: {
    padding: "10px 30px",
    borderRadius: "25px",
    border: "none",
    background: "#007bff",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    minWidth: "100px",
  },
};

export default Upload;