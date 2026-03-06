import React, { useRef, useEffect, useState } from "react";
import { getStroke } from "perfect-freehand";
import { createWS, getWSUrl } from "../../util/ws";
import Upload from "./upload";

export default function SmoothBoard() {
  const canvasRef = useRef(null);
  const [notifyText, setNotifyText] = useState("");
  const pointsRef = useRef([]);
  const strokesRef = useRef([]);
  const wsRef = useRef(null);
const [showToolbar, setShowToolbar] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(7); // 笔迹粗细状态
  const [isRotated, setIsRotated] = useState(false); // 强制横屏状态

  /* ===============================
     WebSocket
  =============================== */
  useEffect(() => {
    wsRef.current = createWS(getWSUrl("/ws?role=aux"));
  }, []);

  /* ===============================
     Canvas Resize (适配旋转)
  =============================== */
  useEffect(() => {
    const canvas = canvasRef.current;

    const resize = () => {
      // 如果处于强制横屏模式，Canvas 的画布宽应等于视口高，高应等于视口宽
      if (isRotated) {
        canvas.width = window.innerHeight;
        canvas.height = window.innerWidth;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      redrawAll();
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isRotated]); // ⭐ 当旋转状态改变时重新触发 resize

  /* ===============================
     坐标转换 (核心修正逻辑)
  =============================== */
  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // 获取原始触点相对于视口的坐标
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    if (!isRotated) {
      // 正常模式：标准减法
      return [clientX - rect.left, clientY - rect.top];
    } else {
      /* 强制横屏模式坐标映射：
         原本的 clientY 变成了画布的 X 轴偏移
         原本的 clientX 变成了画布的 Y 轴反向偏移
      */
      const x = clientY - rect.top;
      const y = rect.right - clientX; 
      return [x, y];
    }
  };

  /* ===============================
     Pointer Event
  =============================== */
  const handlePointerDown = (e) => {
    setIsDrawing(true);
    pointsRef.current = [getPoint(e)];
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;

    const point = getPoint(e);
    pointsRef.current.push(point);

    previewStroke(pointsRef.current);
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;

    setIsDrawing(false);

    const strokeData = simplifyPoints(pointsRef.current);

    if (strokeData.length > 0) {
      strokesRef.current.push({
        p: strokeData,
        c: "#333",
        w: brushSize   // 保存当前粗细
      });
    }

    pointsRef.current = [];
    redrawAll();
  };

  /* ===============================
     Stroke Rendering
  =============================== */
  const previewStroke = (points) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawAll();

    if (points.length < 2) return;

    const stroke = getStroke(points, {
      size: brushSize,
      thinning: 0,
      smoothing: 0.8,
      streamline: 0.8
    });

    drawPolygon(ctx, stroke);
  };

  const drawPolygon = (ctx, points) => {
    if (!points.length) return;

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }

    ctx.closePath();
    ctx.fillStyle = "#333";
    ctx.fill();
  };

  /* ===============================
     历史重绘
  =============================== */
  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokesRef.current.forEach(stroke => {
      const polygon = getStroke(stroke.p, {
        size: stroke.w,
        thinning: 0,
        smoothing: 0.8,
        streamline: 0.8
      });
      drawPolygon(ctx, polygon);
    });
  };

  /* ===============================
     点压缩
  =============================== */
  const simplifyPoints = (points) => {
    const MIN_DIST = 4;
    const result = [];

    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        result.push(points[i]);
        continue;
      }

      const [x, y] = points[i];
      const [lx, ly] = result[result.length - 1];

      const dx = x - lx;
      const dy = y - ly;

      if (Math.sqrt(dx * dx + dy * dy) > MIN_DIST) {
        result.push(points[i]);
      }
    }

    return result;
  };

  /* ===============================
     导出
  =============================== */
const exportJSON = async () => {
    if (!strokesRef.current.length) return;

    // 默认宽高
    let finalWidth = canvasRef.current.width;
    let finalHeight = canvasRef.current.height;
    const processedStrokes = strokesRef.current.map(stroke => {
      return {
        ...stroke,
        // 这里的 p 已经是经过 getPoint 转换后的逻辑坐标了
        p: stroke.p 
      };
    });

    const json = JSON.stringify({
      width: finalWidth,   // 发送当前真实的画布宽度
      height: finalHeight, // 发送当前真实的画布高度
      isRotated: isRotated,
      strokes: processedStrokes
    });
console.log();

    wsRef.current?.send(json);
  };

  const clear = () => {
    strokesRef.current = [];
    redrawAll();
  };

  /* ===============================
     Render
  =============================== */
  return (
  <div style={{ 
    width: "100vw", 
    height: "100vh", 
    overflow: "hidden", 
    position: "relative",
    background: "#f8f9fa" 
  }}>

    {/* 右上角 显示/隐藏 工具栏按钮 */}
    <button
      onClick={() => setShowToolbar(!showToolbar)}
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        zIndex: 20,
        padding: "8px 12px",
        borderRadius: 8,
        border: "none",
        background: "#007bff",
        color: "#fff",
        cursor: "pointer"
      }}
    >
      {showToolbar ? "隐藏工具栏" : "显示工具栏"}
    </button>

    {/* 旋转容器 */}
    <div style={{
      width: isRotated ? "100vh" : "100vw",
      height: isRotated ? "100vw" : "100vh",
      position: "absolute",
      top: isRotated ? "50%" : "0",
      left: isRotated ? "50%" : "0",
      transform: isRotated ? "translate(-50%, -50%) rotate(90deg)" : "none",
      transformOrigin: "center center",
      transition: "transform 0.3s ease"
    }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{
          display: "block",
          touchAction: "none",
          width: "100%",
          height: "100%",
          background: "#fff"
        }}
      />

      {/* 底部工具栏 */}
      {showToolbar && (
        <div style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.9)",
          padding: "10px 20px",
          borderRadius: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          gap: 15,
          zIndex: 10
        }}>
          <button 
            onClick={() => setIsRotated(!isRotated)}
            style={{ fontWeight: "bold", color: isRotated ? "#007bff" : "#333" }}
          >
            {isRotated ? "返回竖屏" : "切换横屏"}
          </button>
          
          <div style={{ height: "20px", width: "1px", background: "#ddd" }} />

          <span>粗细:</span>
          <input
            type="range"
            min="4"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
          <span>{brushSize}</span>

          <button onClick={exportJSON}>发送</button>
          <button onClick={clear}>清空</button>
          
        </div>
      )}
    </div>
    <Upload
          apiUrl="/api/clipboard" 
            onUploadSuccess={(data) => {
              setNotifyText("上传成功");
              setTimeout(() => setNotifyText(""), 1000);
            }}
          />
          <span 
      style={{
        position: "absolute",
        top: 20,
        left: "50%",
        zIndex: 20,
        padding: "8px 12px",
        borderRadius: 8,
        border: "none",
        color: "black",
      }}
          >{notifyText}</span>
  </div>
);
}