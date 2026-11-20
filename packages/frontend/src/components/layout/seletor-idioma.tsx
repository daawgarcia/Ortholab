import { useEffect } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { aplicarIdioma, IDIOMA_LOCAL, type Idioma } from '@/lib/i18n'

function lerLocal(): Idioma | null {
  try { const v = localStorage.getItem(IDIOMA_LOCAL); return v === 'es' || v === 'pt' ? v : null } catch { return null }
}

/** Idioma em uso: o do usuário logado (vem do país dele) ou o escolhido na tela de login. */
export function useIdioma(): Idioma {
  const idioma = useAuthStore(s => s.user?.idioma)
  return idioma || lerLocal() || 'pt'
}

/** Aplica o idioma na tela inteira sempre que ele muda. */
export function AplicarIdioma() {
  const idioma = useIdioma()
  useEffect(() => { aplicarIdioma(idioma) }, [idioma])
  return null
}

/** Botões PT / ES. Logado: grava a preferência no usuário. Na tela de login: só neste navegador. */
export function SeletorIdioma({ escuro = false }: { escuro?: boolean }) {
  const idioma = useIdioma()
  const user = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  const trocar = async (novo: Idioma) => {
    if (novo === idioma) return
    try { localStorage.setItem(IDIOMA_LOCAL, novo) } catch { /* ignore */ }
    if (user) {
      try { await api.patch('/auth/me/idioma', { idioma: novo }) } catch { /* ignore */ }
      updateUser({ idioma: novo })
    }
    // voltar ao português recarrega a página para restaurar os textos originais
    if (novo === 'pt') window.location.reload()
    else aplicarIdioma(novo)
  }
  const base = escuro ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-700'
  return (
    <div className="flex items-center gap-0.5 text-xs font-semibold" data-no-translate title="Idioma / Idioma">
      {(['pt', 'es'] as Idioma[]).map(i => (
        <button key={i} type="button" onClick={() => trocar(i)}
          className={`rounded px-1.5 py-0.5 uppercase ${idioma === i ? (escuro ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary') : base}`}>
          {i === 'pt' ? 'PT' : 'ES'}
        </button>
      ))}
    </div>
  )
}
