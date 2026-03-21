import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2, CheckCircle } from 'lucide-react'

const schema = z.object({
  name: z.string().min(3, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  cro: z.string().min(1, 'CRO obrigatório'),
  clinic: z.string().min(1, 'Clínica obrigatória'),
  phone: z.string().min(10, 'Telefone obrigatório'),
})

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      await api.post('/auth/register', data)
      setDone(true)
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro no cadastro', description: err.response?.data?.error || 'Tente novamente' })
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Cadastro enviado!</h2>
        <p className="text-muted-foreground mb-6">Seu cadastro foi recebido e está aguardando aprovação do administrador. Você receberá um e-mail quando for aprovado.</p>
        <Button onClick={() => navigate('/login')} variant="outline">Voltar ao login</Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">EA</div>
            <span className="font-semibold text-sm text-muted-foreground">Ortholab</span>
          </div>
          <h2 className="text-2xl font-bold">Criar conta</h2>
          <p className="text-muted-foreground text-sm mt-1">Preencha seus dados para solicitar acesso</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nome completo</Label>
              <Input placeholder="Dr. João Silva" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{String(errors.name.message)}</p>}
            </div>
            <div className="space-y-2">
              <Label>CRO</Label>
              <Input placeholder="SP-12345" {...register('cro')} />
              {errors.cro && <p className="text-xs text-destructive">{String(errors.cro.message)}</p>}
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(11) 99999-9999" {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{String(errors.phone.message)}</p>}
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Clínica</Label>
              <Input placeholder="Clínica Odontológica..." {...register('clinic')} />
              {errors.clinic && <p className="text-xs text-destructive">{String(errors.clinic.message)}</p>}
            </div>
            <div className="col-span-2 space-y-2">
              <Label>E-mail</Label>
              <Input type="email" placeholder="seu@email.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{String(errors.email.message)}</p>}
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Senha</Label>
              <Input type="password" placeholder="Mínimo 8 caracteres" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{String(errors.password.message)}</p>}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Solicitar cadastro
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Já tem conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
