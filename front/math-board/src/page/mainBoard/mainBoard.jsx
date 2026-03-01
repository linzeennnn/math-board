import React, { useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { createWS, getWSUrl } from "../../util/ws";
import { getStroke } from "perfect-freehand";

export default function MainBoard() {
  const editorRef = useRef(null);

  /* -----------------------------
   WebSocket 初始化
  ----------------------------- */
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

  /* -----------------------------
   渲染涂鸦 JSON → 图片
  ----------------------------- */
  const renderJsonToImage = async (jsonData) => {
  if (!jsonData?.strokes?.length) return null;

  const padding = 24;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  /* -----------------------------
   Step1. 计算真实 bounding box
  ----------------------------- */
  const polygons = jsonData.strokes.map(stroke => {
    return getStroke(stroke.p, {
      size: (stroke.w || 4) * 1.8,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5
    });
  });

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

  /* -----------------------------
   Step2. 创建裁剪 canvas
  ----------------------------- */
  const canvas = document.createElement("canvas");

  canvas.width = width * 2;
  canvas.height = height * 2;

  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  /* ⭐ 核心平移：把涂鸦移到左上角 */
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

  /* -----------------------------
   光标插入图片（安全版）
  ----------------------------- */
  const insertImageAtCursor = (url) => {
  const el = editorRef.current;
  if (!el) return;

  el.focus();

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();

  /* ⭐ 核心：定位到编辑器末尾 */
  range.selectNodeContents(el);
  range.collapse(false);

  const img = document.createElement("img");

  img.src = url;
  img.style.height = "80px";
  img.style.width = "auto";
  img.style.verticalAlign = "bottom";
  img.style.margin = "0 4px";
  img.style.display = "inline-block";

  range.insertNode(img);

  /* ⭐ 插入后把光标移动到图片后面 */
  range.setStartAfter(img);
  range.setEndAfter(img);

  selection.removeAllRanges();
  selection.addRange(range);
};
  /* -----------------------------
   图片上传插入
  ----------------------------- */
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      insertImageAtCursor(event.target.result);
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /* -----------------------------
   导出整页为图片
  ----------------------------- */
  const exportAsImage = async () => {
    if (!editorRef.current) return;

    const canvas = await html2canvas(editorRef.current, {
      useCORS: true,
      scale: 2,
      backgroundColor: "transparent"
    });

    const link = document.createElement("a");
    link.download = "export.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  /* -----------------------------
   Render
  ----------------------------- */
  return (
    <div style={{ width: "100%", height: "500px", position: "relative" }}>
      <div style={{ marginBottom: 15 }}>
        <button
          onClick={() => document.getElementById("file-input").click()}
          style={{
            padding: "10px 20px",
            cursor: "pointer",
            background: "#f0f0f0",
            border: "1px solid #ccc"
          }}
        >
          插入图片到末尾
        </button>

        <input
          id="file-input"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />

        <button
          onClick={exportAsImage}
          style={{
            marginLeft: 10,
            padding: "10px 20px",
            background: "#000",
            color: "#fff",
            border: "none"
          }}
        >
          保存为图片
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        style={{
          border: "1px solid #eee",
          padding: "25px",
          minHeight: "150px",
          lineHeight: 1.8,
          fontSize: "30px",
          outline: "none",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all"
        }}
      >
      </div>
    </div>
  );
}