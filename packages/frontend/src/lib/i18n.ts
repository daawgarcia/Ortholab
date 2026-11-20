/**
 * Tradução da interface para espanhol (México, Colômbia, Peru e Espanha).
 *
 * Como funciona: os textos das telas continuam escritos em português no código; quando o idioma
 * do usuário é "es", um observador troca na tela cada texto que está no dicionário abaixo
 * (e também placeholders e dicas). Dados (nomes de pacientes, dentistas, observações) não estão
 * no dicionário e nunca são alterados. Para não traduzir um trecho, use data-no-translate.
 */
export type Idioma = 'pt' | 'es'

const ES: Record<string, string> = {
  // menu / topo
  'Dashboard': 'Panel', 'Pacientes': 'Pacientes', 'Dentistas': 'Dentistas', 'Chat': 'Chat', 'Workflow': 'Flujo de trabajo',
  'Minha Área': 'Mi Área', 'Ferramentas': 'Herramientas', 'Entradas': 'Entradas', 'Planning Center': 'Planning Center',
  'Impressão 3D': 'Impresión 3D', 'Recorte': 'Recorte', 'Expedição': 'Expedición', 'Financeiro': 'Finanzas',
  'Preços e Serviços': 'Precios y Servicios', 'Vídeo Aulas': 'Videoclases', 'Webinars': 'Webinars', 'Usuários': 'Usuarios',
  'Gestão de Carteira': 'Gestión de Cartera', 'Serviços e Preços': 'Servicios y Precios', 'Frete': 'Envío',
  'Pagamentos PIX': 'Pagos PIX', 'Pagamentos Cartão': 'Pagos con Tarjeta', 'Cupons': 'Cupones', 'Relatórios': 'Informes',
  'Conteúdo': 'Contenido', 'Vídeos': 'Videos', 'Push / Avisos': 'Push / Avisos', 'Módulos': 'Módulos',
  'Configurações': 'Configuración', 'ADMINISTRAÇÃO': 'ADMINISTRACIÓN', 'Administração': 'Administración', 'Carteira': 'Cartera',
  'Notificações': 'Notificaciones', 'Marcar todas como lidas': 'Marcar todas como leídas', 'Limpar notificações': 'Borrar notificaciones',
  'Nenhuma notificação': 'Ninguna notificación', 'Abrir notificação': 'Abrir notificación', 'Sair': 'Salir', 'Meu Perfil': 'Mi Perfil',
  'Buscar paciente ou nº da caixa': 'Buscar paciente o n.º de caja', 'Buscar paciente, caixa ou dentista': 'Buscar paciente, caja o dentista',
  'Buscando…': 'Buscando…', 'Ocultar menu': 'Ocultar menú', 'Mostrar menu': 'Mostrar menú', 'Idioma': 'Idioma',

  // status
  'Rascunho': 'Borrador', 'Submetido': 'Enviado', 'Preparo de modelos': 'Preparación de modelos', 'A movimentar': 'Por mover',
  'Aprovação do lab': 'Aprobación del laboratorio', 'Aprovação do dentista': 'Aprobación del dentista', 'Revisão Solicitada': 'Revisión solicitada',
  'Faturamento': 'Facturación', 'Recorte e acabamento': 'Recorte y acabado', 'Postagem': 'Envío', 'Em Produção': 'En producción',
  'Enviado': 'Enviado', 'Concluído': 'Concluido', 'Refinamento': 'Refinamiento', 'Pendente': 'Pendiente', 'Pago': 'Pagado',
  'Falhou': 'Falló', 'Estornado': 'Reembolsado', 'Ativo': 'Activo', 'Inativo': 'Inactivo', 'Aprovado': 'Aprobado', 'Rejeitado': 'Rechazado',
  'Visualizado': 'Visto', 'Novo': 'Nuevo', 'Em planejamento': 'En planificación', 'Aprovação': 'Aprobación',

  // dashboard
  'Aqui está um resumo do seu painel': 'Aquí tienes un resumen de tu panel', 'Novo Paciente': 'Nuevo Paciente',
  'Aguardando sua aprovação': 'Esperando tu aprobación', 'Pacientes Recentes': 'Pacientes recientes', 'Ver todos': 'Ver todos',
  'Nenhum paciente encontrado': 'Ningún paciente encontrado', 'Criar primeiro paciente': 'Crear primer paciente', 'Caixa': 'Caja',
  'Todos': 'Todos', 'Hoje': 'Hoy', 'Esta semana': 'Esta semana', 'Este mês': 'Este mes', 'Total de Pacientes': 'Total de pacientes',
  'A Preparar': 'Por preparar', 'A Movimentar': 'Por mover', 'Aguardando Aprovação': 'Esperando aprobación', 'Em Impressão': 'En impresión',
  'Em Recorte': 'En recorte', 'Em Postagem': 'En envío', 'Casos Faturados': 'Casos facturados', 'Valor Faturado': 'Valor facturado',
  'Bem-vindo': 'Bienvenido', 'Olá': 'Hola',

  // aprovação rápida / checagem
  'Ver e aprovar': 'Ver y aprobar', 'Fechar': 'Cerrar', '1. Escolha o pacote': '1. Elige el paquete', 'Ver caso completo': 'Ver caso completo',
  'Caso aprovado!': '¡Caso aprobado!', 'Seu caso foi liberado para produção.': 'Tu caso fue liberado para producción.',
  'Não foi possível aprovar': 'No fue posible aprobar', 'Aprovar': 'Aprobar', 'Estimativa de movimentação': 'Estimación de movimiento',
  'séries': 'series', 'Produção nesta fase:': 'Producción en esta fase:', 'Checagem Virtual 3D': 'Chequeo Virtual 3D',
  'Produção definida pelo laboratório:': 'Producción definida por el laboratorio:', 'Superior': 'Superior', 'Inferior': 'Inferior',
  'Unidade': 'Unidad', 'Total': 'Total', 'guias de attachment': 'guías de attachment', 'Guias de attachment': 'Guías de attachment',

  // pacientes
  'Buscar por nº de caixa ou paciente...': 'Buscar por n.º de caja o paciente...', 'Número da caixa': 'Número de caja',
  'Todos os dentistas': 'Todos los dentistas', 'Nome': 'Nombre', 'Dentista': 'Dentista', 'Casos': 'Casos', 'Status': 'Estado',
  'Carregando...': 'Cargando...', 'Nome do paciente, nº da caixa ou dentista (aceita erro de digitação)': 'Nombre del paciente, n.º de caja o dentista',
  'Fotos': 'Fotos', 'Fotos Restritas': 'Fotos restringidas', 'Modelos Digitais': 'Modelos digitales', 'Relatório': 'Informe',
  'Fichas': 'Fichas', 'Ficha Clínica': 'Ficha clínica', 'Informações Importantes': 'Información importante', 'Editar': 'Editar',
  'Nenhum fluxo concluído ainda.': 'Ningún flujo concluido todavía.', 'Pipeline': 'Pipeline', 'Em andamento': 'En curso', 'Concluídos': 'Concluidos',
  'Recebimento dos modelos': 'Recepción de modelos', 'Preparo dos modelos': 'Preparación de modelos', 'Movimento': 'Movimiento',
  'Status de aprovação enviado': 'Estado de aprobación enviado', 'Caso aprovado para produção': 'Caso aprobado para producción',
  'Tipo de faturamento': 'Tipo de facturación', 'Recorte acabamento': 'Recorte y acabado', 'Postagem dos alinhadores': 'Envío de los alineadores',
  'Nenhuma mídia': 'Ningún archivo', 'Nenhum arquivo': 'Ningún archivo', 'Nenhum relatório disponível': 'Ningún informe disponible',
  'Nenhum vídeo de checagem disponível': 'Ningún video de chequeo disponible', 'Confirmar': 'Confirmar', 'Cancelar': 'Cancelar',
  'Nova Ficha': 'Nueva ficha', 'Nenhuma ficha': 'Ninguna ficha', 'Nova Ficha Clínica': 'Nueva ficha clínica', 'Nenhuma ficha clínica': 'Ninguna ficha clínica',
  'Paciente não encontrado': 'Paciente no encontrado', 'Enviar arquivo STL': 'Enviar archivo STL', 'Enviando...': 'Enviando...',
  'Fichas de Planejamento': 'Fichas de planificación', 'Fichas de Finalização': 'Fichas de finalización', 'Novos Produtos (EA MIO / EA AIR²)': 'Nuevos productos (EA MIO / EA AIR²)',
  'Observações (opcional)': 'Observaciones (opcional)', 'Se precisar, descreva aqui o pedido de revisão': 'Si es necesario, describe aquí la solicitud de revisión',
  'Solicitar revisão': 'Solicitar revisión', 'Solicitar Revisão': 'Solicitar revisión', 'Revisão solicitada': 'Revisión solicitada', 'Revisão solicitada!': '¡Revisión solicitada!',
  'Paciente — Novo': 'Paciente — Nuevo', 'Novo paciente': 'Nuevo paciente', 'Nome *': 'Nombre *', 'Sexo': 'Sexo', 'Masc': 'Masc', 'Fem': 'Fem',
  'Data de Nascimento': 'Fecha de nacimiento', 'Data de nascimento': 'Fecha de nacimiento', 'Dentista *': 'Dentista *', 'Selecione o dentista': 'Selecciona el dentista',
  'Dentes': 'Dientes', 'Tipo de Tratamento *': 'Tipo de tratamiento *', 'Planejamento Alinhadores': 'Planificación de alineadores', 'Alinhadores': 'Alineadores',
  'Contenção': 'Contención', 'Placa Miorrelaxante': 'Placa miorrelajante', 'Paciente cadastrado com sucesso': 'Paciente registrado con éxito',
  'Selecione o tipo de tratamento': 'Selecciona el tipo de tratamiento', 'Escolha Alinhadores, Contenção, EA Air² ou Placa Miorrelaxante para continuar.': 'Elige Alineadores, Contención, EA Air² o Placa miorrelajante para continuar.',
  'Observações adicionais...': 'Observaciones adicionales...', 'Nome completo': 'Nombre completo', 'Salvar': 'Guardar', 'Voltar': 'Volver',
  'Cadastrar paciente': 'Registrar paciente', 'Enviar': 'Enviar', 'Próximo': 'Siguiente', 'Anterior': 'Anterior', 'Erro': 'Error', 'Erro ao salvar': 'Error al guardar',
  'Melhorar os seguintes dentes:': 'Mejorar los siguientes dientes:', 'Superior *': 'Superior *', 'Inferior *': 'Inferior *', 'Attachments *': 'Attachments *',
  'Aceita attachments anteriores': 'Acepta attachments anteriores', 'Aceita attachments posteriores': 'Acepta attachments posteriores',
  'A não realização de attachments impedem a realização de certos movimentos': 'No realizar attachments impide ciertos movimientos',
  'Acessórios *': 'Accesorios *', 'Aceita botões ortodônticos e a mecânica dos elásticos (sempre se necessário):': 'Acepta botones ortodónticos y mecánica de elásticos (siempre que sea necesario):',
  'A não realização dos mesmos impedem a realização de certos movimentos': 'No realizarlos impide ciertos movimientos', 'Observações': 'Observaciones',
  'Sim': 'Sí', 'Não': 'No',

  // fichas
  'Novos Produtos': 'Nuevos productos', 'Selecione os serviços solicitados': 'Selecciona los servicios solicitados', 'Solicitar EA Air²': 'Solicitar EA Air²',
  'Ficha de novos produtos salva': 'Ficha de nuevos productos guardada', 'Ficha de Finalização': 'Ficha de finalización', 'Dentes (estado atual)': 'Dientes (estado actual)',
  'Movimentos por dente': 'Movimientos por diente', 'Intrusão': 'Intrusión', 'Extrusão': 'Extrusión', 'Vestibularização': 'Vestibularización',
  'Lingualização': 'Lingualización', 'Mesiação': 'Mesialización', 'Distalização': 'Distalización', 'Rotação M': 'Rotación M', 'Rotação D': 'Rotación D',
  'Espaços interproximais (mm)': 'Espacios interproximales (mm)', 'Ficha de finalização salva': 'Ficha de finalización guardada',
  'Ficha de Planejamento': 'Ficha de planificación', 'Arcada superior': 'Arcada superior', 'Arcada inferior': 'Arcada inferior',

  // caso
  'Caso não encontrado': 'Caso no encontrado', 'Descreva o ajuste necessário:': 'Describe el ajuste necesario:', 'Informações do Caso': 'Información del caso',
  'Clínica': 'Clínica', 'Gênero': 'Género', 'Serviço': 'Servicio', 'Planejamento': 'Planificación', 'Alinhadores Superior': 'Alineadores superiores',
  'Alinhadores Inferior': 'Alineadores inferiores', 'Notas do laboratório': 'Notas del laboratorio', 'Visualizar Setup': 'Ver setup',
  'Histórico de revisões': 'Historial de revisiones', 'Timeline': 'Línea de tiempo', 'Produção / Envio': 'Producción / Envío', 'Rastreamento': 'Seguimiento',
  'Enviado em': 'Enviado el', 'Erro no upload': 'Error al subir', 'Fotos Extrabucais': 'Fotos extraorales', 'Fotos Intrabucais': 'Fotos intraorales',
  'STL Superior': 'STL superior', 'STL Inferior': 'STL inferior', 'Rx Panorâmica': 'Rx panorámica', 'Rx Cefalométrica': 'Rx cefalométrica',
  'Caso submetido!': '¡Caso enviado!', 'Planejamento aprovado!': '¡Planificación aprobada!', 'Explique o que precisa ser ajustado no planejamento...': 'Explica qué hay que ajustar en la planificación...',
  'Aprovar Setup': 'Aprobar setup', 'Submeter Caso': 'Enviar caso', 'Enviar Revisão': 'Enviar revisión', 'Aprovação do Caso': 'Aprobación del caso',
  'Assista aos vídeos e revise os documentos para aprovar o caso': 'Mira los videos y revisa los documentos para aprobar el caso',
  'Vídeos de Aprovação': 'Videos de aprobación', 'Baixar': 'Descargar', 'Assistir': 'Ver', 'Documentos': 'Documentos', 'Visualizar': 'Ver',
  'Nenhum material de aprovação disponível ainda.': 'Todavía no hay material de aprobación disponible.', 'Aguarde o laboratório enviar o vídeo/documento.': 'Espera a que el laboratorio envíe el video/documento.',
  'Baixar Vídeo': 'Descargar video', 'Aprovar Caso': 'Aprobar caso', 'Confirmar Aprovação': 'Confirmar aprobación',
  'Você está prestes a aprovar o caso. Esta ação não pode ser desfeita.': 'Estás a punto de aprobar el caso. Esta acción no se puede deshacer.',
  'Alguma observação sobre a aprovação...': 'Alguna observación sobre la aprobación...',

  // workflow estrangeiro
  'Nenhum caso': 'Ningún caso', 'Registrar Postagem': 'Registrar envío', 'Código de rastreio *': 'Código de seguimiento *', 'Transportadora': 'Transportista',
  'Casos a enviar': 'Casos por enviar', 'Brasil': 'Brasil', 'Colômbia': 'Colombia', 'México': 'México', 'Portugal': 'Portugal', 'Peru': 'Perú', 'Espanha': 'España',
  'Caso avançado com sucesso': 'Caso avanzado con éxito', 'Caso postado!': '¡Caso enviado!', 'Casos a imprimir': 'Casos por imprimir',
  'Casos a confeccionar (Pressurização de placas, Recorte, Acabamento, Embalagem)': 'Casos por confeccionar (presurización de placas, recorte, acabado, embalaje)',
  'Impressão 3D (BR)': 'Impresión 3D', 'Recorte (BR)': 'Recorte', 'Avançar': 'Avanzar', 'Impresso': 'Impreso', 'Recortado': 'Recortado', 'Postar': 'Enviar',

  // login
  'Bem-vindo de volta': 'Bienvenido de nuevo', 'Entre com suas credenciais para acessar': 'Ingresa tus credenciales para acceder', 'E-mail': 'Correo electrónico',
  'Senha': 'Contraseña', 'Esqueceu a senha?': '¿Olvidaste tu contraseña?', 'Cadastre-se': 'Regístrate', 'Entrar': 'Ingresar', 'Erro no login': 'Error al iniciar sesión',
  'Código inválido': 'Código inválido', 'Não tem conta?': '¿No tienes cuenta?',

  // LGPD / chat / perfil
  'Privacidade e proteção de dados': 'Privacidad y protección de datos', 'Para continuar, leia e aceite os documentos abaixo (LGPD).': 'Para continuar, lee y acepta los documentos abajo.',
  'Li e aceito': 'Leí y acepto', 'Conversas': 'Conversaciones', 'Selecione um contato para iniciar a conversa': 'Selecciona un contacto para iniciar la conversación',
  'Nenhuma mensagem ainda. Diga olá!': 'Todavía no hay mensajes. ¡Saluda!', 'Escreva uma mensagem...': 'Escribe un mensaje...', 'Enviar imagem': 'Enviar imagen',
  'Buscar dentista ou colega para conversar…': 'Buscar dentista o colega para conversar…', 'Nenhum contato disponível': 'Ningún contacto disponible',
  'Informações Pessoais': 'Información personal', 'Telefone': 'Teléfono', 'Endereço de entrega': 'Dirección de entrega',
  'Perfil atualizado com sucesso!': '¡Perfil actualizado con éxito!', 'Erro ao atualizar perfil': 'Error al actualizar el perfil',
  'Financeiro do dentista': 'Finanzas del dentista', 'Ação': 'Acción', 'Ações': 'Acciones', 'Data': 'Fecha', 'Paciente': 'Paciente',
}

const PADROES: Array<[RegExp, (...m: string[]) => string]> = [
  [/^aguardando há (\d+) dia\(s\)$/, (_, n) => `esperando hace ${n} día(s)`],
  [/^há (\d+) dias$/, (_, n) => `hace ${n} días`],
  [/^há 1 dia$/, () => 'hace 1 día'],
  [/^hoje$/, () => 'hoy'],
  [/^caso nº (\d+)$/i, (_, n) => `caso n.º ${n}`],
  [/^· caso nº (\d+)$/i, (_, n) => `· caso n.º ${n}`],
  [/^Enviado por (.+)$/, (_, n) => `Enviado por ${n}`],
  [/^(\d+)º caso do mês$/, (_, n) => `${n}.º caso del mes`],
]

export function traduzir(texto: string, idioma: Idioma): string {
  if (idioma !== 'es') return texto
  const t = texto.trim()
  if (!t) return texto
  const direto = ES[t]
  let novo: string | undefined = direto
  if (!novo) {
    for (const [re, fn] of PADROES) {
      const m = t.match(re)
      if (m) { novo = fn(...(m as unknown as string[])); break }
    }
  }
  if (!novo || novo === t) return texto
  return texto.replace(t, novo)
}

// ---------------------------------------------------------------- tradutor da tela
const originais = new WeakMap<Node, string>()
const attrsOriginais = new WeakMap<Element, Record<string, string>>()
const ATTRS = ['placeholder', 'title', 'aria-label']
let observador: MutationObserver | null = null
let idiomaAtual: Idioma = 'pt'

function ignorar(el: Element | null): boolean {
  while (el) {
    if (el.hasAttribute?.('data-no-translate') || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable) return true
    el = el.parentElement
  }
  return false
}

function traduzNo(no: Node) {
  if (no.nodeType === Node.TEXT_NODE) {
    if (ignorar(no.parentElement)) return
    const original = originais.get(no) ?? no.nodeValue ?? ''
    const alvo = idiomaAtual === 'es' ? traduzir(original, 'es') : original
    if (alvo !== original && !originais.has(no)) originais.set(no, original)
    if (no.nodeValue !== alvo) no.nodeValue = alvo
    return
  }
  if (no.nodeType !== Node.ELEMENT_NODE) return
  const el = no as Element
  if (ignorar(el)) return
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue
    const salvos = attrsOriginais.get(el) || {}
    const original = salvos[a] ?? el.getAttribute(a) ?? ''
    const alvo = idiomaAtual === 'es' ? traduzir(original, 'es') : original
    if (alvo !== original && salvos[a] === undefined) { salvos[a] = original; attrsOriginais.set(el, salvos) }
    if (el.getAttribute(a) !== alvo) el.setAttribute(a, alvo)
  }
  el.childNodes.forEach(traduzNo)
}

export function aplicarIdioma(idioma: Idioma) {
  idiomaAtual = idioma
  document.documentElement.lang = idioma === 'es' ? 'es' : 'pt-BR'
  traduzNo(document.body)
  if (idioma === 'es' && !observador) {
    observador = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') {
          // texto novo vindo do React: esquece o original antigo e traduz de novo
          originais.delete(m.target)
          traduzNo(m.target)
        } else if (m.type === 'attributes') {
          const el = m.target as Element
          const salvos = attrsOriginais.get(el)
          if (salvos && m.attributeName) delete salvos[m.attributeName]
          traduzNo(el)
        } else m.addedNodes.forEach(traduzNo)
      }
    })
    observador.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
  } else if (idioma !== 'es' && observador) {
    observador.disconnect()
    observador = null
  }
}

export const IDIOMA_LOCAL = 'ortholab-idioma'
