import { useEffect, useState } from 'react'

/** Valor "atrasado": só muda depois que a pessoa para de digitar por `ms`. */
export function useDebounce<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
