import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { Bell, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function Header() {
  const { user, logout } = useAuthStore()
  const [showNotifs, setShowNotifs] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null)
  const [notifPopupOpen, setNotifPopupOpen] = useState(false)

  const { data, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
  })

  const unread = data?.unreadCount || 0

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`)
    refetch()
  }

  const openNotification = async (notif: any) => {
    if (!notif.read) {
      await markRead(notif.id)
    }
    setSelectedNotif(notif)
    setNotifPopupOpen(true)
  }

  const clearNotifications = async () => {
    await api.delete('/notifications/clear')
    setNotifPopupOpen(false)
    setSelectedNotif(null)
    refetch()
  }

  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
          {showNotifs && (
            <div className="absolute right-0 top-12 w-96 bg-white rounded-xl border shadow-xl z-50 overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <p className="font-semibold text-sm">Notificações</p>
                <div className="flex items-center gap-3">
                  {unread > 0 && (
                    <button onClick={() => api.patch('/notifications/read-all').then(() => refetch())}
                      className="text-xs text-primary hover:underline">Marcar todas como lidas</button>
                  )}
                  {(data?.notifications?.length || 0) > 0 && (
                    <button onClick={clearNotifications}
                      className="text-xs text-red-600 hover:underline">Limpar notificações</button>
                  )}
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y">
                {(!data?.notifications || data.notifications.length === 0) && (
                  <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma notificação</p>
                )}
                {data?.notifications?.map((n: any) => (
                  <div key={n.id} onClick={() => openNotification(n)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}>
                    <p className={`text-sm ${!n.read ? 'font-medium' : ''}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      <Dialog open={notifPopupOpen} onOpenChange={setNotifPopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNotif?.title || 'Notificação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedNotif?.message || '-'}</p>
            <p className="text-xs text-gray-500">{selectedNotif?.createdAt ? formatDateTime(selectedNotif.createdAt) : ''}</p>
            {selectedNotif?.link && (
              <Button size="sm" onClick={() => { window.location.href = selectedNotif.link }}>
                Abrir notificação
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
