"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import UploadArea from "@/components/UploadArea";
import ResultView from "@/components/ResultView";
import Disclaimer from "@/components/Disclaimer";
import MaskEditor from "@/components/MaskEditor";

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecione uma imagem válida.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 10MB.");
      return;
    }
    setError(null);
    setResultImage(null);
    setActiveProvider(null);
    setMaskImage(null);
    setShowMaskEditor(false);
    const reader = new FileReader();
    reader.onload = (e) => setOriginalImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleSimulate = async () => {
    if (!originalImage) return;

    setLoading(true);
    setError(null);
    try {
      const payload = maskImage
        ? { image: originalImage, mask: maskImage }
        : { image: originalImage };

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar imagem.");
      setResultImage(data.result);
      setActiveProvider(typeof data.provider === "string" ? data.provider : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setOriginalImage(null);
    setResultImage(null);
    setActiveProvider(null);
    setMaskImage(null);
    setShowMaskEditor(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col items-center px-4 py-8 max-w-6xl mx-auto w-full">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simulador de Sorriso{" "}
            <span className="gradient-text">by EA</span>
          </h1>
          <p className="text-[var(--ea-gray)] text-lg max-w-2xl mx-auto">
            Envie uma foto sorrindo e veja como ficará seu sorriso após o
            tratamento com alinhadores Esthetic Aligner.
          </p>
        </div>

        {/* Main Content */}
        {!resultImage ? (
          <div className="w-full max-w-2xl">
            {showMaskEditor && originalImage ? (
              <MaskEditor
                imageSrc={originalImage}
                onMaskReady={(maskDataUrl) => {
                  setMaskImage(maskDataUrl);
                  setShowMaskEditor(false);
                  setError(null);
                }}
                onBack={() => setShowMaskEditor(false)}
              />
            ) : (
              <UploadArea
                onFileSelect={handleFileSelect}
                originalImage={originalImage}
                fileInputRef={fileInputRef}
              />
            )}

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-center gap-4">
              {originalImage && (
                <>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-50 transition-all"
                  >
                    Trocar foto
                  </button>
                  <button
                    onClick={() => setShowMaskEditor(true)}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl border border-[var(--ea-blue)]/40 text-[var(--ea-blue)] hover:bg-[var(--ea-blue)]/5 transition-all"
                  >
                    {maskImage ? "Refazer máscara" : "Marcar dentes"}
                  </button>
                  <button
                    onClick={handleSimulate}
                    disabled={loading}
                    className="btn-primary px-8 py-3 rounded-xl text-white font-semibold flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <LoadingSpinnerSmall />
                        Processando...
                      </>
                    ) : (
                      <>
                        <SparklesIcon />
                        Simular Sorriso
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {originalImage && !showMaskEditor && (
              <div className="mt-3 text-center text-sm text-[var(--ea-gray)]">
                <p>
                  {maskImage
                    ? "Máscara manual pronta. A IA vai usar exatamente a área marcada."
                    : "Modo automático ativo: a IA detecta os dentes sozinha. Se quiser, use Marcar dentes para ajuste fino."}
                </p>
                {activeProvider && (
                  <p className="mt-2 font-medium text-[var(--ea-blue)]">
                    Provider ativo: {activeProvider === "replicate" ? "Replicate" : "OpenAI"}
                  </p>
                )}
              </div>
            )}

            {loading && (
              <div className="mt-8 w-full max-w-lg mx-auto">
                <ScanningEffect imageSrc={originalImage!} />
              </div>
            )}
          </div>
        ) : (
          <ResultView
            originalImage={originalImage!}
            resultImage={resultImage}
            provider={activeProvider}
            onReset={handleReset}
          />
        )}

        <Disclaimer />
      </div>
    </main>
  );
}

function LoadingSpinnerSmall() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ScanningEffect({ imageSrc }: { imageSrc: string }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    { label: "Analisando estrutura facial...", icon: "🔍" },
    { label: "Detectando arcada dentária...", icon: "🦷" },
    { label: "Mapeando pontos de referência...", icon: "📐" },
    { label: "Gerando simulação com IA...", icon: "✨" },
    { label: "Refinando resultado...", icon: "🎯" },
  ];

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 5000);
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 0.4, 95));
    }, 100);
    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [steps.length]);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[var(--ea-blue)]/20">
      {/* Image with overlay */}
      <div className="relative">
        <img
          src={imageSrc}
          alt="Processando"
          className="w-full object-cover max-h-[400px]"
        />

        {/* Dark scan overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/70 via-[#0a1628]/50 to-[#0a1628]/70" />

        {/* Scanning line */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="scan-line absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--ea-blue)] to-transparent shadow-[0_0_15px_var(--ea-blue),0_0_30px_var(--ea-blue)]" />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(var(--ea-blue) 1px, transparent 1px), linear-gradient(90deg, var(--ea-blue) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />

        {/* Corner brackets */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[var(--ea-blue)] rounded-tl-sm" />
        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[var(--ea-blue)] rounded-tr-sm" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[var(--ea-blue)] rounded-bl-sm" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[var(--ea-blue)] rounded-br-sm" />

        {/* Floating data points */}
        <div className="absolute top-[30%] left-[25%] scan-dot w-2 h-2 rounded-full bg-[var(--ea-blue)] shadow-[0_0_8px_var(--ea-blue)]" />
        <div className="absolute top-[35%] right-[30%] scan-dot-delay w-2 h-2 rounded-full bg-[var(--ea-blue)] shadow-[0_0_8px_var(--ea-blue)]" />
        <div className="absolute top-[55%] left-[40%] scan-dot w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_cyan]" />
        <div className="absolute top-[50%] right-[35%] scan-dot-delay w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_cyan]" />
        <div className="absolute top-[45%] left-[50%] scan-dot w-2 h-2 rounded-full bg-[var(--ea-blue)] shadow-[0_0_8px_var(--ea-blue)]" />

        {/* Center target reticle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16">
          <div className="absolute inset-0 border border-[var(--ea-blue)]/40 rounded-full animate-ping" />
          <div className="absolute inset-2 border border-[var(--ea-blue)]/60 rounded-full scan-rotate" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[var(--ea-blue)] shadow-[0_0_10px_var(--ea-blue)]" />
          </div>
        </div>

        {/* HUD text */}
        <div className="absolute top-4 left-14 text-[10px] font-mono text-[var(--ea-blue)]/80 tracking-wider">
          AI SCAN ACTIVE
        </div>
        <div className="absolute top-4 right-14 text-[10px] font-mono text-cyan-400/80 tracking-wider">
          {Math.round(progress)}%
        </div>
      </div>

      {/* Bottom info panel */}
      <div className="bg-white p-5">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-[var(--ea-blue)] to-cyan-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                i < step ? "text-green-500" : i === step ? "text-[var(--ea-blue)] font-medium" : "text-gray-300"
              }`}
            >
              <span className="text-base w-6 text-center">
                {i < step ? "✓" : i === step ? s.icon : "○"}
              </span>
              <span>{s.label}</span>
              {i === step && (
                <span className="ml-auto">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[var(--ea-blue)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-[var(--ea-blue)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-[var(--ea-blue)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}
