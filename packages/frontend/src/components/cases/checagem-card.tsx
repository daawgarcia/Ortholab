import { FileText, AlertTriangle, Layers } from 'lucide-react'

interface Faixa { min: number; max: number }
export interface Checagem {
  estimativaSuperior?: Faixa
  estimativaInferior?: Faixa
  estimativaGeral?: Faixa
  seriesFaseSuperior?: number
  seriesFaseInferior?: number
  tipoIndicado?: 'UNIDADE' | 'MID' | 'FULL' | null
  pagina?: number
  arquivo?: string
  lidoEm?: string
}

function Arcada({ nome, fase, estimativa }: { nome: string; fase?: number; estimativa?: Faixa }) {
  return (
    <div className="rounded-lg bg-white/70 ring-1 ring-gray-200 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{nome}</p>
      <p className="mt-1 text-xs text-gray-500">Estimativa de movimentação</p>
      <p className="text-2xl font-semibold text-gray-900 tabular-nums">
        {estimativa ? `${estimativa.min} – ${estimativa.max}` : '—'} <span className="text-sm font-normal text-gray-500">séries</span>
      </p>
      <p className="mt-1 text-xs text-gray-600">
        Produção nesta fase: <strong className="tabular-nums">{fase != null ? `${fase} séries` : '—'}</strong>
      </p>
    </div>
  )
}

/** Card da Checagem Virtual 3D — indicação lida do PDF do planejamento. */
export function ChecagemCard({ checagem, aguardandoDesde }: { checagem?: Checagem | null; aguardandoDesde?: string }) {
  const dias = aguardandoDesde ? Math.floor((Date.now() - new Date(aguardandoDesde).getTime()) / 86400000) : null

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Layers className="w-5 h-5 text-amber-600" />
        <h3 className="text-base font-semibold text-gray-900">Checagem Virtual 3D</h3>
        {dias != null && (
          <span className={`ml-auto text-xs ${dias >= 30 ? 'text-rose-700 font-medium' : 'text-gray-500'}`}>
            Aguardando aprovação há {dias} {dias === 1 ? 'dia' : 'dias'}
            {dias >= 30 && ' — aprovação após 30 dias cobra a checagem (R$ 320)'}
          </span>
        )}
      </div>

      {checagem ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Arcada nome="Arcada superior" fase={checagem.seriesFaseSuperior} estimativa={checagem.estimativaSuperior ?? checagem.estimativaGeral} />
            <Arcada nome="Arcada inferior" fase={checagem.seriesFaseInferior} estimativa={checagem.estimativaInferior ?? checagem.estimativaGeral} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
            <FileText className="w-3.5 h-3.5" />
            Lido do planejamento 3D{checagem.arquivo ? ` "${checagem.arquivo}"` : ''}{checagem.pagina ? `, página ${checagem.pagina}` : ''}
          </p>
        </>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Ainda não há leitura do PDF do planejamento 3D para este caso. Ao anexar o PDF, a indicação é lida automaticamente.
        </p>
      )}
    </div>
  )
}
