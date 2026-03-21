import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try { await api.post('/auth/forgot-password', { email }); setDone(true) } 
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar ao login
        </Link>
        {done ? (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">E-mail enviado!</h2>
            <p className="text-muted-foreground text-sm">Se o e-mail estiver cadastrado, você receberá as instruções em breve.</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-1">Recuperar senha</h2>
            <p className="text-muted-foreground text-sm mb-6">Informe seu e-mail para receber o link de recuperação</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Enviar link
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
