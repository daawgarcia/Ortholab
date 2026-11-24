import { useEffect, useRef, useState } from 'react'

/**
 * Player de vídeo que não "enrosca": se o endereço assinado expirar ou a conexão cair no meio,
 * pede um endereço novo e continua do mesmo ponto. Para .mov que o navegador não toca, oferece baixar.
 */
export function VideoSeguro({ src, obterUrl, nome, onPlay, className }: { src?: string; obterUrl?: () => Promise<string>; nome?: string; onPlay?: () => void; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [url, setUrl] = useState<string | undefined>(src)
  const [falhou, setFalhou] = useState(false)
  const tentativas = useRef(0)
  const retomarEm = useRef(0)

  useEffect(() => {
    let vivo = true
    if (!src && obterUrl) obterUrl().then(u => { if (vivo) setUrl(u) }).catch(() => { if (vivo) setFalhou(true) })
    else setUrl(src)
    return () => { vivo = false }
  }, [src])

  async function recuperar() {
    const v = ref.current
    if (!obterUrl || tentativas.current >= 3) { setFalhou(true); return }
    tentativas.current += 1
    retomarEm.current = v?.currentTime || 0
    try {
      const novo = await obterUrl()
      setUrl(novo + (novo.includes('?') ? '&' : '?') + '_r=' + tentativas.current)
    } catch { setFalhou(true) }
  }

  const ehMov = /\.mov(\?|$)/i.test(nome || url || '')
  return (
    <div className="relative bg-black">
      {!falhou && url && (
        <video
          ref={ref}
          key={url}
          src={url}
          controls
          preload="metadata"
          playsInline
          className={className || 'w-full max-h-[500px] bg-black'}
          onPlay={onPlay}
          onLoadedMetadata={() => { const v = ref.current; if (v && retomarEm.current) { v.currentTime = retomarEm.current; retomarEm.current = 0; v.play().catch(() => {}) } }}
          onError={() => { recuperar() }}
          onStalled={() => { const v = ref.current; if (v && v.readyState < 3 && !v.paused) setTimeout(() => { if (ref.current && ref.current.readyState < 3) recuperar() }, 8000) }}
        />
      )}
      {!url && !falhou && <div className="flex h-48 items-center justify-center text-sm text-gray-400">Carregando vídeo…</div>}
      {falhou && (
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-gray-200">
          <p>{ehMov ? 'Este vídeo está em formato .mov, que alguns navegadores não conseguem tocar.' : 'Não foi possível carregar o vídeo agora.'}</p>
          <div className="flex gap-2">
            <button type="button" className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={() => { tentativas.current = 0; setFalhou(false); recuperar() }}>Tentar de novo</button>
            {url && <a className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20" href={url} target="_blank" rel="noreferrer" download>Baixar o vídeo</a>}
          </div>
        </div>
      )}
    </div>
  )
}
