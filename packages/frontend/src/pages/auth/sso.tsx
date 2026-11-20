import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

/** Chegada do login único (Portal do Credenciado / Esthetic Rewards): tokens vêm no fragmento da URL. */
export default function SsoPage() {
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1))
    const a = h.get('a')
    const r = h.get('r')
    history.replaceState(null, '', '/sso')
    if (!a || !r) { navigate('/login?sso=expirado', { replace: true }); return }
    useAuthStore.getState().setTokens(a, r)
    api.get('/auth/me')
      .then(res => {
        useAuthStore.getState().setAuth(res.data.user, a, r, [])
        navigate('/', { replace: true })
      })
      .catch(() => setErro('Não foi possível entrar automaticamente. Entre com seu e-mail e senha.'))
  }, [navigate])
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-center">
      {erro
        ? <div><p className="mb-4 text-gray-700">{erro}</p><a className="text-primary font-semibold" href="/login">Ir para o login</a></div>
        : <div className="flex items-center gap-3 text-gray-600"><Loader2 className="h-5 w-5 animate-spin" /> Entrando no Ortholab…</div>}
    </div>
  )
}
