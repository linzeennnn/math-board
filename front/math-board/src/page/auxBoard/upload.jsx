import React, { useState, useRef, useEffect } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import '@/css/aux.css'
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

  /* =========================
     WebSocket Send
  ========================= */

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

  /* =========================
     File Input
  ========================= */

  const handleFileChange = (e) => {
    const files = e.target.files;

    if (files?.length) {
      const reader = new FileReader();

      reader.onload = () => {
        setImage(reader.result);
        setModalVisible(true);
      };

      reader.readAsDataURL(files[0]);
    }
  };

  /* =========================
     Text Wrap Utility
  ========================= */

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

  /* =========================
     Crop + Text Render
  ========================= */

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

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCtx.font = `bold ${fontSize}px Arial`;

    const lines = wrapText(tempCtx, text, maxTextWidth);

    const extraHeight = lines.length * lineHeight + fontSize;

    const newCanvas = document.createElement("canvas");
    newCanvas.width = width;
    newCanvas.height = height + extraHeight;

    const ctx = newCanvas.getContext("2d");

    ctx.drawImage(croppedCanvas, 0, 0);

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

  /* =========================
     Modal Control
  ========================= */

  const closeModal = () => {
    setModalVisible(false);
    setImage(null);

    if (fileInputRef.current)
      fileInputRef.current.value = "";
  };

  /* =========================
     Render
  ========================= */

  return (
    <>
      <button
        className="upload-trigger-btn"
        onClick={() => fileInputRef.current?.click()}
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
        <div className="upload-overlay">

          <div className="upload-header">
            <span style={{ fontWeight: "bold" }}>裁剪图片</span>

            <button
              className="upload-close-x"
              onClick={closeModal}
            >
              ✕
            </button>
          </div>

          <div className="upload-cropper-wrapper">
            <Cropper
              src={image}
              style={{ height: "100%", width: "100%" }}
              initialAspectRatio={NaN}
              guides
              ref={cropperRef}
              viewMode={1}
              dragMode="move"
              background={false}
              responsive
              autoCropArea={0.8}
              checkOrientation={false}
            />
          </div>

          <div className="upload-footer">
            <button
              className="upload-cancel-btn"
              onClick={closeModal}
            >
              取消
            </button>

            <button
              className="upload-confirm-btn"
              onClick={() =>
                handleCropWithText(
                  "提取以上文本为latex,并输出到代码框里"
                )
              }
            >
              提取文本
            </button>

            <button
              className="upload-confirm-btn"
              onClick={() =>
                handleCropWithText("求解以上题目")
              }
            >
              解题
            </button>

            <button
              className="upload-confirm-btn"
              onClick={sendImageViaWS}
            >
              插入
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Upload;