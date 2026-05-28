import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { 
  Play, Download, CheckCircle, XCircle, FileText, 
  Video, Clock, Eye, Loader2, AlertCircle 
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface ApprovalVideo {
  id: string
  title: string
  description?: string
  videoUrl: string
  thumbnailUrl?: string
  fileSize?: number
  duration?: number
  status: 'PENDING' | 'VIEWED' | 'APPROVED' | 'REJECTED' | 'DOWNLOADED'
  viewedAt?: string
  downloadedAt?: string
  createdAt: string
  uploader: { id: string; name: string }
}

interface ApprovalDocument {
  id: string
  title: string
  description?: string
  fileUrl: string
  fileName: string
  fileSize?: number
  status: 'PENDING' | 'VIEWED' | 'APPROVED' | 'REJECTED' | 'DOWNLOADED'
  viewedAt?: string
  downloadedAt?: string
  createdAt: string
  uploader: { id: string; name: string }
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '-'
  const mb = bytes / (1024 * 1024)
  return mb > 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`
}

function formatDuration(seconds?: number) {
  if (!seconds) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function CaseApprovalPage() {
  const { caseId } = useParams()
  const qc = useQueryClient()
  const [selectedVideo, setSelectedVideo] = useState<ApprovalVideo | null>(null)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['case-approvals', caseId],
    queryFn: () => api.get(`/cases/${caseId}/approvals`).then(r => r.data),
  })

  const videos: ApprovalVideo[] = data?.videos || []
  const documents: ApprovalDocument[] = data?.documents || []

  // Marcar vídeo como visualizado
  const viewMutation = useMutation({
    mutationFn: (videoId: string) => api.post(`/cases/video/${videoId}/view`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['case-approvals', caseId] }),
  })

  // Download do vídeo
  const downloadMutation = useMutation({
    mutationFn: (videoId: string) => api.post(`/cases/video/${videoId}/download`).then(r => r.data),
    onSuccess: (data) => {
      window.open(data.downloadUrl, '_blank')
      qc.invalidateQueries({ queryKey: ['case-approvals', caseId] })
    },
  })

  // Aprovar/Rejeitar
  const approveMutation = useMutation({
    mutationFn: ({ videoId, approved, notes }: { videoId: string; approved: boolean; notes?: string }) => api.post(`/cases/video/${videoId}/approve`, { approved, notes }).then(r => r.data),
    onSuccess: (data) => {
      toast({ 
        title: data.approved ? 'Caso aprovado!' : 'Revisão solicitada',
        variant: data.approved ? 'default' : 'destructive'
      })
      qc.invalidateQueries({ queryKey: ['case-approvals', caseId] })
      setShowApproveDialog(false)
      setApprovalNotes('')
    },
  })

  const handlePlayVideo = (video: ApprovalVideo) => {
    setSelectedVideo(video)
    if (video.status === 'PENDING') {
      viewMutation.mutate(video.id)
    }
  }

  const handleDownload = (video: ApprovalVideo) => {
    downloadMutation.mutate(video.id)
  }

  const handleApprove = (approved: boolean) => {
    if (!selectedVideo) return
    approveMutation.mutate({
      videoId: selectedVideo.id,
      approved,
      notes: approvalNotes,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const hasPendingItems = videos.some(v => v.status === 'PENDING') || documents.some(d => d.status === 'PENDING')

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aprovação do Caso</h1>
          <p className="text-gray-500 mt-1">
            Assista aos vídeos e revise os documentos para aprovar o caso
          </p>
        </div>
        {hasPendingItems && (
          <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Aguardando sua aprovação</span>
          </div>
        )}
      </div>

      {/* Vídeos */}
      {videos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Video className="w-5 h-5" />
            Vídeos de Aprovação
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((video) => (
              <Card key={video.id} className={video.status === 'PENDING' ? 'border-amber-300' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{video.title}</CardTitle>
                      {video.description && (
                        <p className="text-sm text-gray-500 mt-1">{video.description}</p>
                      )}
                    </div>
                    {video.status === 'PENDING' && (
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                        Novo
                      </span>
                    )}
                    {video.status === 'APPROVED' && (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Aprovado
                      </span>
                    )}
                    {video.status === 'REJECTED' && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Rejeitado
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-4 relative group cursor-pointer"
                    onClick={() => handlePlayVideo(video)}
                  >
                    {video.thumbnailUrl ? (
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center">
                        <Video className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-16 h-16 text-white" />
                    </div>
                    
                    {video.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>{formatFileSize(video.fileSize)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(video.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      {video.viewedAt && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Eye className="w-4 h-4" /> Visualizado
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(video)}
                        disabled={downloadMutation.isPending}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Baixar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handlePlayVideo(video)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Assistir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Documentos PDF */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documentos
          </h2>
          <div className="space-y-2">
            {documents.map((doc) => (
              <Card key={doc.id} className={doc.status === 'PENDING' ? 'border-amber-300' : ''}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-gray-500">
                        {doc.fileName} • {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(doc.fileUrl, '_blank')}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Visualizar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {videos.length === 0 && documents.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Nenhum material de aprovação disponível ainda.</p>
          <p className="text-sm">Aguarde o laboratório enviar o vídeo/documento.</p>
        </div>
      )}

      {/* Player de Vídeo Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
            {selectedVideo?.description && (
              <DialogDescription>{selectedVideo.description}</DialogDescription>
            )}
          </DialogHeader>
          
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {selectedVideo && (
              <video
                src={selectedVideo.videoUrl}
                controls
                className="w-full h-full"
                autoPlay
              />
            )}
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => selectedVideo && handleDownload(selectedVideo)}
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar Vídeo
              </Button>
            </div>
            
            {selectedVideo?.status !== 'APPROVED' && selectedVideo?.status !== 'REJECTED' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowApproveDialog(true)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Solicitar Revisão
                </Button>
                <Button
                  onClick={() => setShowApproveDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Aprovar Caso
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Aprovação */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
            <DialogDescription>
              Você está prestes a aprovar o caso. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Observações (opcional)</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 mt-1"
                rows={3}
                placeholder="Alguma observação sobre a aprovação..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleApprove(false)}
                disabled={approveMutation.isPending}
              >
                Solicitar Revisão
              </Button>
              <Button
                onClick={() => handleApprove(true)}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Aprovar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
