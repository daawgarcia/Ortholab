import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'

/**
 * LGPD: no primeiro acesso (e sempre que o texto for atualizado) o usuário precisa aceitar
 * os Termos de Uso e a Política de Privacidade. O aceite fica registrado (data, IP, versão).
 */
export function AceiteTermos() {
  const { user, logout } = useAuthStore()
  const qc = useQueryClient()
  const [marcado, setMarcado] = useState(false)
  const [aba, setAba] = useState(0)

  const { data } = useQuery({
    queryKey: ['lgpd-termos', user?.id],
    queryFn: () => api.get('/lgpd/termos/pendentes').then(r => r.data),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
  const pendentes: any[] = data?.pendentes || []

  const aceitar = useMutation({
    mutationFn: () => api.post('/lgpd/termos/aceitar', { documentos: pendentes.map(p => ({ slug: p.slug, version: p.version })) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lgpd-termos'] }),
  })

  if (!pendentes.length) return null
  const doc = pendentes[Math.min(aba, pendentes.length - 1)]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Privacidade e proteção de dados</h2>
            <p className="text-sm text-gray-500">Para continuar, leia e aceite os documentos abaixo (LGPD).</p>
          </div>
        </div>
        {pendentes.length > 1 && (
          <div className="flex gap-1 border-b px-6 pt-2">
            {pendentes.map((p, i) => (
              <button key={p.slug} onClick={() => setAba(i)}
                className={`rounded-t-md px-3 py-2 text-sm ${i === aba ? 'border-b-2 border-primary font-medium text-primary' : 'text-gray-500'}`}>
                {p.title}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h3 className="mb-3 font-semibold text-gray-900">{doc.title}</h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{doc.body}</div>
        </div>
        <div className="space-y-3 border-t px-6 py-4">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5" checked={marcado} onChange={e => setMarcado(e.target.checked)} />
            Li e aceito {pendentes.map(p => p.title).join(' e ')}.
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={logout}>Sair</Button>
            <Button disabled={!marcado || aceitar.isPending} onClick={() => aceitar.mutate()} className="gap-2">
              {aceitar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Aceitar e continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
