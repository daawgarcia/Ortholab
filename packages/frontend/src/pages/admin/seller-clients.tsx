import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export function SellerClientsPage() {
  const queryClient = useQueryClient()
  const [selectedSellerId, setSelectedSellerId] = useState<string>('')
  const [sellerSearch, setSellerSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [newClientId, setNewClientId] = useState('')
  const [openDialog, setOpenDialog] = useState(false)

  // Load sellers list
  const { data: sellersData, isLoading: sellersLoading } = useQuery({
    queryKey: ['sellers', sellerSearch],
    queryFn: async () => {
      const res = await api.get(`/seller-clients?search=${sellerSearch}`)
      return res.data
    },
  })

  // Load available clients (all users who are not sellers)
  const { data: clientsData } = useQuery({
    queryKey: ['available-clients'],
    queryFn: async () => {
      const res = await api.get('/admin/users?role=DENTIST,ADMIN')
      return res.data
    },
  })

  // Load selected seller's clients
  const { data: selectedClientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['seller-clients', selectedSellerId, clientSearch],
    queryFn: async () => {
      if (!selectedSellerId) return { clients: [] }
      const res = await api.get(`/seller-clients/${selectedSellerId}/clients?search=${clientSearch}`)
      return res.data
    },
    enabled: !!selectedSellerId,
  })

  // Mutação para adicionar cliente
  const addClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await api.post(`/seller-clients/${selectedSellerId}/clients`, { clientId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-clients', selectedSellerId] })
      setNewClientId('')
      setOpenDialog(false)
      toast({ title: 'Cliente adicionado com sucesso' })
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao adicionar cliente', description: err.response?.data?.error, variant: 'destructive' })
    },
  })

  // Remove client mutation
  const removeClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await api.delete(`/seller-clients/${selectedSellerId}/clients/${clientId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-clients', selectedSellerId] })
      toast({ title: 'Cliente removido com sucesso' })
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao remover cliente', description: err.response?.data?.error, variant: 'destructive' })
    },
  })

  const sellers = sellersData?.sellers || []
  const selectedClients = selectedClientsData?.clients || []
  const availableClients = clientsData?.users || []

  // Get already linked client IDs
  const linkedClientIds = selectedClients.map((c: any) => c.id)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Gerenciar Carteira de Vendedores</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sellers List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Vendedores</h2>

          <Input
            placeholder="Buscar vendedor..."
            value={sellerSearch}
            onChange={(e) => setSellerSearch(e.target.value)}
            className="mb-4"
          />

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sellersLoading ? (
              <p className="text-gray-500">Carregando...</p>
            ) : sellers.length === 0 ? (
              <p className="text-gray-500">Nenhum vendedor encontrado</p>
            ) : (
              sellers.map((seller: any) => (
                <button
                  key={seller.id}
                  onClick={() => setSelectedSellerId(seller.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition ${
                    selectedSellerId === seller.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{seller.name}</div>
                  <div className="text-sm text-gray-500">{seller.email}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Clients Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Clientes do Vendedor</h2>
            {selectedSellerId && (
              <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus size={16} /> Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Cliente</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Select value={newClientId} onValueChange={setNewClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClients
                          .filter((c: any) => !linkedClientIds.includes(c.id))
                          .map((client: any) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name} ({client.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => {
                        if (newClientId) {
                          addClientMutation.mutate(newClientId)
                        }
                      }}
                      disabled={!newClientId || addClientMutation.isPending}
                      className="w-full"
                    >
                      {addClientMutation.isPending ? 'Adicionando...' : 'Adicionar'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {!selectedSellerId ? (
            <p className="text-gray-500">Selecione um vendedor para gerenciar seus clientes</p>
          ) : (
            <>
              <Input
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="mb-4"
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clientsLoading ? (
                  <p className="text-gray-500">Carregando...</p>
                ) : selectedClients.length === 0 ? (
                  <p className="text-gray-500">Nenhum cliente vinculado</p>
                ) : (
                  selectedClients.map((client: any) => (
                    <div
                      key={client.id}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div>
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-gray-500">{client.email}</div>
                        {client.clinic && <div className="text-xs text-gray-400">{client.clinic}</div>}
                      </div>
                      <button
                        onClick={() => removeClientMutation.mutate(client.id)}
                        disabled={removeClientMutation.isPending}
                        className="p-2 hover:bg-red-100 rounded-lg transition text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SellerClientsPage
