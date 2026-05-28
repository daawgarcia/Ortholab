"use client";

import { useState } from "react";
import Image from "next/image";

interface ResultViewProps {
  originalImage: string;
  resultImage: string;
  provider?: string | null;
  onReset: () => void;
}

export default function ResultView({ originalImage, resultImage, provider, onReset }: ResultViewProps) {
  const [view, setView] = useState<"side" | "slider">("side");
  const [sliderPos, setSliderPos] = useState(50);

  return (
    <div className="w-full max-w-5xl">
      {provider && (
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-[var(--ea-blue)]/30 bg-[var(--ea-blue)]/10 px-4 py-2 text-sm font-medium text-[var(--ea-blue)]">
            Provider ativo: {provider === "replicate" ? "Replicate" : "OpenAI"}
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setView("side")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            view === "side"
              ? "bg-[var(--ea-blue)]/20 text-[var(--ea-blue)] border border-[var(--ea-blue)]/30"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          Lado a Lado
        </button>
        <button
          onClick={() => setView("slider")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            view === "slider"
              ? "bg-[var(--ea-blue)]/20 text-[var(--ea-blue)] border border-[var(--ea-blue)]/30"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          Comparação Deslizante
        </button>
      </div>

      {view === "side" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Before */}
          <div className="glass-card glow-blue p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-[var(--ea-gray)]" />
              <span className="text-sm font-medium text-[var(--ea-gray)]">ANTES</span>
            </div>
            <Image
              src={originalImage}
              alt="Antes"
              width={500}
              height={400}
              className="rounded-xl w-full object-contain max-h-[400px]"
            />
          </div>

          {/* After */}
          <div className="glass-card glow-blue p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-[var(--ea-teal)]" />
              <span className="text-sm font-medium text-[var(--ea-teal)]">DEPOIS (SIMULAÇÃO IA)</span>
            </div>
            <Image
              src={resultImage}
              alt="Depois"
              width={500}
              height={400}
              className="rounded-xl w-full object-contain max-h-[400px]"
            />
          </div>
        </div>
      ) : (
        /* Slider comparison */
        <div className="glass-card glow-blue p-4 rounded-2xl">
          <div
            className="comparison-container relative select-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setSliderPos(((e.clientX - rect.left) / rect.width) * 100);
            }}
            onTouchMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const touch = e.touches[0];
              setSliderPos(((touch.clientX - rect.left) / rect.width) * 100);
            }}
          >
            {/* After (full) */}
            <Image
              src={resultImage}
              alt="Depois"
              width={800}
              height={600}
              className="w-full rounded-xl object-contain"
            />
            {/* Before (clipped) */}
            <div
              className="absolute inset-0 overflow-hidden rounded-xl"
              style={{ width: `${sliderPos}%` }}
            >
              <Image
                src={originalImage}
                alt="Antes"
                width={800}
                height={600}
                className="w-full h-full object-contain"
                style={{ minWidth: `${(100 / sliderPos) * 100}%` }}
              />
            </div>
            {/* Slider line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 cursor-col-resize"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-[var(--ea-dark)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>
            {/* Labels */}
            <div className="absolute bottom-4 left-4 bg-white/90 shadow-sm px-3 py-1 rounded-lg text-xs font-medium text-gray-700">
              ANTES
            </div>
            <div className="absolute bottom-4 right-4 bg-[var(--ea-blue)]/80 px-3 py-1 rounded-lg text-xs font-medium text-white">
              DEPOIS
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4 mt-8">
        <button
          onClick={onReset}
          className="px-6 py-3 rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-50 transition-all"
        >
          Nova Simulação
        </button>
        <a
          href={resultImage}
          download="simulacao-sorriso-esthetic-aligner.png"
          className="btn-primary px-8 py-3 rounded-xl text-white font-semibold flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Baixar Resultado
        </a>
      </div>
    </div>
  );
}
