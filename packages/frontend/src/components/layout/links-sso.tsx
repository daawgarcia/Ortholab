import { useState } from 'react'
import { ExternalLink, Gift, LayoutGrid, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/use-toast'

/** Atalhos de login único: abre o Portal do Credenciado ou o Esthetic Rewards já logado. */
export function LinksSso({ compacto = false }: { compacto?: boolean }) {
  const [abrindo, setAbrindo] = useState('')
  const abrir = async (destino: 'portal' | 'rewards') => {
    // abre a aba já no clique (evita bloqueio de pop-up) e só depois põe o endereço
    const aba = window.open('about:blank', '_blank')
    setAbrindo(destino)
    try {
      const { data } = await api.post('/auth/sso/link', { destino })
      if (aba) aba.location.href = data.url
      else window.location.href = data.url
    } catch (e: any) {
      aba?.close()
      toast({ variant: 'destructive', title: 'Não foi possível abrir', description: e?.response?.data?.error || 'Tente novamente.' })
    } finally {
      setAbrindo('')
    }
  }
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white transition-colors'
  return (
    <div className="space-y-0.5">
      {!compacto && <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Acesso rápido</p>}
      <button type="button" className={item} onClick={() => abrir('portal')}>
        {abrindo === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
        <span className="flex-1 text-left">Portal do Credenciado</span><ExternalLink className="h-3.5 w-3.5 opacity-50" />
      </button>
      <button type="button" className={item} onClick={() => abrir('rewards')}>
        {abrindo === 'rewards' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        <span className="flex-1 text-left">Esthetic Rewards</span><ExternalLink className="h-3.5 w-3.5 opacity-50" />
      </button>
    </div>
  )
}
