import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, BriefcaseBusiness, Sparkles, ArrowUpRight } from 'lucide-react'

const projectStats = [
  { label: 'Projetos ativos', value: '18', helper: '+3 esta semana', accent: 'bg-blue-50 text-blue-700' },
  { label: 'Aguardando aprovação', value: '05', helper: '2 com revisão pendente', accent: 'bg-amber-50 text-amber-700' },
  { label: 'Entregas no mês', value: '26', helper: '94% no prazo', accent: 'bg-emerald-50 text-emerald-700' },
]

const projects = [
  { name: 'Projeto Ortholab', status: 'Em andamento', owner: 'Equipe Produto', progress: 72, nextStep: 'Revisão final da etapa de workflow' },
  { name: 'Campanha de onboarding', status: 'Planejado', owner: 'Marketing', progress: 38, nextStep: 'Definir materiais e cronograma' },
  { name: 'Expansão de clínicas', status: 'Aguardando aprovação', owner: 'Vendas', progress: 54, nextStep: 'Validar ajustes de suporte' },
]

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Acompanhamento</p>
          <h1 className="text-2xl font-bold text-gray-900">Projetos</h1>
        </div>
        <Button className="gap-2">
          <Sparkles className="w-4 h-4" />
          Novo projeto
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {projectStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${stat.accent}`}>
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-bold text-gray-900">{stat.value}</div>
              <p className="mt-2 text-sm text-muted-foreground">{stat.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Pipeline atual
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <BriefcaseBusiness className="w-3.5 h-3.5" />
              3 em execução
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.map((project) => (
            <div key={project.name} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{project.name}</h3>
                  <p className="text-sm text-muted-foreground">Responsável: {project.owner}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={project.status === 'Em andamento' ? 'default' : project.status === 'Planejado' ? 'secondary' : 'outline'}
                  >
                    {project.status}
                  </Badge>
                  <Button variant="ghost" size="sm" className="gap-1">
                    Abrir
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progresso</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-600">
                <span className="font-medium text-slate-800">Próximo passo:</span> {project.nextStep}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
