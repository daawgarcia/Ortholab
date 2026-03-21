import * as React from 'react'
import type { ToastProps } from '@/components/ui/toast'

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 3000

type ToasterToast = ToastProps & { id: string; title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactElement }

let count = 0
function genId() { count = (count + 1) % Number.MAX_SAFE_INTEGER; return count.toString() }

type State = { toasts: ToasterToast[] }
const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: { type: string; toast?: ToasterToast; toastId?: string }) {
  if (action.type === 'ADD_TOAST') memoryState = { toasts: [action.toast!, ...memoryState.toasts].slice(0, TOAST_LIMIT) }
  else if (action.type === 'DISMISS_TOAST') memoryState = { toasts: memoryState.toasts.map(t => t.id === action.toastId || !action.toastId ? { ...t, open: false } : t) }
  else if (action.type === 'REMOVE_TOAST') memoryState = { toasts: memoryState.toasts.filter(t => t.id !== action.toastId) }
  listeners.forEach(l => l(memoryState))
}

function toast(props: Omit<ToasterToast, 'id'>) {
  const id = genId()
  dispatch({ type: 'ADD_TOAST', toast: { ...props, id, open: true, onOpenChange: (open) => { if (!open) { dispatch({ type: 'DISMISS_TOAST', toastId: id }); setTimeout(() => dispatch({ type: 'REMOVE_TOAST', toastId: id }), TOAST_REMOVE_DELAY) } } } })
  return { id, dismiss: () => dispatch({ type: 'DISMISS_TOAST', toastId: id }) }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)
  React.useEffect(() => { listeners.push(setState); return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1) } }, [])
  return { ...state, toast, dismiss: (id?: string) => dispatch({ type: 'DISMISS_TOAST', toastId: id }) }
}

export { useToast, toast }
