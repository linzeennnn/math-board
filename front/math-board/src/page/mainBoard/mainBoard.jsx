import React,{ useRef, useEffect, useState } from "react";
import html2canvas from 'html2canvas';
import { createWS, getWSUrl } from "../../util/ws";
import { getStroke } from "perfect-freehand";
export default function MainBoard() {
  const editorRef = useRef(null);
  const wsRef = useRef(null);
  useEffect(() => {
  const ws = createWS(getWSUrl("/ws?role=main"));

 ws.onMessage(async e => {
  try {
    const jsonData = JSON.parse(e.data);

    const imageUrl = await renderJsonToImage(jsonData);

    if (!imageUrl) return;

    moveCursorToEnd(editorRef.current);

    const imgHtml = `<img 
      src="${imageUrl}" 
      style="
            height:150px;
             width:auto;
             vertical-align:bottom;
             margin:0 4px;
             display:inline-block;" />`;

    document.execCommand("insertHTML", false, imgHtml);

    moveCursorToEnd(editorRef.current);

  } catch (err) {
    console.error(err);
  }
});

  wsRef.current = ws;

  return () => ws.close();
}, []);
const renderJsonToImage = async (jsonData) => {
  const width = editorRef.current.clientWidth;
  const height = 500;

  // 创建离屏 canvas（性能最佳）
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;

  const ctx = canvas.getContext("2d");
  ctx.scale(2,2);

  if (!jsonData?.strokes) return null;

  jsonData.strokes.forEach(stroke => {
    const polygon = getStroke(stroke.p, {
      size: (stroke.w || 4)*1.8,
      
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5
    });

    if (!polygon.length) return;

    ctx.beginPath();
    ctx.moveTo(polygon[0][0], polygon[0][1]);

    for(let i=1;i<polygon.length;i++){
      ctx.lineTo(polygon[i][0], polygon[i][1]);
    }

    ctx.closePath();

    ctx.fillStyle = stroke.c || "#333";
    ctx.fill();
  });

  return canvas.toDataURL("image/png");
};
  // 强制将光标移动到编辑器末尾
  const moveCursorToEnd = (el) => {
    el.focus();
    if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false); // false 表示折叠到末尾
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target.result;
        
        // 1. 先将光标移到最后
        moveCursorToEnd(editorRef.current);

        // 2. 插入图片 HTML
        // vertical-align: bottom 确保图片底部与文字对齐
        const imgHtml = `<img src="${imageUrl}" style="height: 1.2em; width: auto; vertical-align: bottom; margin: 0 4px; display: inline-block;" />`;
        document.execCommand('insertHTML', false, imgHtml);

        // 3. 再次移到最后，方便继续输入文字
        moveCursorToEnd(editorRef.current);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // 清空 input
  };

  const exportAsImage = async () => {
    if (editorRef.current) {
      const canvas = await html2canvas(editorRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: 'transparent'
      });
      const link = document.createElement('a');
      link.download = 'export.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

    return (
        <div id="paint-board" style={{ width: '100%', height: '500px', position: 'relative' }}>
       <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={() => document.getElementById('file-input').click()}
          style={{ padding: '10px 20px', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #ccc' }}
        >
          插入图片到末尾
        </button>
        <input id="file-input" type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        
        <button 
          onClick={exportAsImage}
          style={{ marginLeft: '10px', padding: '10px 20px', cursor: 'pointer', background: '#000', color: '#fff', border: 'none' }}
        >
          保存为图片
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        style={{
          border: '1px solid #eee',
          padding: '25px',
          minHeight: '150px',
          lineHeight: '1.8',    // 控制行高
          fontSize: '30px',     // 文字大小
          outline: 'none',
          whiteSpace: 'pre-wrap', // 保留空格和换行
          wordBreak: 'break-all'
        }}
      >
        在这里输入你的文字内容...
      </div>
        </div>
    );
}