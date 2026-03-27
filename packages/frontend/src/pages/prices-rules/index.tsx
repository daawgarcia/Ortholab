import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { FileText, Download, ExternalLink } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : 'http://localhost:3001'

const SLUGS = [
  { slug: 'precos', label: 'Tabela de Preços' },
  { slug: 'regras', label: 'Regras e Políticas' },
  { slug: 'servicos', label: 'Catálogo de Serviços' },
]

function ContentCard({ slug, label }: { slug: string; label: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['content', slug],
    queryFn: () => api.get(`/content/${slug}`).then(r => r.data.page),
    retry: false,
  })

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-gray-800">{data?.title || label}</h2>
      </div>
      <div className="p-5">
        {isLoading ? (
          <div className="h-20 flex items-center justify-center text-gray-400 text-sm">Carregando...</div>
        ) : !data ? (
          <p className="text-gray-400 text-sm italic">Conteúdo não cadastrado ainda.</p>
        ) : (
          <div className="space-y-4">
            {data.body && (
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                {data.body}
              </div>
            )}
            {data.fileUrl && (
              <a href={`${API_BASE}${data.fileUrl}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium">
                <Download className="w-4 h-4" />
                {data.fileName || 'Baixar arquivo'}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
            {!data.body && !data.fileUrl && (
              <p className="text-gray-400 text-sm italic">Conteúdo ainda não disponível.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PricesRulesPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Preços, Regras e Serviços</h1>
        <p className="text-gray-500 text-sm mt-1">Informações sobre preços, regras de utilização e catálogo de serviços da Esthetic Aligner</p>
      </div>
      {SLUGS.map(s => <ContentCard key={s.slug} {...s} />)}
    </div>
  )
}
