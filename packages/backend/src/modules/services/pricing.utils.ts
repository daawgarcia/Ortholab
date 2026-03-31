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
  if (source.includes('UNIDADE') || source.includes('EXPRESS')) return 'UNIDADE'
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

export function getChargeAmountForCase(service: ServiceLike, installmentOption?: string | null) {
  const normalized = normalizeInstallmentOption(installmentOption)
  const groupMap: Record<string, string | null> = {
    '1x': 'CASH',
    '2x': 'INSTALLMENT_2',
    '6x': 'INSTALLMENT_6',
    '12x': 'INSTALLMENT_12',
    '21x': 'INSTALLMENT_21',
  }

  const groupId = groupMap[normalized] ?? 'CASH'
  const prices = service.prices || []
  let selected = groupId === 'CASH'
    ? prices.find((entry) => !entry.groupId || entry.groupId === 'CASH')
    : prices.find((entry) => entry.groupId === groupId)

  if (!selected && normalized === '12x') {
    // Compatibilidade: alguns cadastros legados usavam INSTALLMENT_13 para o plano MID.
    selected = prices.find((entry) => entry.groupId === 'INSTALLMENT_13')
  }

  if (!selected) {
    throw new Error('Preco nao configurado para a condicao de pagamento escolhida')
  }

  return Number(selected.price)
}

export function applyCouponDiscount(amount: number, coupon: CouponLike) {
  const base = Number(amount || 0)
  if (coupon.type === 'PERCENT') {
    return Number(Math.max(0, base - (base * Number(coupon.value) / 100)).toFixed(2))
  }
  return Number(Math.max(0, base - Number(coupon.value)).toFixed(2))
}
