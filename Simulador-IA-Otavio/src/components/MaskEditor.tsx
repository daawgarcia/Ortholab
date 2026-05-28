"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface MaskEditorProps {
  imageSrc: string;
  onMaskReady: (maskDataUrl: string) => void;
  onBack: () => void;
}

export default function MaskEditor({ imageSrc, onMaskReady, onBack }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 });

  // Load image and set up canvases
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;

      const maxW = container.clientWidth;
      const maxH = 500;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const displayW = Math.round(img.width * scale);
      const displayH = Math.round(img.height * scale);

      setImgDimensions({ width: img.width, height: img.height, displayWidth: displayW, displayHeight: displayH });

      // Visible canvas (image + overlay)
      const canvas = canvasRef.current!;
      canvas.width = displayW;
      canvas.height = displayH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, displayW, displayH);

      // Mask canvas (hidden, full resolution)
      const maskCanvas = maskCanvasRef.current!;
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
      const maskCtx = maskCanvas.getContext("2d")!;
      // Start fully black (opaque = don't edit)
      maskCtx.fillStyle = "black";
      maskCtx.fillRect(0, 0, img.width, img.height);

      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const draw = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current!;
    const maskCanvas = maskCanvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const maskCtx = maskCanvas.getContext("2d")!;

    const scaleX = imgDimensions.width / imgDimensions.displayWidth;
    const scaleY = imgDimensions.height / imgDimensions.displayHeight;

    // Draw on visible canvas (red overlay)
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#00b4d8";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Draw on mask canvas (white = transparent = area to edit)
    maskCtx.fillStyle = "white";
    maskCtx.beginPath();
    maskCtx.arc(x * scaleX, y * scaleY, (brushSize / 2) * scaleX, 0, Math.PI * 2);
    maskCtx.fill();
  }, [brushSize, imgDimensions]);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    draw(pos.x, pos.y);
  }, [getPos, draw]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    draw(pos.x, pos.y);
  }, [isDrawing, getPos, draw]);

  const handleEnd = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleReset = useCallback(() => {
    const canvas = canvasRef.current!;
    const maskCanvas = maskCanvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const maskCtx = maskCanvas.getContext("2d")!;

    // Redraw image
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageSrc;

    // Reset mask to black
    maskCtx.fillStyle = "black";
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, [imageSrc]);

  const handleConfirm = useCallback(() => {
    const maskCanvas = maskCanvasRef.current!;
    const maskCtx = maskCanvas.getContext("2d")!;

    // Convert mask: white areas become transparent (area to edit), black stays opaque (preserve)
    const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 128) {
        // White → transparent (area the AI will edit)
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        // Black → opaque (area to preserve)
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    maskCtx.putImageData(imageData, 0, 0);

    const maskDataUrl = maskCanvas.toDataURL("image/png");
    onMaskReady(maskDataUrl);
  }, [onMaskReady]);

  return (
    <div className="w-full max-w-2xl">
      <div className="glass-card p-6 rounded-2xl">
        {/* Instructions */}
        <div className="mb-4 text-center">
          <h3 className="text-lg font-semibold mb-1">
            <span className="gradient-text">Selecione a região dos dentes</span>
          </h3>
          <p className="text-[var(--ea-gray)] text-sm">
            Pinte sobre os dentes com o pincel. Apenas a área pintada será modificada pela IA — o resto da foto permanece idêntico.
          </p>
        </div>

        {/* Brush size */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-xs text-[var(--ea-gray)]">Pincel:</span>
          <input
            type="range"
            min="5"
            max="60"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-40 accent-[var(--ea-blue)]"
          />
          <span className="text-xs text-[var(--ea-blue)] w-8">{brushSize}px</span>
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1 rounded-lg border border-[var(--ea-gray)]/30 text-[var(--ea-gray)] hover:bg-white/5"
          >
            Limpar
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-xl cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        {/* Hidden mask canvas */}
        <canvas ref={maskCanvasRef} className="hidden" />

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl border border-[var(--ea-gray)]/30 text-[var(--ea-gray)] hover:bg-white/5 transition-all"
          >
            Voltar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imageLoaded}
            className="btn-primary px-8 py-3 rounded-xl text-white font-semibold flex items-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            Simular Sorriso
          </button>
        </div>
      </div>
    </div>
  );
}
