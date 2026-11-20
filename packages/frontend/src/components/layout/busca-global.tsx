import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, UserCircle, Stethoscope, CornerDownLeft } from 'lucide-react'
import api from '@/lib/api'
import { useDebounce } from '@/hooks/use-debounce'
import { useAuthStore } from '@/store/auth'

/**
 * Busca rápida no topo (Ctrl+K ou /): pacientes e dentistas enquanto digita.
 * Aceita nome (com ou sem acento, em qualquer ordem, com erro de digitação), nº da caixa ou nome do dentista.
 */
export function BuscaGlobal() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const termo = useDebounce(q.trim(), 250)

  const { data, isFetching } = useQuery({
    queryKey: ['busca-global', termo],
    queryFn: () => api.get('/busca', { params: { q: termo } }).then(r => r.data),
    enabled: termo.length >= 2,
    staleTime: 15000,
  })

  const itens: Array<{ tipo: 'paciente' | 'dentista'; id: string; href: string; titulo: string; sub: string; extra?: string }> = [
    ...(data?.pacientes || []).map((p: any) => ({
      tipo: 'paciente' as const, id: p.id, href: `/patients/${p.id}`, titulo: p.name,
      sub: p.dentist?.name || '', extra: p.boxNumber ? `Cx ${p.boxNumber}` : undefined,
    })),
    ...(data?.dentistas || []).map((d: any) => ({
      tipo: 'dentista' as const, id: d.id, href: `/dentists/${d.id}`, titulo: d.name,
      sub: [d.cro && `CRO ${d.cro}`, d.clinic].filter(Boolean).join(' • '),
      extra: `${d._count?.patients ?? 0} pac.`,
    })),
  ]

  // atalhos: Ctrl+K / Cmd+K ou "/" abre a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      const digitando = alvo?.tagName === 'INPUT' || alvo?.tagName === 'TEXTAREA' || alvo?.isContentEditable
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !digitando)) {
        e.preventDefault()
        inputRef.current?.focus()
        setAberto(true)
      }
    }
    const onClick = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setAberto(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick) }
  }, [])

  useEffect(() => setAtivo(0), [termo])

  const ir = (href: string) => { setAberto(false); setQ(''); navigate(href) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(i => Math.min(i + 1, itens.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      if (itens[ativo]) ir(itens[ativo].href)
      else if (termo.length >= 2) ir(`/patients?busca=${encodeURIComponent(termo)}`)
    }
    if (e.key === 'Escape') { setAberto(false); inputRef.current?.blur() }
  }

  const placeholder = user?.role === 'DENTIST' ? 'Buscar paciente ou nº da caixa' : 'Buscar paciente, caixa ou dentista'
  let idx = -1

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        ref={inputRef}
        value={q}
        onChange={e => { setQ(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-16 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/30"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border bg-white px-1.5 text-[10px] text-gray-400">Ctrl K</span>

      {aberto && termo.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-xl">
          {isFetching && !data && (
            <div className="flex items-center gap-2 p-4 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</div>
          )}
          {data && itens.length === 0 && (
            <div className="p-4 text-sm text-gray-500">Nada encontrado para “{termo}”.</div>
          )}
          {(['paciente', 'dentista'] as const).map(tipo => {
            const grupo = itens.filter(i => i.tipo === tipo)
            if (!grupo.length) return null
            return (
              <div key={tipo}>
                <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {tipo === 'paciente' ? `Pacientes${data?.totalPacientes > grupo.length ? ` (${data.totalPacientes})` : ''}` : 'Dentistas'}
                </p>
                {grupo.map(it => {
                  idx++
                  const meu = idx
                  return (
                    <button key={it.id} onMouseEnter={() => setAtivo(meu)} onClick={() => ir(it.href)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left ${ativo === meu ? 'bg-primary/5' : ''}`}>
                      {tipo === 'paciente'
                        ? <UserCircle className="w-4 h-4 shrink-0 text-gray-400" />
                        : <Stethoscope className="w-4 h-4 shrink-0 text-gray-400" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{it.titulo}</span>
                        {it.sub && <span className="block truncate text-xs text-gray-500">{it.sub}</span>}
                      </span>
                      {it.extra && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600">{it.extra}</span>}
                      {ativo === meu && <CornerDownLeft className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
          {data?.totalPacientes > (data?.pacientes?.length || 0) && (
            <button onClick={() => ir(`/patients?busca=${encodeURIComponent(termo)}`)}
              className="w-full border-t px-3 py-2 text-left text-xs font-medium text-primary hover:bg-gray-50">
              Ver todos os {data.totalPacientes} pacientes encontrados →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
