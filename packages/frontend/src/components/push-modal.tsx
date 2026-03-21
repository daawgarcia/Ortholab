import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, Zap, X, ExternalLink } from 'lucide-react'
import api from '@/lib/api'

const icons = { INFO: Info, WARNING: AlertTriangle, URGENT: Zap }
const colors = { INFO: 'blue', WARNING: 'yellow', URGENT: 'red' } as const

export function PushModal({ pushes, onClose }: { pushes: any[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const push = pushes[idx]
  if (!push) return null

  const Icon = icons[push.level as keyof typeof icons] || Info
  const color = colors[push.level as keyof typeof colors] || 'blue'

  const dismiss = async () => {
    await api.post(`/push/${push.id}/read`).catch(() => {})
    if (idx < pushes.length - 1) setIdx(idx + 1)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border-t-4 border-${color}-500`}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 bg-${color}-100 rounded-full flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{push.title}</p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{push.body}</p>
              {push.link && (
                <a href={push.link} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2">
                  Ver mais <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex items-center justify-between">
          {pushes.length > 1 && (
            <p className="text-xs text-muted-foreground">{idx + 1} de {pushes.length} avisos</p>
          )}
          <Button onClick={dismiss} className="ml-auto">
            {idx < pushes.length - 1 ? 'Próximo' : 'Entendi'}
          </Button>
        </div>
      </div>
    </div>
  )
}
