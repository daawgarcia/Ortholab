import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Sempre horário de Brasília, de onde quer que a pessoa acesse. */
export const TZ_BRASILIA = 'America/Sao_Paulo'

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: TZ_BRASILIA })
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('pt-BR', { timeZone: TZ_BRASILIA })
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
