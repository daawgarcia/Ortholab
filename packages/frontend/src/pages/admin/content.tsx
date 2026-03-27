import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Save, Upload, FileText, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : 'http://localhost:3001'

const PAGES = [
  { slug: 'precos', label: 'Tabela de Preços', hint: 'Informe os preços dos serviços ou faça upload de um PDF/arquivo.' },
  { slug: 'regras', label: 'Regras e Políticas', hint: 'Defina as regras de utilização, prazo de entrega, políticas de revisão, etc.' },
  { slug: 'servicos', label: 'Catálogo de Serviços', hint: 'Descreva os serviços disponíveis para os dentistas credenciados.' },
]

function ContentEditor({ slug, label, hint }: { slug: string; label: string; hint: string }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState<string | undefined>(undefined)
  const [uploading, setUploading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['content', slug],
    queryFn: () => api.get(`/content/${slug}`).then(r => r.data.page),
    retry: false,
    onSuccess: (d: any) => { if (body === undefined) setBody(d?.body || '') },
  })

  if (body === undefined && data) setBody(data.body || '')

  const saveMut = useMutation({
    mutationFn: () => api.put(`/content/${slug}`, { title: label, body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content', slug] }); toast({ title: 'Conteúdo salvo!' }) },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  })

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', label)
      await api.post(`/content/${slug}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['content', slug] })
      toast({ title: 'Arquivo enviado com sucesso!' })
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro no upload'
      toast({ title: msg, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-gray-800">{label}</h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-gray-400">{hint}</p>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Texto / Descrição</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none font-mono"
            rows={6}
            placeholder="Digite o conteúdo aqui..."
            value={body ?? (data?.body || '')}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        {data?.fileUrl && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border rounded-lg px-3 py-2">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{data.fileName || 'Arquivo atual'}</span>
            <a href={`${API_BASE}${data.fileUrl}`} target="_blank" rel="noreferrer"
              className="ml-auto text-xs text-primary hover:underline shrink-0">Visualizar</a>
          </div>
        )}

        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.docx,.xlsx,.jpg,.png,.jpeg"
          onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]) }} />

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
            Upload de arquivo
          </Button>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Salvar texto
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AdminContentPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conteúdo — Preços, Regras e Serviços</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie o conteúdo exibido para os dentistas credenciados</p>
      </div>
      {PAGES.map(p => <ContentEditor key={p.slug} {...p} />)}
    </div>
  )
}
