/**
 * MINUTAS (rascunhos) dos textos legais — devem ser revisados pelo jurídico/encarregado (DPO)
 * antes do lançamento. O admin edita os textos em Administração → Conteúdo; ao editar,
 * todos os usuários precisam aceitar a nova versão no próximo acesso.
 */
export const MINUTAS: Record<string, { title: string; body: string }> = {
  'termos-de-uso': {
    title: 'Termos de Uso do Ortholab',
    body: `MINUTA — REVISAR COM O JURÍDICO ANTES DO LANÇAMENTO

1. Sobre o Ortholab
O Ortholab é a plataforma da Esthetic Aligner para envio, planejamento, aprovação, produção e faturamento de casos de alinhadores e demais produtos, utilizada por cirurgiões-dentistas credenciados e pela equipe da Esthetic Aligner.

2. Acesso e responsabilidade pela conta
O acesso é pessoal e intransferível. O usuário é responsável por manter sua senha em sigilo e por todas as ações realizadas com sua conta. Em caso de suspeita de uso indevido, comunique imediatamente a Esthetic Aligner.

3. Responsabilidade do dentista sobre os dados dos pacientes
O cirurgião-dentista declara que obteve dos seus pacientes as autorizações necessárias para o envio de dados pessoais, fotos, modelos e exames à Esthetic Aligner para a finalidade de planejamento e confecção do tratamento, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018) e do Código de Ética Odontológica.

4. Uso permitido
É proibido utilizar a plataforma para fins diferentes do tratamento dos pacientes e da relação comercial com a Esthetic Aligner, compartilhar dados de pacientes com terceiros não autorizados ou tentar acessar dados de outros usuários.

5. Registros de acesso
Para segurança e cumprimento legal, a plataforma registra acessos e operações realizadas (data, hora, usuário e endereço IP).

6. Alterações
Estes termos podem ser atualizados. Quando isso ocorrer, será solicitado um novo aceite no próximo acesso.

7. Contato
Dúvidas: [e-mail do encarregado de dados / DPO].`,
  },
  'politica-de-privacidade': {
    title: 'Política de Privacidade',
    body: `MINUTA — REVISAR COM O JURÍDICO/ENCARREGADO (DPO) ANTES DO LANÇAMENTO

1. Quem somos
[Razão social da Esthetic Aligner], CNPJ [•], com sede em [•] ("Esthetic Aligner"), é responsável pelo tratamento dos dados pessoais realizados no Ortholab.
Encarregado pelo tratamento de dados (DPO): [nome] — [e-mail].

2. Quais dados tratamos
• Dos dentistas e da equipe: nome, CRO, CPF/CNPJ, e-mail, telefone, endereço, dados de faturamento e registros de acesso.
• Dos pacientes (enviados pelo dentista): nome, data de nascimento, sexo, fotos, modelos digitais (STL), exames, fichas de planejamento, prontuário e informações do tratamento. Dados de saúde são dados pessoais sensíveis (LGPD art. 11).

3. Para que usamos
• Planejar, produzir e entregar os tratamentos solicitados pelo dentista;
• Faturamento, emissão de notas fiscais e cobrança (integração com ERP TOTVS e meios de pagamento);
• Comunicação operacional com o dentista;
• Cumprimento de obrigações legais e regulatórias (inclusive guarda de prontuário e documentos fiscais);
• Segurança da plataforma e prevenção a fraudes.

4. Bases legais
Execução de contrato com o dentista, cumprimento de obrigação legal, exercício regular de direitos, tutela da saúde (dados sensíveis, art. 11, II, "f") e legítimo interesse para segurança, conforme o caso.

5. Com quem compartilhamos
Somente com fornecedores necessários à operação, sob contrato e obrigação de confidencialidade: hospedagem em nuvem (Amazon Web Services, região São Paulo), ERP (TOTVS), meios de pagamento (CAIXA e Rede) e envio de e-mails. Não vendemos dados.

6. Por quanto tempo guardamos
Pelo tempo necessário às finalidades acima e aos prazos legais (prontuário odontológico, documentos fiscais e contábeis). Depois disso, os dados são eliminados ou anonimizados.

7. Segurança
Conexão criptografada (HTTPS), arquivos em armazenamento privado com links temporários, controle de acesso por perfil, senhas criptografadas e registro de acessos.

8. Direitos dos titulares
O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação (quando cabível) e informações sobre compartilhamento, pelo e-mail do encarregado. Pacientes devem, preferencialmente, encaminhar o pedido também ao seu dentista.

9. Atualizações
Esta política pode ser atualizada; a versão vigente fica sempre disponível no Ortholab.`,
  },
}
