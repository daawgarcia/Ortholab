import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

const schema = z.object({ email: z.string().email('E-mail inválido'), password: z.string().min(1, 'Senha obrigatória') })

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', data)
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken, res.data.pendingPushes)
      navigate('/')
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro no login', description: err.response?.data?.error || 'Tente novamente' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 sidebar-gradient items-center justify-center p-12">
        <div className="text-white max-w-md">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-8">EA</div>
          <h1 className="text-4xl font-bold mb-4">Ortholab</h1>
          <p className="text-white/70 text-lg leading-relaxed">
            O portal digital do laboratório Esthetic Aligner. Envie casos, acompanhe planejamentos e solicite a produção dos seus alinhadores.
          </p>
          <div className="mt-10 space-y-3">
            {['Envio de casos com documentação completa','Aprovação do setup ortodôntico','Acompanhamento em tempo real','Histórico completo de tratamentos'].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/80 text-sm">
                <div className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h2>
            <p className="text-muted-foreground mt-1">Entre com suas credenciais para acessar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{String(errors.email.message)}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueceu a senha?</Link>
              </div>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{String(errors.password.message)}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Não tem conta?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">Cadastre-se</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
