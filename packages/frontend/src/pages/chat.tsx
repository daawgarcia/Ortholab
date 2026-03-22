import { useEffect, useMemo, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'

function buildWsUrl(accessToken: string | null) {
  if (!accessToken) return ''
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  return `${protocol}://${host}/api/chat/ws?token=${accessToken}`
}

export default function ChatPage() {
  const { user, accessToken } = useAuthStore()
  const [selectedPeer, setSelectedPeer] = useState<any>(null)
  const [messageText, setMessageText] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const queryClient = useQueryClient()

  const { data: convData, refetch: refetchConversations } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const res = await api.get('/chat/conversations')
      return res.data
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (convData?.conversations) {
      setConversations(convData.conversations)
    }
  }, [convData])

  const fetchMessages = async (peerId: string) => {
    const res = await api.get(`/chat/messages/${peerId}`)
    setMessages(res.data.messages)
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
  }

  useEffect(() => {
    if (selectedPeer?.id) {
      fetchMessages(selectedPeer.id)
    }
  }, [selectedPeer])

  useEffect(() => {
    if (!user || !accessToken) return

    const wsUrl = buildWsUrl(accessToken)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Chat WS conectado')
    }

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'message') {
          const msg = payload.message
          setMessages((prev) => {
            if (selectedPeer && (msg.senderId === selectedPeer.id || msg.receiverId === selectedPeer.id)) {
              return [...prev, msg]
            }
            return prev
          })

          refetchConversations()
        }
      } catch (err) {
        console.error('Erro de análise WS', err)
      }
    }

    ws.onclose = () => {
      console.log('Chat WS desconectado')
    }

    return () => {
      ws.close()
    }
  }, [user, accessToken, selectedPeer])

  const sendMessage = useMutation({
    mutationFn: async (payload: { peerId: string; content: string }) => {
      if (!payload.content.trim()) throw new Error('Mensagem vazia')
      await api.post(`/chat/messages/${payload.peerId}`, { content: payload.content })
    },
    onSuccess: async (_data, variables) => {
      setMessageText('')
      await fetchMessages(variables.peerId)
      refetchConversations()
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'message', to: variables.peerId, content: variables.content }))
      }
    },
    onError: (err: any) => {
      console.error('Erro ao enviar', err)
    },
  })

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
  }, [conversations])

  if (!user) {
    return <p>Carregando usuário...</p>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      <Card className="col-span-1 h-[calc(100vh-64px)] overflow-hidden">
        <CardHeader>
          <CardTitle>Conversas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto h-[calc(100vh-200px)]">
          {sortedConversations.map((conv: any) => (
            <button key={conv.peer.id} onClick={() => setSelectedPeer(conv.peer)} className={`w-full text-left p-3 rounded-lg mb-2 ${selectedPeer?.id === conv.peer.id ? 'bg-blue-50 border border-blue-300' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>
              <div className="flex justify-between items-center">
                <span className="font-semibold">{conv.peer.name}</span>
                {conv.unread > 0 && <span className="text-xs text-white bg-red-500 rounded-full px-2">{conv.unread}</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(conv.lastAt), { addSuffix: true })}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <section className="col-span-2 flex flex-col h-[calc(100vh-64px)]">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Chat com {selectedPeer?.name || 'selecione um contato'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 p-4 bg-white">
          {!selectedPeer && <p className="text-muted-foreground">Escolha um contato para iniciar a conversa.</p>}
          {selectedPeer && messages.map((msg) => (
            <div key={msg.id} className={`mb-2 max-w-[80%] ${msg.senderId === user.id ? 'ml-auto text-right' : 'mr-auto text-left'}`}>
              <div className={`inline-block p-2 rounded-lg ${msg.senderId === user.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {msg.content}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}</p>
            </div>
          ))}
        </div>

        {selectedPeer && (
          <div className="mt-3 flex gap-2">
            <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Escreva sua mensagem" />
            <Button onClick={() => sendMessage.mutate({ peerId: selectedPeer.id, content: messageText })} disabled={!messageText.trim()}>Enviar</Button>
          </div>
        )}
      </section>
    </div>
  )
}
