export default function Disclaimer() {
  return (
    <div className="mt-12 mb-6 max-w-2xl mx-auto text-center">
      <div className="glass-card p-4 rounded-xl">
        <p className="text-xs text-[var(--ea-gray)] leading-relaxed">
          <strong className="text-[var(--ea-blue)]">Aviso importante:</strong> Esta é uma{" "}
          <strong>simulação gerada por Inteligência Artificial</strong> com fins
          meramente ilustrativos. O resultado real do tratamento pode variar. Esta
          imagem não constitui diagnóstico, planejamento clínico ou garantia de
          resultado. Consulte um dentista credenciado Esthetic Aligner para uma
          avaliação personalizada. Suas fotos{" "}
          <strong>não são armazenadas</strong> em nossos servidores.
        </p>
      </div>
      <p className="text-[10px] text-gray-400 mt-4">
        Esthetic Aligner Ortholab Ltda – CRO 984 – RT: Dr Fernando Stefanato
        Buranello – CRO SP – 77334
      </p>
    </div>
  );
}
