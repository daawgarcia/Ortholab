import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { FileText, Upload, Save, Plus, Trash2, Edit2 } from 'lucide-react'

type VideoCategory = 'VIDEO_AULA' | 'WEBINAR'

type Video = {
  id: string
  title: string
  description?: string
  vimeoUrl: string
  category: VideoCategory
  order: number
  active: boolean
}

type VideoForm = Omit<Video, 'id'>

const emptyForm: VideoForm = { title: '', description: '', vimeoUrl: '', category: 'VIDEO_AULA', order: 0, active: true }

function VideoFormModal({ initial, onSave, onClose }: {
  initial?: Video
  onSave: (data: VideoForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<VideoForm>(initial ? {
    title: initial.title, description: initial.description || '', vimeoUrl: initial.vimeoUrl,
    category: initial.category, order: initial.order, active: initial.active,
  } : emptyForm)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-lg text-gray-900">{initial ? 'Editar Vídeo' : 'Novo Vídeo'}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Título *</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título do vídeo" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">URL do Vimeo *</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono" value={form.vimeoUrl}
              onChange={e => setForm(f => ({ ...f, vimeoUrl: e.target.value }))}
              placeholder="https://vimeo.com/123456789" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={3} value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as VideoCategory }))}>
                <option value="VIDEO_AULA">Vídeo Aula</option>
                <option value="WEBINAR">Webinar</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ordem</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.order}
                onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="accent-primary" />
            <span className="text-sm text-gray-700">Ativo (visível para dentistas)</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { if (!form.title || !form.vimeoUrl) return; onSave(form) }}>
            <Save className="w-4 h-4 mr-1.5" /> Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AdminVideosPage() {
  const qc = useQueryClient()
  const [editItem, setEditItem] = useState<Video | null | 'new'>(null)
  const [filter, setFilter] = useState<VideoCategory | 'ALL'>('ALL')

  const { data } = useQuery({
    queryKey: ['admin-videos'],
    queryFn: () => api.get('/videos').then(r => r.data.videos as Video[]),
  })

  const createMut = useMutation({
    mutationFn: (d: VideoForm) => api.post('/videos', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-videos'] }); setEditItem(null); toast({ title: 'Vídeo criado!' }) },
    onError: () => toast({ title: 'Erro ao criar vídeo', variant: 'destructive' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: VideoForm }) => api.put(`/videos/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-videos'] }); setEditItem(null); toast({ title: 'Vídeo atualizado!' }) },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/videos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-videos'] }); toast({ title: 'Vídeo removido' }) },
  })

  const filtered = data?.filter(v => filter === 'ALL' || v.category === filter) || []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {(editItem === 'new') && (
        <VideoFormModal onSave={d => createMut.mutate(d)} onClose={() => setEditItem(null)} />
      )}
      {editItem && editItem !== 'new' && (
        <VideoFormModal initial={editItem} onSave={d => updateMut.mutate({ id: editItem.id, data: d })} onClose={() => setEditItem(null)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciar Vídeos</h1>
          <p className="text-gray-500 text-sm mt-1">Vídeo Aulas e Webinars disponíveis para os dentistas</p>
        </div>
        <Button onClick={() => setEditItem('new')}><Plus className="w-4 h-4 mr-1.5" /> Novo Vídeo</Button>
      </div>

      <div className="flex gap-2">
        {(['ALL', 'VIDEO_AULA', 'WEBINAR'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {f === 'ALL' ? 'Todos' : f === 'VIDEO_AULA' ? 'Vídeo Aulas' : 'Webinars'}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {!filtered.length ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhum vídeo cadastrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
              <th className="px-5 py-3">Título</th>
              <th className="px-5 py-3">Categoria</th>
              <th className="px-5 py-3">Ordem</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 w-24"></th>
            </tr></thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{v.title}</p>
                    {v.description && <p className="text-gray-400 text-xs truncate max-w-xs">{v.description}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${v.category === 'VIDEO_AULA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {v.category === 'VIDEO_AULA' ? 'Vídeo Aula' : 'Webinar'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{v.order}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${v.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {v.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditItem(v)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm('Remover vídeo?')) deleteMut.mutate(v.id) }}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
