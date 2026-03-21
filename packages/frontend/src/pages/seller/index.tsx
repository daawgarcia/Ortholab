import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { Users, FolderOpen } from 'lucide-react'

export default function SellerPage() {
  const { data: portfolioData } = useQuery({
    queryKey: ['seller-portfolio'],
    queryFn: () => api.get('/seller/portfolio').then(r => r.data),
  })
  const { data: casesData } = useQuery({
    queryKey: ['seller-cases'],
    queryFn: () => api.get('/seller/portfolio/cases?limit=30').then(r => r.data),
  })

  const clients = portfolioData?.clients || []
  const cases = casesData?.cases || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Carteira</h1>
        <p className="text-sm text-muted-foreground">{clients.length} cliente{clients.length !== 1 ? 's' : ''} na carteira</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {clients.slice(0, 6).map((c: any) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">{c.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.clinic}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c._count?.cases || 0} casos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Casos da Carteira</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {cases.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nenhum caso encontrado</p>}
          {cases.map((c: any) => (
            <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-xs font-bold">#{c.caseNumber}</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{c.patientName}</p>
                <p className="text-xs text-muted-foreground">{c.dentist?.name} — {c.dentist?.clinic}</p>
              </div>
              <StatusBadge status={c.status} />
              <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
