import React, { useRef, useEffect, useState } from "react";
import { Check, RotateCcw, PenLine, X } from "lucide-react";

export default function SignaturePad({ onSave, onCancel, existingSignature, signerName: initialSignerName }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [signerName, setSignerName] = useState(initialSignerName || "");
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Set canvas dimensions to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
    };
  }

  function startDraw(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
    setIsDrawing(true);
    setIsEmpty(false);
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function endDraw(e) {
    e.preventDefault();
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }

  function handleSave() {
    if (isEmpty && !existingSignature) return;
    const canvas = canvasRef.current;
    const dataUrl = isEmpty ? existingSignature : canvas.toDataURL("image/png");
    onSave({ signatureDataUrl: dataUrl, signerName, signedAt: new Date().toISOString() });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-gray-400 text-sm block mb-1">Full Name</label>
        <input
          type="text"
          value={signerName}
          onChange={e => setSignerName(e.target.value)}
          placeholder="Customer full name"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-sky-500"
        />
      </div>

      <div>
        <label className="text-gray-400 text-sm block mb-1 flex items-center gap-1">
          <PenLine className="w-3.5 h-3.5" /> Signature
        </label>
        <div className="relative rounded-lg border-2 border-dashed border-gray-600 bg-gray-800/50 overflow-hidden" style={{ touchAction: "none" }}>
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: "180px", cursor: "crosshair", display: "block" }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-600 text-sm">Sign here with your finger or mouse</p>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <button onClick={clearCanvas} className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {existingSignature && isEmpty && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
          <p className="text-green-400 text-xs mb-2">Previously captured signature:</p>
          <img src={existingSignature} alt="Existing signature" className="max-h-16 rounded" style={{ filter: "invert(0)" }} />
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm flex items-center justify-center gap-2">
          <X className="w-4 h-4" /> Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isEmpty && !existingSignature}
          className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" /> Save Signature
        </button>
      </div>
    </div>
  );
}