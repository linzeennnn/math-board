import React, { useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { createWS, getWSUrl } from "../../util/ws";
import { getStroke } from "perfect-freehand";
import "@/css/main.css";

export default function MainBoard() {
  const editorRef = useRef(null);

  useEffect(() => {
    const ws = createWS(getWSUrl("/ws?role=main"));

    ws.onMessage(async e => {
      try {
        const jsonData = JSON.parse(e.data);
        const imageUrl = await renderJsonToImage(jsonData);
        if (!imageUrl) return;
        insertImageAtCursor(imageUrl);
      } catch (err) {
        console.error(err);
      }
    });

    return () => ws.close();
  }, []);

  const renderJsonToImage = async (jsonData) => {
    if (!jsonData?.strokes?.length) return null;

    const padding = 24;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const polygons = jsonData.strokes.map(stroke =>
      getStroke(stroke.p, {
        size: (stroke.w || 4) * 1.8,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5
      })
    );

    polygons.forEach(poly => {
      poly.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });

    if (!isFinite(minX)) return null;

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;

    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.translate(-minX + padding, -minY + padding);

    polygons.forEach((polygon, index) => {
      if (!polygon.length) return;
      const stroke = jsonData.strokes[index];

      ctx.beginPath();
      ctx.moveTo(polygon[0][0], polygon[0][1]);
      for (let i = 1; i < polygon.length; i++) {
        ctx.lineTo(polygon[i][0], polygon[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = stroke?.c || "#333";
      ctx.fill();
    });

    return canvas.toDataURL("image/png");
  };

  const insertImageAtCursor = (url) => {
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);

    const img = document.createElement("img");
    img.src = url;
    img.className = "editor-image";

    range.insertNode(img);
    range.setStartAfter(img);
    range.setEndAfter(img);

    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => insertImageAtCursor(event.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

const exportAsImage = async (text = "") => {
  if (!editorRef.current) return;

  const contentCanvas = await html2canvas(editorRef.current, {
    useCORS: true,
    scale: 2,
    backgroundColor: "transparent"
  });

  const padding = 40;
  const fontSize = 48;
  const textHeight = text ? fontSize + 20 : 0;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = contentCanvas.width;
  finalCanvas.height = contentCanvas.height + textHeight + padding;

  const ctx = finalCanvas.getContext("2d");

  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  ctx.drawImage(contentCanvas, 0, 0);

  if (text) {
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const centerX = finalCanvas.width / 2;
    const textY = contentCanvas.height + padding / 2;

    ctx.fillText(text, centerX, textY);
  }

  // ⭐ 转 Blob
  finalCanvas.toBlob(async (blob) => {
    if (!blob) return;

    try {
      const formData = new FormData();
      formData.append("file", blob, "clipboard.png");

      const res = await fetch("/api/clipboard", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error("上传失败");
      }

      console.log("图片已上传到 /api/clipboard");
    } catch (err) {
      console.error(err);
    }
  }, "image/png");
};

  return (
    <div className="main-container">
      <div className="toolbar">
        <button
          className="btn btn-light"
          onClick={() => document.getElementById("file-input").click()}
        >
          插入图片
        </button>

        <input
          id="file-input"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden-input"
        />

        <button
          className="btn btn-dark"
          onClick={() => exportAsImage("lllllllll")}
        >
          保存
        </button>
        <button>
          
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="editor"
      />
    </div>
  );
}