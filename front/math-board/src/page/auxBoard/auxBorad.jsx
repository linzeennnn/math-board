import React, { useRef, useEffect, useState } from "react";
import { getStroke } from "perfect-freehand";
import { createWS, getWSUrl } from "../../util/ws";

export default function SmoothBoard() {

  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const strokesRef = useRef([]);
  const wsRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);

  /* ===============================
   WebSocket
   =============================== */

  useEffect(() => {
    wsRef.current = createWS(getWSUrl("/ws?role=aux"));
  }, []);

  /* ===============================
   Canvas Resize
   =============================== */

  useEffect(() => {
    const canvas = canvasRef.current;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawAll();
    };

    resize();
    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ===============================
   坐标转换
   =============================== */

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();

    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);

    return [x - rect.left, y - rect.top];
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
        w: 8
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
      size: 18,
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
    const ctx = canvasRef.current.getContext("2d");

    strokesRef.current.forEach(stroke => {

      const polygon = getStroke(stroke.p, {
        size: 18,
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
   Bounding Box
   =============================== */

  const getStrokesBoundingBox = () => {

    if (!strokesRef.current.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    strokesRef.current.forEach(stroke => {
      stroke.p.forEach(([x, y]) => {

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

      });
    });

    return { minX, minY, maxX, maxY };
  };

  /* ===============================
   Export JSON
   =============================== */

  const exportJSON = async () => {

    if (!strokesRef.current.length) return;

    const json = JSON.stringify({
      strokes: strokesRef.current
    });

    console.log("压缩后大小:", (json.length / 1024).toFixed(2), "KB");

    wsRef.current?.send(json);
  };

  /* ===============================
   Clear
   =============================== */

  const clear = () => {
    strokesRef.current = [];

    const ctx = canvasRef.current.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
  };

  /* ===============================
   Render
   =============================== */

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
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
          background: "#f8f9fa"
        }}
      />

      <div style={{ position: "fixed", bottom: 20, right: 20 }}>
        <button onClick={exportJSON}>导出 JSON</button>
        <button onClick={clear}>清空</button>
      </div>
    </div>
  );
}