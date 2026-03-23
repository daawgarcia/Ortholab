import { useEffect, useMemo, useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Paperclip, Loader2 } from 'lucide-react'

function buildWsUrl(accessToken: string | null) {
  if (!accessToken) return ''
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/api/chat/ws?token=${accessToken}`
}

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-red-400'}`}
      title={online ? 'Online' : 'Offline'}
    />
  )
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    SELLER: 'Vendedor',
    FINANCIAL: 'Financeiro',
    ADMIN: 'Admin',
    DENTIST: 'Dentista',
  }
  return map[role] || role
}

export default function ChatPage() {
  const { user, accessToken } = useAuthStore()
  const [selectedPeer, setSelectedPeer] = useState<any>(null)
  const [messageText, setMessageText] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()

  const { data: contactsData } = useQuery({
    queryKey: ['chat-contacts'],
    queryFn: () => api.get('/chat/contacts').then(r => r.data),
    enabled: !!user,
    refetchInterval: 15000,
  })

  const { data: convData, refetch: refetchConversations } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => api.get('/chat/conversations').then(r => r.data),
    enabled: !!user,
  })

  const contacts: any[] = useMemo(() => contactsData?.contacts || [], [contactsData])
  const conversations: any[] = useMemo(() => convData?.conversations || [], [convData])

  const extraPeers = useMemo(() => {
    const contactIds = new Set(contacts.map((c: any) => c.id))
    return conversations.filter((conv: any) => !contactIds.has(conv.peer.id)).map((conv: any) => conv.peer)
  }, [contacts, conversations])

  const fetchMessages = async (peerId: string) => {
    const res = await api.get(`/chat/messages/${peerId}`)
    setMessages(res.data.messages)
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
  }

  useEffect(() => {
    if (selectedPeer?.id) fetchMessages(selectedPeer.id)
  }, [selectedPeer])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!user || !accessToken) return
    const wsUrl = buildWsUrl(accessToken)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'message') {
          const msg = payload.message
          setMessages(prev => {
            if (selectedPeer && (msg.senderId === selectedPeer.id || msg.receiverId === selectedPeer.id)) {
              return [...prev, msg]
            }
            return prev
          })
          refetchConversations()
        }
      } catch { /* ignore */ }
    }

    ws.onclose = () => { /* reconnect handled by re-render */ }

    return () => { ws.close() }
  }, [user, accessToken, selectedPeer])

  const sendImage = async (file: File) => {
    if (!selectedPeer) return
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url: string = res.data.url
      await api.post(`/chat/messages/${selectedPeer.id}`, { content: `[img]${url}` })
      await fetchMessages(selectedPeer.id)
      refetchConversations()
    } catch {
      /* silent */
    } finally {
      setUploadingImage(false)
    }
  }

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedPeer) return
    const content = messageText.trim()
    setMessageText('')
    await api.post(`/chat/messages/${selectedPeer.id}`, { content })
    await fetchMessages(selectedPeer.id)
    refetchConversations()
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'message', to: selectedPeer.id, content }))
    }
  }

  const unreadFor = (peerId: string) =>
    conversations.find((c: any) => c.peer.id === peerId)?.unread || 0

  const selectPeer = (peer: any) => {
    setSelectedPeer(peer)
    setMessages([])
  }

  if (!user) return null

  const allContacts = [...contacts]

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Sidebar */}
      <div className="w-72 shrink-0 bg-white border-r flex flex-col">
        <div className="px-4 py-3 border-b">
          <h2 className="text-base font-semibold text-gray-800">Chat</h2>
        </div>

        <div className="flex-1 overflow-y-auto divide-y">
          {allContacts.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhum contato disponível</p>
          )}
          {allContacts.map((contact: any) => {
            const unread = unreadFor(contact.id)
            const isSelected = selectedPeer?.id === contact.id
            return (
              <button
                key={contact.id}
                onClick={() => selectPeer(contact)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {contact.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <OnlineDot online={contact.online} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    {unread > 0 && (
                      <span className="ml-1 shrink-0 text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{roleLabel(contact.role)}</p>
                </div>
              </button>
            )
          })}

          {extraPeers.map((peer: any) => {
            const unread = unreadFor(peer.id)
            const isSelected = selectedPeer?.id === peer.id
            return (
              <button
                key={peer.id}
                onClick={() => selectPeer(peer)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">
                    {peer.name?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{peer.name}</p>
                    {unread > 0 && (
                      <span className="ml-1 shrink-0 text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{roleLabel(peer.role)}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedPeer ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecione um contato para iniciar a conversa
          </div>
        ) : (
          <>
            <div className="h-14 bg-white border-b px-5 flex items-center gap-3 shrink-0">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {selectedPeer.name?.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5">
                  <OnlineDot online={allContacts.find((c: any) => c.id === selectedPeer.id)?.online ?? false} />
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm">{selectedPeer.name}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(selectedPeer.role)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground pt-10">Nenhuma mensagem ainda. Diga olá!</p>
              )}
              {messages.map((msg: any) => {
                const isMine = msg.senderId === user.id
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${isMine ? 'bg-primary text-white rounded-br-sm' : 'bg-white border text-gray-800 rounded-bl-sm shadow-sm'}`}>
                      {msg.content?.startsWith('[img]') ? (
                        <img
                          src={msg.content.slice(5)}
                          alt="imagem"
                          className="max-w-full rounded-lg max-h-60 object-contain cursor-pointer"
                          onClick={() => window.open(msg.content.slice(5), '_blank')}
                        />
                      ) : (
                        <p>{msg.content}</p>
                      )}
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-white/70 text-right' : 'text-muted-foreground'}`}>
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t flex gap-2">
              <Input
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Escreva uma mensagem..."
                className="flex-1"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={uploadingImage || !selectedPeer}
                onClick={() => fileInputRef.current?.click()}
                title="Enviar imagem"
              >
                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </Button>
              <Button onClick={sendMessage} disabled={!messageText.trim()}>Enviar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
