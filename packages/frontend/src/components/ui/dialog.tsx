import * as React from 'react'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface DialogTriggerProps {
  asChild?: boolean
  children: React.ReactElement
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const handleClose = () => onOpenChange?.(false)

  if (!open) {
    return <>
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return null
        if (child.type === DialogTrigger) return child
        return null
      })}
    </>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full relative">
        {React.Children.map(children, child => {
          if (!React.isValidElement(child)) return child
          return React.cloneElement(child as React.ReactElement<any>, { onClose: handleClose })
        })}
      </div>
    </div>
  )
}

export function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  return asChild ? React.cloneElement(children, {}) : <>{children}</>
}

export function DialogContent({ children }: { children: React.ReactNode }) {
  return <div className="p-6">{children}</div>
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold">{children}</h3>
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}