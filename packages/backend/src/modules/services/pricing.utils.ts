type PriceEntry = { price: any; groupId: string | null }
type ServiceLike = { type: string; prices?: PriceEntry[] }
type CouponLike = { type: string; value: number }

const ALIGNER_TYPES = new Set(['FULL', 'MID', 'UNIDADE', 'REFINEMENT'])
const PRODUCT_SERVICE_TYPES_MAP: Record<string, string[]> = {
  ALINHADORES: ['FULL', 'MID', 'UNIDADE', 'REFINEMENT'],
  FINALIZACAO: ['RETAINER'],
  PLACA_MIORRELAXANTE: ['OTHER'],
  EA_AIR2: ['AIR'],
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function normalizeServiceType(serviceType?: string | null) {
  const source = normalizeText(serviceType)
  if (!source) return ''
  if (source.includes('FULL')) return 'FULL'
  if (source.includes('MID')) return 'MID'
  if (
    source.includes('UNIDADE') ||
    source.includes('UNID') ||
    source.includes('UNIT') ||
    source.includes('EXPRESS') ||
    source.includes('EXPRES')
  ) return 'UNIDADE'
  if (source.includes('AIR')) return 'AIR'
  if (source.includes('REFIN')) return 'REFINEMENT'
  if (source.includes('CONTEN') || source.includes('RETEN') || source.includes('FINALIZ')) return 'RETAINER'
  if (source.includes('MIORRELAX') || source.includes('PLACA') || source.includes('OTHER')) return 'OTHER'
  return source
}

export function isAlignerService(serviceType?: string | null) {
  const normalized = normalizeServiceType(serviceType)
  return !!normalized && ALIGNER_TYPES.has(normalized)
}

export function getAllowedServiceTypesForProduct(productType?: string | null) {
  return productType ? PRODUCT_SERVICE_TYPES_MAP[productType] || null : null
}

export function serviceMatchesProductType(productType?: string | null, serviceType?: string | null) {
  const allowedTypes = getAllowedServiceTypesForProduct(productType)
  const normalized = normalizeServiceType(serviceType)
  if (!allowedTypes || !normalized) return true
  return allowedTypes.includes(normalized)
}

export function normalizeInstallmentOption(option?: string | null) {
  const normalized = String(option || '').trim().toLowerCase()
  if (!normalized) return '1x'
  const match = normalized.match(/^(\d+)x$/)
  return match ? `${match[1]}x` : '1x'
}

export function getAllowedInstallmentOptions(service: ServiceLike) {
  const serviceType = normalizeServiceType(service.type)
  const prices = service.prices || []
  const available = new Set<string>(['1x'])

  for (const price of prices) {
    if (!price.groupId || price.groupId === 'CASH') available.add('1x')
    if (price.groupId === 'INSTALLMENT_2') available.add('2x')
    if (price.groupId === 'INSTALLMENT_6') available.add('6x')
    if (price.groupId === 'INSTALLMENT_12') available.add('12x')
    if (price.groupId === 'INSTALLMENT_13') available.add('13x')
    if (price.groupId === 'INSTALLMENT_21') available.add('21x')
  }

  if (serviceType === 'UNIDADE') return ['1x']
  if (serviceType === 'MID') {
    const options = ['1x', '6x', '12x'].filter((item) => available.has(item))
    return options.length ? options : ['1x']
  }
  if (serviceType === 'FULL') {
    const options = ['1x', '6x', '12x', '21x'].filter((item) => available.has(item))
    return options.length ? options : ['1x']
  }
  if (serviceType === 'AIR') return ['1x', '2x'].filter((item) => available.has(item))
  return ['1x']
}

/**
 * Valor do caso.
 * - Tabelas com desconto progressivo cadastradas por faixa: groupId "CASH:D10", "INSTALLMENT_6:D15"...
 *   (valores exatos da tabela comercial). Se a faixa não estiver cadastrada, aplica o % sobre o valor cheio.
 * - UNIDADE: preço por alinhador × quantidade de alinhadores do planejamento 3D.
 */
export function getChargeAmountForCase(
  service: ServiceLike,
  installmentOption?: string | null,
  opts: { discountTier?: number; quantity?: number | null } = {},
) {
  return getChargeDetails(service, installmentOption, opts).amount
}

export function getChargeDetails(
  service: ServiceLike,
  installmentOption?: string | null,
  opts: { discountTier?: number; quantity?: number | null } = {},
): { amount: number; tierApplied: boolean; unitPrice: number; quantity: number } {
  const normalized = normalizeInstallmentOption(installmentOption)
  const groupMap: Record<string, string | null> = {
    '1x': 'CASH',
    '2x': 'INSTALLMENT_2',
    '6x': 'INSTALLMENT_6',
    '12x': 'INSTALLMENT_12',
    '13x': 'INSTALLMENT_13',
    '21x': 'INSTALLMENT_21',
  }

  const groupId = groupMap[normalized] ?? 'CASH'
  const prices = service.prices || []
  const tier = Number(opts.discountTier || 0)
  const isBase = (entry: PriceEntry) => !entry.groupId || !String(entry.groupId).includes(':')
  let tierApplied = false
  let selected: PriceEntry | undefined

  if (tier > 0) {
    selected = prices.find((entry) => entry.groupId === `${groupId}:D${tier}`)
    if (selected) tierApplied = true
  }
  if (!selected) {
    selected = groupId === 'CASH'
      ? prices.find((entry) => isBase(entry) && (!entry.groupId || entry.groupId === 'CASH'))
      : prices.find((entry) => entry.groupId === groupId)
  }
  if (!selected && normalized === '12x') {
    // Compatibilidade: alguns cadastros legados usavam INSTALLMENT_13 para o plano MID.
    selected = prices.find((entry) => entry.groupId === 'INSTALLMENT_13')
  }
  if (!selected) {
    throw new Error('Preco nao configurado para a condicao de pagamento escolhida')
  }

  const perInstallmentAmount = Number(selected.price)
  const installments = Number((normalized.match(/^(\d+)x$/)?.[1] || '1'))
  if (!Number.isFinite(perInstallmentAmount) || perInstallmentAmount <= 0) {
    throw new Error('Preco invalido para a condicao de pagamento escolhida')
  }

  // UNIDADE: valor por alinhador × quantidade de alinhadores definida no planejamento 3D
  if (normalizeServiceType(service.type) === 'UNIDADE') {
    const quantity = Number(opts.quantity || 0)
    if (!quantity || quantity <= 0) throw new Error('Quantidade de alinhadores ainda nao definida pelo planejamento 3D')
    return { amount: Number((perInstallmentAmount * quantity).toFixed(2)), tierApplied, unitPrice: perInstallmentAmount, quantity }
  }

  // Preços parcelados ficam cadastrados como valor da parcela; o total = parcela × nº de parcelas.
  return {
    amount: Number((perInstallmentAmount * Math.max(1, installments)).toFixed(2)),
    tierApplied,
    unitPrice: perInstallmentAmount,
    quantity: 1,
  }
}

/** Quantidade de alinhadores do caso: séries superiores + inferiores do planejamento 3D (Checagem). */
export function getAlignerQuantity(checagem: any): number | null {
  if (!checagem || typeof checagem !== 'object') return null
  const total = Number(checagem.seriesFaseSuperior || 0) + Number(checagem.seriesFaseInferior || 0)
  return total > 0 ? total : null
}

/** Checagem Virtual 3D: inclusa se aprovada em até 30 dias do envio; depois disso, taxa de R$ 320. */
export const CHECAGEM_TAXA = 320
export function getChecagemFee(sentForApprovalAt?: Date | null, approvedAt?: Date | null) {
  if (!sentForApprovalAt || !approvedAt) return 0
  const dias = (approvedAt.getTime() - sentForApprovalAt.getTime()) / 86400000
  return dias > 30 ? CHECAGEM_TAXA : 0
}

export function applyCouponDiscount(amount: number, coupon: CouponLike) {
  const base = Number(amount || 0)
  if (coupon.type === 'PERCENT') {
    return Number(Math.max(0, base - (base * Number(coupon.value) / 100)).toFixed(2))
  }
  return Number(Math.max(0, base - Number(coupon.value)).toFixed(2))
}

export function applyPercentageDiscount(amount: number, percentage: number) {
  const base = Number(amount || 0)
  const rate = Number(percentage || 0)
  if (rate <= 0) return base
  return Number(Math.max(0, base - (base * rate / 100)).toFixed(2))
}

/** Tipos que entram no desconto progressivo (EA AIR² e EA MIO ficam fora). */
export const PROGRESSIVE_TYPES = ['MID', 'FULL'] // EA Unidade não tem desconto progressivo

/**
 * Desconto progressivo do mês (por dentista, pela data de APROVAÇÃO, zera todo mês):
 * 2º caso do mês -10%, a partir do 3º -15%.
 * `billedCasesInMonth` = casos do mesmo dentista aprovados ANTES deste no mesmo mês.
 */
export function getProgressiveAlignerDiscountRate(serviceType?: string | null, billedCasesInMonth = 0) {
  if (!serviceType || !PROGRESSIVE_TYPES.includes(normalizeServiceType(serviceType))) return 0
  const caseOrdinal = Number(billedCasesInMonth || 0) + 1
  if (caseOrdinal >= 3) return 15
  if (caseOrdinal === 2) return 10
  return 0
}

export function getCasePricingSnapshot(
  service: ServiceLike,
  installmentOption?: string | null,
  coupon?: CouponLike | null,
  progressiveDiscountPercent = 0,
  extras: { quantity?: number | null; checagemFee?: number } = {},
) {
  const normalizedInstallment = normalizeInstallmentOption(installmentOption)
  const baseAmount = getChargeAmountForCase(service, normalizedInstallment, { quantity: extras.quantity })
  const withTier = getChargeDetails(service, normalizedInstallment, { discountTier: progressiveDiscountPercent, quantity: extras.quantity })
  // se a tabela da faixa está cadastrada usa o valor exato dela; senão aplica o %
  const amountAfterProgressive = withTier.tierApplied
    ? withTier.amount
    : applyPercentageDiscount(baseAmount, progressiveDiscountPercent)
  const checagemFee = Number(extras.checagemFee || 0)
  const finalAmount = Number(((coupon ? applyCouponDiscount(amountAfterProgressive, coupon) : amountAfterProgressive) + checagemFee).toFixed(2))

  return {
    installmentOption: normalizedInstallment,
    baseAmount,
    progressiveDiscountPercent,
    amountAfterProgressive,
    checagemFee,
    quantity: withTier.quantity,
    unitPrice: withTier.unitPrice,
    finalAmount,
    discountAmount: Number((baseAmount + checagemFee - finalAmount).toFixed(2)),
  }
}
