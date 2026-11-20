import { ExternalLink, Store } from 'lucide-react'

/** Código de rastreio dos Correios: 2 letras + 9 dígitos + 2 letras (ex.: AE168147545BR). */
const RE_CORREIOS = /\b([A-Z]{2}\d{9}[A-Z]{2})\b/g

export function linkCorreios(codigo: string) {
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(codigo)}`
}

/** Mostra o texto do evento com os códigos de rastreio clicáveis (abre o site dos Correios). */
export function TextoComRastreio({ texto, className = '' }: { texto?: string | null; className?: string }) {
  if (!texto) return null
  if (/^\s*retira\s*$/i.test(texto)) {
    return <span className={`inline-flex items-center gap-1 text-xs text-gray-600 ${className}`}><Store className="w-3 h-3" /> Retirado no laboratório</span>
  }
  const partes = texto.split(RE_CORREIOS)
  return (
    <span className={`text-xs text-gray-600 ${className}`}>
      {partes.map((p, i) =>
        /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(p) ? (
          <a key={i} href={linkCorreios(p)} target="_blank" rel="noreferrer"
            onClick={() => navigator.clipboard?.writeText(p).catch(() => {})}
            title="Abrir no site dos Correios (o código também é copiado)"
            className="inline-flex items-center gap-0.5 font-mono font-semibold text-primary hover:underline">
            {p}<ExternalLink className="w-3 h-3" />
          </a>
        ) : <span key={i}>{p}</span>,
      )}
    </span>
  )
}
