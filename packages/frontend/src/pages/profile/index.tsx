import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit } = useForm({ defaultValues: user || {} })

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      await api.patch('/users/profile', data)
      toast({ title: 'Perfil atualizado com sucesso!' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao atualizar perfil' })
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>
      <Card>
        <CardHeader><CardTitle>Informações Pessoais</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2"><Label>Nome completo</Label><Input {...register('name')} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" {...register('email')} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input {...register('phone')} /></div>
            <div className="space-y-2"><Label>CRO</Label><Input {...register('cro')} /></div>
            <div className="space-y-2"><Label>Clínica</Label><Input {...register('clinic')} /></div>
            <div className="col-span-2 space-y-2"><Label>Endereço de entrega</Label><Input {...register('deliveryAddress')} /></div>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
