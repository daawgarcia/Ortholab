import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PlayCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type Video = {
  id: string
  title: string
  description?: string
  vimeoUrl: string
  thumbnail?: string
  category: string
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match ? match[1] : null
}

function VideoPlayer({ video, onClose }: { video: Video; onClose: () => void }) {
  const vimeoId = getVimeoId(video.vimeoUrl)
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">{video.title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>
        <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
          {vimeoId ? (
            <iframe
              className="absolute inset-0 w-full h-full rounded-xl"
              src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`}
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 bg-gray-900 rounded-xl flex items-center justify-center text-white/50">
              URL de vídeo inválida
            </div>
          )}
        </div>
        {video.description && (
          <p className="text-white/70 text-sm">{video.description}</p>
        )}
      </div>
    </div>
  )
}

function VideoCard({ video, onClick }: { video: Video; onClick: () => void }) {
  const vimeoId = getVimeoId(video.vimeoUrl)
  const thumb = video.thumbnail || (vimeoId ? `https://vumbnail.com/${vimeoId}.jpg` : null)

  return (
    <div onClick={onClick} className="group cursor-pointer bg-white border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-video bg-gray-100">
        {thumb ? (
          <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
            <PlayCircle className="w-12 h-12 text-primary/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
            <PlayCircle className="w-8 h-8 text-primary" />
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-primary transition-colors">{video.title}</h3>
        {video.description && (
          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{video.description}</p>
        )}
      </div>
    </div>
  )
}

export function VideosPage({ category, title, subtitle }: { category: 'VIDEO_AULA' | 'WEBINAR'; title: string; subtitle: string }) {
  const [playing, setPlaying] = useState<Video | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['videos', category],
    queryFn: () => api.get(`/videos?category=${category}`).then(r => r.data.videos as Video[]),
  })

  return (
    <div className="p-6 space-y-6">
      {playing && <VideoPlayer video={playing} onClose={() => setPlaying(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-gray-100 rounded-xl aspect-video animate-pulse" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="text-center py-16 bg-white border rounded-xl">
          <PlayCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Nenhum conteúdo disponível ainda</p>
          <p className="text-gray-300 text-sm mt-1">Em breve novos conteúdos serão adicionados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(v => (
            <VideoCard key={v.id} video={v} onClick={() => setPlaying(v)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function VideoAulasPage() {
  return <VideosPage category="VIDEO_AULA" title="Vídeo Aulas" subtitle="Assista às aulas e tutoriais da Esthetic Aligner" />
}
