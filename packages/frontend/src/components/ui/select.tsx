import * as React from 'react'

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

interface SelectTriggerProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange?.(e.target.value)
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring focus:ring-blue-200"
    >
      {children}
    </select>
  )
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <option value={value}>{children}</option>
}

export function SelectTrigger(props: any) {
  return <>{props.children}</>
}

export function SelectValue(props: any) {
  return <>{props.placeholder}</>
}
