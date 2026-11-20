/** Identificação padrão de um caso: nº da caixa – paciente – dentista. */
export function caixaFmt(box?: string | number | null) {
  const b = String(box ?? '').trim()
  return b ? b.padStart(6, '0') : 's/ caixa'
}

export function rotuloCaso(c: { box?: string | number | null; paciente?: string | null; dentista?: string | null }) {
  return [caixaFmt(c.box), c.paciente, c.dentista].filter(Boolean).join(' – ')
}
