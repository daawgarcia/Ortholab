import { Badge } from '@/components/ui/badge'

const statusMap: Record<string, { label: string; variant: any }> = {
  DRAFT:              { label: 'Rascunho',           variant: 'secondary' },
  SUBMITTED:          { label: 'Submetido',           variant: 'info' },
  IN_PLANNING:        { label: 'Casos a preparar',    variant: 'info' },
  IN_MOVEMENT:        { label: 'Casos a movimentar',  variant: 'info' },
  LAB_APPROVAL:       { label: 'Aprovar resp. lab',   variant: 'warning' },
  WAITING_APPROVAL:   { label: 'Aguard. aprovação',   variant: 'warning' },
  REVISION_REQUESTED: { label: 'Revisão Solicitada',  variant: 'destructive' },
  APPROVED:           { label: 'Aprovado',            variant: 'success' },
  PRINTING_3D:        { label: 'Impressão 3D',        variant: 'info' },
  LABORATORY:         { label: 'Laboratório',         variant: 'info' },
  EXPEDITION:         { label: 'Expedição',           variant: 'warning' },
  IN_PRODUCTION:      { label: 'Em Produção',         variant: 'info' },
  SHIPPED:            { label: 'Enviado',             variant: 'success' },
  COMPLETED:          { label: 'Concluído',           variant: 'success' },
  REFINEMENT:         { label: 'Refinamento',         variant: 'warning' },
  PENDING:            { label: 'Pendente',            variant: 'warning' },
  PAID:               { label: 'Pago',                variant: 'success' },
  FAILED:             { label: 'Falhou',              variant: 'destructive' },
  REFUNDED:           { label: 'Estornado',           variant: 'secondary' },
  ACTIVE:             { label: 'Ativo',               variant: 'success' },
  INACTIVE:           { label: 'Inativo',             variant: 'secondary' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] || { label: status, variant: 'secondary' }
  return <Badge variant={s.variant}>{s.label}</Badge>
}
