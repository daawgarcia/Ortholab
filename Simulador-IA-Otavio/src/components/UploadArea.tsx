"use client";

import { useCallback, useState, RefObject } from "react";
import Image from "next/image";

interface UploadAreaProps {
  onFileSelect: (file: File) => void;
  originalImage: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export default function UploadArea({ onFileSelect, originalImage, fileInputRef }: UploadAreaProps) {
  const [dragover, setDragover] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragover(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragover(false), []);

  return (
    <div
      className={`upload-area glass-card rounded-2xl p-8 text-center cursor-pointer transition-all ${
        dragover ? "dragover" : ""
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />

      {originalImage ? (
        <div className="relative">
          <Image
            src={originalImage}
            alt="Foto enviada"
            width={500}
            height={400}
            className="rounded-xl mx-auto max-h-[400px] object-contain"
          />
          <div className="absolute top-3 left-3 bg-white/90 shadow-sm px-3 py-1 rounded-lg text-xs text-[var(--ea-blue)] font-medium">
            Foto Original
          </div>
        </div>
      ) : (
        <div className="py-8">
          <div className="w-20 h-20 rounded-2xl bg-[var(--ea-blue)]/10 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-[var(--ea-blue)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Envie sua foto sorrindo
          </h3>
          <p className="text-[var(--ea-gray)] text-sm mb-4">
            Arraste e solte ou clique para selecionar
          </p>
          <div className="flex justify-center gap-4 text-xs text-[var(--ea-gray)]">
            <span className="flex items-center gap-1">
              <CheckIcon /> JPG, PNG ou WebP
            </span>
            <span className="flex items-center gap-1">
              <CheckIcon /> Até 10MB
            </span>
            <span className="flex items-center gap-1">
              <CheckIcon /> Sorriso visível
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3 text-[var(--ea-teal)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
