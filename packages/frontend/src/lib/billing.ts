function normalizeText(value?: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export function normalizeServiceKind(service?: any) {
  const type = normalizeText(service?.type)
  const name = normalizeText(service?.name)
  const source = `${type} ${name}`.trim()

  if (source.includes('FULL')) return 'FULL'
  if (source.includes('MID')) return 'MID'
  if (source.includes('UNIDADE') || source.includes('EXPRESS')) return 'UNIDADE'
  if (source.includes('AIR')) return 'AIR'
  if (source.includes('REFIN')) return 'REFINEMENT'
  if (source.includes('CONTEN') || source.includes('RETEN') || source.includes('FINALIZ')) return 'RETAINER'
  if (source.includes('MIORRELAX') || source.includes('PLACA') || source.includes('SPLINT') || source.includes('GUARD')) return 'OTHER'

  return type
}

export function inferProductType(productType?: string, planningFormData?: any, service?: any, billingType?: string) {
  if (productType) return productType

  if (planningFormData && typeof planningFormData === 'object' && Object.keys(planningFormData).length > 0) {
    return 'ALINHADORES'
  }

  const derivedKind = normalizeServiceKind(service || { type: billingType, name: billingType })
  if (['FULL', 'MID', 'UNIDADE', 'REFINEMENT'].includes(derivedKind)) return 'ALINHADORES'
  if (derivedKind === 'AIR') return 'EA_AIR2'
  if (derivedKind === 'RETAINER') return 'FINALIZACAO'
  if (derivedKind === 'OTHER') return 'PLACA_MIORRELAXANTE'

  return undefined
}

export function isAlignerType(service?: any) {
  return ['FULL', 'MID', 'UNIDADE', 'REFINEMENT'].includes(normalizeServiceKind(service))
}

export const SERVICE_KIND_ORDER: Record<string, number> = {
  UNIDADE: 1,
  MID: 2,
  FULL: 3,
  REFINEMENT: 4,
  AIR: 5,
  RETAINER: 6,
  OTHER: 7,
}

export function getAllowedServiceTypesForProduct(productType?: string) {
  const map: Record<string, string[]> = {
    ALINHADORES: ['FULL', 'MID', 'UNIDADE', 'REFINEMENT'],
    FINALIZACAO: ['RETAINER'],
    PLACA_MIORRELAXANTE: ['OTHER'],
    EA_AIR2: ['AIR'],
  }
  return productType ? map[productType] || null : null
}

export function filterServicesForProduct(services: any[], productType?: string) {
  const allowedTypes = getAllowedServiceTypesForProduct(productType)
  if (!allowedTypes) return services
  const filtered = services.filter((service: any) => allowedTypes.includes(normalizeServiceKind(service)))
  // Fallback for legacy/uncategorized service catalogs: keep options selectable.
  return filtered.length > 0 ? filtered : services
}

export function sortBillingServices(services: any[]) {
  return [...services].sort((a: any, b: any) => {
    const aRank = SERVICE_KIND_ORDER[normalizeServiceKind(a)] || 999
    const bRank = SERVICE_KIND_ORDER[normalizeServiceKind(b)] || 999
    if (aRank !== bRank) return aRank - bRank
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR')
  })
}

export function getServiceDisplayName(service?: any) {
  const kind = normalizeServiceKind(service)
  if (kind === 'UNIDADE') return 'UNIDADE'
  if (kind === 'MID') return 'MID'
  if (kind === 'FULL') return 'FULL'
  if (kind === 'REFINEMENT') return 'Refinamento'
  if (kind === 'AIR') return 'EA AIR²'
  if (kind === 'RETAINER') return 'Finalização/Contenção'
  if (kind === 'OTHER') return service?.name || 'Placa Miorrelaxante'
  return service?.name || 'Serviço'
}

export function ensureSelectedServiceInList(services: any[], selectedService?: any) {
  if (!selectedService?.id) return services
  if (services.some((service: any) => service.id === selectedService.id)) return services
  return sortBillingServices([...services, selectedService])
}

export function getAllowedInstallments(service?: any) {
  if (!service) return ['1x']

  const serviceKind = normalizeServiceKind(service)
  const available = new Set<string>(['1x'])
  for (const price of service.prices || []) {
    if (!price.groupId || price.groupId === 'CASH') available.add('1x')
    if (price.groupId === 'INSTALLMENT_2') available.add('2x')
    if (price.groupId === 'INSTALLMENT_6') available.add('6x')
    if (price.groupId === 'INSTALLMENT_12') available.add('12x')
    if (price.groupId === 'INSTALLMENT_13') available.add('13x')
    if (price.groupId === 'INSTALLMENT_21') available.add('21x')
  }

  // Some API responses expose latest prices as flattened fields.
  const latestPrices = service.latestPrices || {}
  if (latestPrices.cash !== undefined && latestPrices.cash !== null) available.add('1x')
  if (latestPrices.installment2 !== undefined && latestPrices.installment2 !== null) available.add('2x')
  if (latestPrices.installment6 !== undefined && latestPrices.installment6 !== null) available.add('6x')
  if (latestPrices.installment12 !== undefined && latestPrices.installment12 !== null) available.add('12x')
  if (latestPrices.installment13 !== undefined && latestPrices.installment13 !== null) available.add('13x')
  if (latestPrices.installment21 !== undefined && latestPrices.installment21 !== null) available.add('21x')

  if (serviceKind === 'UNIDADE') return ['1x']
  if (serviceKind === 'MID') {
    const options = ['1x', '6x', '12x'].filter((item) => available.has(item))
    return options.length ? options : ['1x']
  }
  if (serviceKind === 'FULL') {
    const options = ['1x', '6x', '12x', '21x'].filter((item) => available.has(item))
    return options.length ? options : ['1x']
  }
  if (serviceKind === 'AIR') return ['1x', '2x'].filter((item) => available.has(item))

  return ['1x']
}