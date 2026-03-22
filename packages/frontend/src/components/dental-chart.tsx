import { useState } from 'react'
import { cn } from '@/lib/utils'

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

type ToothState = 'normal' | 'implant' | 'prosthesis' | 'absent'

const STATES: ToothState[] = ['normal', 'implant', 'prosthesis', 'absent']

const STATE_CONFIG: Record<ToothState, { label: string; abbr: string; bg: string; border: string; text: string }> = {
  normal:     { label: 'Normal',        abbr: '',  bg: 'bg-white',         border: 'border-gray-200', text: 'text-gray-400' },
  implant:    { label: 'Implante',      abbr: 'I', bg: 'bg-blue-50',       border: 'border-blue-400', text: 'text-blue-600' },
  prosthesis: { label: 'Prótese Fixa',  abbr: 'P', bg: 'bg-orange-50',     border: 'border-orange-400', text: 'text-orange-600' },
  absent:     { label: 'Ausente',       abbr: 'X', bg: 'bg-gray-100',      border: 'border-gray-300', text: 'text-gray-500' },
}

interface ToothData {
  [tooth: number]: ToothState
}

interface DentalChartProps {
  value?: ToothData
  onChange?: (v: ToothData) => void
  readOnly?: boolean
}

function Tooth({ number, state, onClick }: { number: number; state: ToothState; onClick: () => void }) {
  const cfg = STATE_CONFIG[state]
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Dente ${number} — ${cfg.label}. Clique para alterar.`}
      className={cn(
        'flex flex-col items-center gap-0.5 group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded'
      )}
    >
      <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-600 leading-none">{number}</span>
      <div className={cn(
        'w-8 h-10 rounded border-2 flex items-center justify-center text-[11px] font-bold transition-all',
        cfg.bg, cfg.border, cfg.text,
        'hover:scale-105 hover:shadow-sm'
      )}>
        {cfg.abbr}
      </div>
    </button>
  )
}

export function DentalChart({ value = {}, onChange, readOnly = false }: DentalChartProps) {
  const cycleState = (tooth: number) => {
    if (readOnly || !onChange) return
    const current = value[tooth] || 'normal'
    const idx = STATES.indexOf(current)
    const next = STATES[(idx + 1) % STATES.length]
    onChange({ ...value, [tooth]: next })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap justify-center">
        {UPPER.map(n => (
          <Tooth key={n} number={n} state={value[n] || 'normal'} onClick={() => cycleState(n)} />
        ))}
      </div>
      <div className="border-t border-dashed border-gray-200 my-1" />
      <div className="flex gap-1.5 flex-wrap justify-center">
        {LOWER.map(n => (
          <Tooth key={n} number={n} state={value[n] || 'normal'} onClick={() => cycleState(n)} />
        ))}
      </div>
      {!readOnly && (
        <div className="flex gap-4 justify-center pt-1">
          {STATES.map(s => {
            const cfg = STATE_CONFIG[s]
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center text-[9px] font-bold', cfg.bg, cfg.border, cfg.text)}>
                  {cfg.abbr}
                </div>
                <span className="text-xs text-gray-500">{cfg.label}</span>
              </div>
            )
          })}
          <span className="text-xs text-gray-400 ml-2">(Clique para ciclar)</span>
        </div>
      )}
    </div>
  )
}

export type { ToothData, ToothState }
