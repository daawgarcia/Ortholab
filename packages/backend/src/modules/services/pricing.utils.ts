type PriceEntry = { price: any; groupId: string | null }
type ServiceLike = { type: string; prices?: PriceEntry[] }
type CouponLike = { type: string; value: number }

const ALIGNER_TYPES = new Set(['FULL', 'MID', 'AIR', 'EXPRESS', 'REFINEMENT'])

export function isAlignerService(serviceType?: string | null) {
  return !!serviceType && ALIGNER_TYPES.has(serviceType)
}

export function normalizeInstallmentOption(option?: string | null) {
  const normalized = String(option || '').trim().toLowerCase()
  if (!normalized) return '1x'
  const match = normalized.match(/^(\d+)x$/)
  return match ? `${match[1]}x` : '1x'
}

export function getAllowedInstallmentOptions(service: ServiceLike) {
  const prices = service.prices || []
  const available = new Set<string>(['1x'])

  for (const price of prices) {
    if (!price.groupId || price.groupId === 'CASH') available.add('1x')
    if (price.groupId === 'INSTALLMENT_2') available.add('2x')
    if (price.groupId === 'INSTALLMENT_6') available.add('6x')
    if (price.groupId === 'INSTALLMENT_12') available.add('12x')
    if (price.groupId === 'INSTALLMENT_21') available.add('21x')
  }

  if (service.type === 'AIR') return ['1x', '2x'].filter((item) => available.has(item))
  if (service.type === 'FULL') return ['1x', '6x', '12x', '21x'].filter((item) => available.has(item))
  return ['1x', '6x', '12x'].filter((item) => available.has(item))
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
  const selected = groupId === 'CASH'
    ? prices.find((entry) => !entry.groupId || entry.groupId === 'CASH')
    : prices.find((entry) => entry.groupId === groupId)

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
