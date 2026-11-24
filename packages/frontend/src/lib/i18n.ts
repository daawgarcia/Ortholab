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
  'Nenhum paciente encontrado': 'Ningún paciente encontrado', 'Criar primeiro paciente': 'Crear primer paciente', 'Caixa': 'Caja', 'Baixar Excel do período': 'Descargar Excel del período', 'Baixar todo o histórico': 'Descargar todo el historial', 'Limpar período': 'Limpiar período', 'De': 'Desde', 'Até': 'Hasta', 'Nenhum uso de cupom neste período.': 'Ningún uso de cupón en este período.', 'Buscar colega, financeiro, vendas ou admin…': 'Buscar colega, finanzas, ventas o admin…', 'Buscar pelo nome: dentista ou colega…': 'Buscar por nombre: dentista o colega…', 'Fale com o Suporte, o seu vendedor ou o Financeiro.': 'Habla con Soporte, tu vendedor o Finanzas.', 'Suporte': 'Soporte', 'Seu vendedor': 'Tu vendedor', 'Suporte Esthetic Aligner': 'Soporte Esthetic Aligner', 'Financeiro Esthetic Aligner': 'Finanzas Esthetic Aligner', 'Atendimento aos dentistas ▾': 'Atención a dentistas ▾', 'Atendimento aos dentistas ▴': 'Atención a dentistas ▴', 'trocar': 'cambiar', 'Nome do colega…': 'Nombre del colega…', '‹ Anterior': '‹ Anterior', 'Próxima ›': 'Siguiente ›', 'Buscar entre os pacientes deste dentista: nome ou nº da caixa': 'Buscar entre los pacientes de este dentista: nombre o n.º de caja',
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
  'Contenção': 'Contención', 'Placa Miorrelaxante': 'Placa miorrelajante', 'A faturar (como no Ortholab 1)': 'Por facturar (como en Ortholab 1)', 'Faturados': 'Facturados', 'Caixa': 'Caja', 'sem caixa': 'sin caja', 'EA Mio': 'EA Mio', 'EA Guard': 'EA Guard', 'Paciente cadastrado com sucesso': 'Paciente registrado con éxito',
  'Selecione o tipo de tratamento': 'Selecciona el tipo de tratamiento', 'Escolha Alinhadores, Contenção, EA Air², EA Mio ou EA Guard para continuar.': 'Elige Alineadores, Contención, EA Air², EA Mio o EA Guard para continuar.',
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
  // pente fino (nov/2026): login, pacientes, fichas, casos, aprovação, chat
  'O portal digital do laboratório Esthetic Aligner. Envie casos, acompanhe planejamentos e solicite a produção dos seus alinhadores.': 'El portal digital del laboratorio Esthetic Aligner. Envía casos, sigue las planificaciones y solicita la producción de tus alineadores.',
  'Envio de casos com documentação completa': 'Envío de casos con documentación completa',
  'Aprovação do setup ortodôntico': 'Aprobación del setup ortodóntico',
  'Acompanhamento em tempo real': 'Seguimiento en tiempo real',
  'Histórico completo de tratamentos': 'Historial completo de tratamientos',
  'Aquecendo servidor...': 'Iniciando el servidor...',
  'Sem conexão com o servidor. Aguarde 30s e tente novamente (servidor em modo sleep).': 'Sin conexión con el servidor. Espera 30 s e inténtalo de nuevo.',
  'E-mail inválido': 'Correo electrónico inválido',
  'Senha obrigatória': 'Contraseña obligatoria',
  'Não encontramos seu cadastro no Ortholab pelo e-mail, CPF ou CRO. Entre com seu e-mail e senha ou fale com a equipe.': 'No encontramos tu registro en Ortholab. Ingresa con tu correo y contraseña o contacta al equipo.',
  'O link de acesso expirou. Volte ao portal e clique de novo, ou entre com seu e-mail e senha.': 'El enlace de acceso expiró. Vuelve al portal y haz clic de nuevo, o ingresa con tu correo y contraseña.',
  'Não foi possível entrar automaticamente. Entre com seu e-mail e senha.': 'No fue posible ingresar automáticamente. Ingresa con tu correo y contraseña.',
  'Entrando no Ortholab…': 'Ingresando a Ortholab…',
  'Código de acesso': 'Código de acceso',
  'Por segurança, enviamos um código de 6 dígitos para': 'Por seguridad, enviamos un código de 6 dígitos a',
  'Voltar e reenviar código': 'Volver y reenviar el código',
  'Acessar': 'Acceder',
  'Recuperar senha': 'Recuperar contraseña',
  'Informe seu e-mail para receber o link de recuperação': 'Ingresa tu correo para recibir el enlace de recuperación',
  'Enviar link': 'Enviar enlace',
  'E-mail enviado!': '¡Correo enviado!',
  'Voltar ao login': 'Volver al inicio de sesión',
  'Ir para o login': 'Ir al inicio de sesión',
  'Se o e-mail estiver cadastrado, você receberá as instruções em breve.': 'Si el correo está registrado, recibirás las instrucciones en breve.',
  'Redefinir senha': 'Restablecer contraseña',
  'Digite sua nova senha abaixo': 'Escribe tu nueva contraseña abajo',
  'Nova senha': 'Nueva contraseña',
  'Mínimo 8 caracteres': 'Mínimo 8 caracteres',
  'Senha redefinida com sucesso!': '¡Contraseña restablecida con éxito!',
  'Criar conta': 'Crear cuenta',
  'Preencha seus dados para solicitar acesso': 'Completa tus datos para solicitar acceso',
  'Solicitar cadastro': 'Solicitar registro',
  'Já tem conta?': '¿Ya tienes cuenta?',
  'Cadastro enviado!': '¡Registro enviado!',
  'Erro no cadastro': 'Error en el registro',
  'Erro ao cadastrar': 'Error al registrar',
  'Seu cadastro foi recebido e está aguardando aprovação do administrador. Você receberá um e-mail quando for aprovado.': 'Tu registro fue recibido y está esperando la aprobación del administrador. Recibirás un correo cuando sea aprobado.',
  'Nome obrigatório': 'Nombre obligatorio',
  'CRO obrigatório': 'Registro profesional obligatorio',
  'Clínica obrigatória': 'Clínica obligatoria',
  'Telefone obrigatório': 'Teléfono obligatorio',
  'Clínica Odontológica...': 'Clínica odontológica...',
  'Dr. João Silva': 'Dr. Juan Pérez',
  'Obrigatório': 'Obligatorio',
  'Acesso rápido': 'Acceso rápido',
  'Ocultar menu (mais espaço na tela)': 'Ocultar menú (más espacio en pantalla)',
  'Nada encontrado para “': 'Nada encontrado para “',
  'pacientes encontrados →': 'pacientes encontrados →',
  'Ninguém encontrado': 'Nadie encontrado',
  'Projetos': 'Proyectos',
  'Online': 'En línea',
  'Offline': 'Desconectado',
  'Aceitar e continuar': 'Aceptar y continuar',
  'Entendi': 'Entendido',
  'Aviso': 'Aviso',
  'Notificação': 'Notificación',
  'Ver mais': 'Ver más',
  'casos aguardando sua aprovação': 'casos esperando tu aprobación',
  'Olá,': 'Hola,',
  'Você está impersonando este usuário. Faça logout para retornar.': 'Estás accediendo como este usuario. Cierra sesión para volver.',
  'Pacientes de': 'Pacientes de',
  '‹ Voltar para': '‹ Volver a',
  'ver todos os pacientes': 'ver todos los pacientes',
  'Ver todos os': 'Ver todos los',
  'Nenhum paciente cadastrado': 'Ningún paciente registrado',
  'Buscar paciente...': 'Buscar paciente...',
  'Buscar dentista por nome...': 'Buscar dentista por nombre...',
  'Buscar dentista por nome, e-mail ou clínica...': 'Buscar dentista por nombre, correo o clínica...',
  'Masculino': 'Masculino',
  'Feminino': 'Femenino',
  'Preencha os dados do paciente': 'Completa los datos del paciente',
  'Dados do Paciente': 'Datos del paciente',
  'Nome do paciente *': 'Nombre del paciente *',
  'Paciente criado com sucesso. Próximo passo: adicione as fotos, os modelos digitais e as fichas. Quando a caixa for aberta, o fluxo entra em preparo de modelos automaticamente.': 'Paciente creado con éxito. Siguiente paso: agrega las fotos, los modelos digitales y las fichas. Cuando se abra la caja, el flujo pasa automáticamente a preparación de modelos.',
  'Checklist recomendado': 'Lista recomendada',
  '1. Enviar fotos do paciente': '1. Enviar fotos del paciente',
  '2. Enviar modelos digitais': '2. Enviar modelos digitales',
  '3. Preencher as fichas necessárias': '3. Completar las fichas necesarias',
  '4. Registrar o recebimento para iniciar o workflow': '4. Registrar la recepción para iniciar el flujo',
  'A abertura do fluxo é feita pelo time interno após o recebimento da caixa.': 'La apertura del flujo la hace el equipo interno después de recibir la caja.',
  'Fotos/Vídeos': 'Fotos/Videos',
  'Fotos/Vídeos Restritos': 'Fotos/Videos restringidos',
  'Mídias enviadas': 'Archivos enviados',
  'Mídias restritas enviadas': 'Archivos restringidos enviados',
  'Erro ao enviar mídias': 'Error al enviar archivos',
  'Erro ao enviar arquivo': 'Error al enviar el archivo',
  'Erro ao enviar PDF': 'Error al enviar el PDF',
  'Erro ao enviar vídeo': 'Error al enviar el video',
  'Enviar arquivo de trabalho': 'Enviar archivo de trabajo',
  'Enviar PDF de Relatório': 'Enviar PDF de informe',
  'Enviar Vídeo MP4': 'Enviar video MP4',
  'Relatório enviado com sucesso!': '¡Informe enviado con éxito!',
  'Vídeo enviado com sucesso!': '¡Video enviado con éxito!',
  'Vídeo apagado': 'Video eliminado',
  'Erro ao apagar vídeo': 'Error al eliminar el video',
  'Apagar vídeo': 'Eliminar video',
  'Erro ao apagar': 'Error al eliminar',
  'Carregando vídeo…': 'Cargando video…',
  'Baixar o vídeo': 'Descargar el video',
  'Tentar de novo': 'Intentar de nuevo',
  'Tente novamente': 'Inténtalo de nuevo',
  'Tente novamente.': 'Inténtalo de nuevo.',
  'Não foi possível carregar o vídeo agora.': 'No fue posible cargar el video ahora.',
  'Este vídeo está em formato .mov, que alguns navegadores não conseguem tocar.': 'Este video está en formato .mov, que algunos navegadores no pueden reproducir.',
  'Informações relevantes para o planejamento...': 'Información relevante para la planificación...',
  'Nenhum caso ativo encontrado para este paciente.': 'No se encontró ningún caso activo para este paciente.',
  'Nenhum caso encontrado': 'Ningún caso encontrado',
  'Nenhum fluxo em aberto. Registre o recebimento dos modelos para iniciar o processo.': 'Ningún flujo abierto. Registra la recepción de los modelos para iniciar el proceso.',
  'Concluído em': 'Concluido el',
  'Caso nº': 'Caso n.º',
  '· caso nº': '· caso n.º',
  '· criado em': '· creado el',
  'Caso': 'Caso',
  'Sem notas': 'Sin notas',
  'Fluxo iniciado': 'Flujo iniciado',
  'Etapa salva com sucesso': 'Etapa guardada con éxito',
  'O caso foi avançado no fluxo.': 'El caso avanzó en el flujo.',
  'Próxima Etapa': 'Siguiente etapa',
  'Próxima': 'Siguiente',
  'Página': 'Página',
  'Salvando...': 'Guardando...',
  'Salvando…': 'Guardando…',
  'Salvar alterações': 'Guardar cambios',
  'Salvar informações': 'Guardar información',
  'Salvar Ficha': 'Guardar ficha',
  'Salvar Ficha Clínica': 'Guardar ficha clínica',
  'Selecione': 'Selecciona',
  'Selecione um serviço': 'Selecciona un servicio',
  'Tipo de serviço': 'Tipo de servicio',
  'Tipo do caso *': 'Tipo de caso *',
  'Todos os status': 'Todos los estados',
  'Exportar': 'Exportar',
  'Impressões': 'Impresiones',
  'Laboratório': 'Laboratorio',
  'Em Aberto': 'Abierto',
  'Em Planejamento': 'En planificación',
  'Aguard. Aprovação': 'Esp. aprobación',
  'Atividades': 'Actividades',
  'Observações clínicas': 'Observaciones clínicas',
  'Data da Consulta *': 'Fecha de la consulta *',
  'Avaliação *': 'Evaluación *',
  'Ficha clínica registrada': 'Ficha clínica registrada',
  'Consulta de emergência': 'Consulta de emergencia',
  'Bem adaptado': 'Bien adaptado',
  'Quase adaptado': 'Casi adaptado',
  'Mal adaptado': 'Mal adaptado',
  'Novas plaquinhas': 'Nuevas placas',
  'Não trouxe': 'No trajo',
  'Inserção de attachment': 'Colocación de attachment',
  'Inserção de botão': 'Colocación de botón',
  'Ativação de elásticos': 'Activación de elásticos',
  'Anexar botões': 'Colocar botones',
  'Arcadas a serem tratadas *': 'Arcadas a tratar *',
  'Ambas': 'Ambas',
  'Relação sagital *': 'Relación sagital *',
  'Manter': 'Mantener',
  'Melhorar': 'Mejorar',
  'Melhorar Classe II': 'Mejorar Clase II',
  'Melhorar Classe III': 'Mejorar Clase III',
  'Sobremordida *': 'Sobremordida *',
  'Sobressaliência *': 'Resalte (overjet) *',
  'Aumentar': 'Aumentar',
  'Reduzir': 'Reducir',
  'Normal': 'Normal',
  'Linha média (correções maiores que 2mm, desgaste ou mudança do comp. de arco podem ser necessárias):': 'Línea media (correcciones mayores a 2 mm pueden requerir desgaste o cambio de la longitud de arco):',
  'Espaço superior *': 'Espacio superior *',
  'Espaço inferior *': 'Espacio inferior *',
  'Fechar espaços possíveis': 'Cerrar espacios posibles',
  'Criar espaços possíveis': 'Crear espacios posibles',
  'Expansão superior *': 'Expansión superior *',
  'Expansão inferior *': 'Expansión inferior *',
  'Comprimento de arco superior *': 'Longitud de arco superior *',
  'Comprimento de arco inferior *': 'Longitud de arco inferior *',
  'Desgaste interproximal *': 'Desgaste interproximal *',
  'Se necessário': 'Si es necesario',
  'Mover': 'Mover',
  'Torque +': 'Torque +',
  'Torque -': 'Torque -',
  '(Clique para ciclar)': '(Haz clic para cambiar)',
  'Ausente': 'Ausente',
  'Implante': 'Implante',
  'Prótese Fixa': 'Prótesis fija',
  'Periodontal': 'Periodontal',
  'Convencional': 'Convencional',
  'Aceita': 'Acepta',
  'Não aceita': 'No acepta',
  'Contenção Superior (nº alinhadores)': 'Contención superior (n.º de alineadores)',
  'Contenção Inferior (nº alinhadores)': 'Contención inferior (n.º de alineadores)',
  'Sem alinhadores': 'Sin alineadores',
  'EA MIO (placa miorrelaxante)': 'EA MIO (placa miorrelajante)',
  'EA Air²': 'EA Air²',
  'Finalizar caso': 'Finalizar caso',
  'Marcar caso como concluído': 'Marcar caso como concluido',
  'Redefinir caso': 'Restablecer caso',
  'Novo Caso': 'Nuevo caso',
  'Criar Caso e Adicionar Documentos': 'Crear caso y agregar documentos',
  'Caso criado com sucesso!': '¡Caso creado con éxito!',
  'Erro ao criar caso': 'Error al crear el caso',
  'Cupom de Desconto': 'Cupón de descuento',
  'Cupons não podem ser aplicados em placas e outros serviços não alinhadores.': 'Los cupones no se aplican a placas ni a otros servicios que no sean alineadores.',
  'Disponível apenas para alinhadores': 'Disponible solo para alineadores',
  'Seguro de Abandono': 'Seguro de abandono',
  'Pack Ativo': 'Pack activo',
  'Parcelas': 'Cuotas',
  'À vista': 'Al contado',
  'a combinar': 'a convenir',
  'Caso aprovado': 'Caso aprobado',
  'Aprovando...': 'Aprobando...',
  'Aprovar setup': 'Aprobar setup',
  'Falha ao aprovar caso': 'Error al aprobar el caso',
  'Falha ao solicitar revisão': 'Error al solicitar la revisión',
  'Veja a checagem 3D, escolha o pacote e aprove — o valor final já aparece com desconto do mês e frete.': 'Mira el chequeo 3D, elige el paquete y aprueba: el valor final ya aparece con el descuento del mes y el envío.',
  'Aguardando aprovação há': 'Esperando aprobación hace',
  'aguardando há': 'esperando hace',
  'dias': 'días',
  'dia': 'día',
  '— aprovação após 30 dias cobra a checagem (R$ 320)': '— la aprobación después de 30 días cobra el chequeo',
  'Ainda não há leitura do PDF do planejamento 3D para este caso. Ao anexar o PDF, a indicação é lida automaticamente.': 'Todavía no hay lectura del PDF de la planificación 3D de este caso. Al adjuntar el PDF, la indicación se lee automáticamente.',
  'Lido do planejamento 3D': 'Leído de la planificación 3D',
  'séries superiores,': 'series superiores,',
  'inferiores': 'inferiores',
  ', sem guia de attachment': ', sin guía de attachment',
  'sem data': 'sin fecha',
  'Este caso tem': 'Este caso tiene',
  'planejamentos. Compare e escolha:': 'planificaciones. Compara y elige:',
  'Planejamento escolhido': 'Planificación elegida',
  'Escolhido: Planejamento': 'Elegida: Planificación',
  'O valor e as séries passam a seguir este planejamento.': 'El valor y las series pasan a seguir esta planificación.',
  'Não foi possível escolher': 'No fue posible elegir',
  '2. Forma de pagamento': '2. Forma de pago',
  'Enviar (SEDEX)': 'Enviar',
  'Retirar (sem frete)': 'Retirar (sin envío)',
  'Frete —': 'Envío —',
  'alinhadores ×': 'alineadores ×',
  'º caso do mês: -': '.º caso del mes: -',
  'º caso do mês, -': '.º caso del mes, -',
  'Desconto progressivo (': 'Descuento progresivo (',
  'Checagem 3D (aprovação após 30 dias)': 'Chequeo 3D (aprobación después de 30 días)',
  'Não foi possível abrir': 'No fue posible abrir',
  'Séries sup.': 'Series sup.',
  'Séries inf.': 'Series inf.',
  'Guias attach.': 'Guías attach.',
  'Nenhum produto/pacote compatível foi configurado para este tipo de tratamento.': 'No hay ningún producto/paquete compatible configurado para este tipo de tratamiento.',
  'Nenhuma conversa ainda. Busque um dentista ou colega acima para começar.': 'Todavía no hay conversaciones. Busca un dentista o colega arriba para empezar.',
  '📷 Imagem': '📷 Imagen',
  'Vendedor': 'Vendedor',
  'Admin': 'Admin',

  'paciente(s) cadastrado(s)': 'paciente(s) registrado(s)',
  'paciente(s) deste dentista ·': 'paciente(s) de este dentista ·',
}

const PADROES: Array<[RegExp, (...m: string[]) => string]> = [
  [/^Página (\d+) de (\d+) · (\d+) paciente\(s\)( deste dentista)?$/, (_, a, b, c, d) => `Página ${a} de ${b} · ${c} paciente(s)${d ? ' de este dentista' : ''}`],
  [/^aguardando há (\d+) dia\(s\)$/, (_, n) => `esperando hace ${n} día(s)`],
  [/^há (\d+) dias$/, (_, n) => `hace ${n} días`],
  [/^há 1 dia$/, () => 'hace 1 día'],
  [/^hoje$/, () => 'hoy'],
  [/^caso nº (\d+)$/i, (_, n) => `caso n.º ${n}`],
  [/^· caso nº (\d+)$/i, (_, n) => `· caso n.º ${n}`],
  [/^Enviado por (.+)$/, (_, n) => `Enviado por ${n}`],
  [/^(\d+)º caso do mês$/, (_, n) => `${n}.º caso del mes`],
  [/^Planejamento (\d+)( ✓)?$/, (_, n, c) => `Planificación ${n}${c || ''}`],
  [/^Escolher o Planejamento (\d+)$/, (_, n) => `Elegir la Planificación ${n}`],
  [/^Este caso tem (\d+) planejamentos\. Compare e escolha:$/, (_, n) => `Este caso tiene ${n} planificaciones. Compara y elige:`],
  [/^Pacientes de (.+)$/, (_, n) => `Pacientes de ${n}`],
  [/^‹ Voltar para (.+)$/, (_, n) => `‹ Volver a ${n}`],
  [/^(\d+) paciente\(s\) deste dentista ·$/, (_, n) => `${n} paciente(s) de este dentista ·`],
  [/^(\d+) paciente\(s\) cadastrado\(s\)$/, (_, n) => `${n} paciente(s) registrado(s)`],
  [/^Aguardando aprovação há (\d+) dias?$/, (_, n) => `Esperando aprobación hace ${n} día(s)`],
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
