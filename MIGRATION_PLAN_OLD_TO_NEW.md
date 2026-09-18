# Plano de migração Old → New (Ortholab)

## Regra principal

- O projeto antigo é a fonte de verdade funcional.
- O projeto novo é o ambiente de evolução e testes.
- Só o que estiver validado no antigo deve ser migrado para o novo.
- O novo não deve ser reaplicado ao antigo sem aprovação explícita.
- Novidades do novo ficam isoladas até serem validadas.

## Objetivo

Permitir que o novo Ortholab comece a ser testado com o máximo de funcionalidade útil, sem corromper ou replicar bugs do sistema antigo.

## Modelo de trabalho

### Fluxo de sincronização

Old (estável) -> New (teste)

Não invertido.

### Critério de migração

Uma funcionalidade só entra no novo quando:

1. existe no antigo;
2. está funcionando no antigo;
3. foi documentada;
4. foi validada em fluxos reais;
5. foi testada no novo antes de ser considerada estável.

## Estrutura recomendada

### 1) Acesso e autenticação
- login
- recuperação de senha
- refresh token
- perfil do usuário
- roles/permissões

### 2) Pacientes
- cadastro
- edição
- detalhes
- histórico
- upload de imagens
- arquivos

### 3) Dentistas
- cadastro
- vínculo com clínica
- consulta
- detalhamento

### 4) Workflow
- entradas
- planning center
- impressão 3D
- laboratório
- recorte
- expedição
- status do caso

### 5) Financeiro
- pagamentos
- PIX
- cartão
- relatórios financeiros
- faturamento

### 6) Comunicação
- chat
- notificações
- push
- avisos

### 7) Administração
- usuários
- módulos
- conteúdo
- vídeos
- relatórios
- ajustes gerais

## Ordem de migração recomendada

1. Autenticação
2. Usuários / perfis
3. Pacientes
4. Dentistas
5. Workflow base
6. Financial básico
7. Comunicação
8. Administração
9. Relatórios e dashboards
10. Novidades do novo

## Regras por módulo

### Módulo estável
- já funcionando no antigo
- migrado para o novo
- validado em teste
- habilitado no novo

### Módulo em teste
- funcionalidade novata ou experimental
- não entra em produção antiga
- deve ficar isolada no novo

### Módulo rejeitado
- não validado
- sem regra clara de negócio
- com inconsistência em comparação com o antigo
- deve ser descartado ou adiado

## Checklist de validação por módulo

Para cada funcionalidade migrada, validar:

- cadastro funciona
- edição funciona
- consulta funciona
- permissões estão corretas
- fluxo de status está consistente
- upload e arquivos funcionam
- erros e edge cases foram testados
- dados estão salvos corretamente
- tela responde a problemas reais de negócio

## Estrutura de branches

### Branches sugeridas
- main: antigo estável
- new-ortholab: desenvolvimento do novo
- feature/auth-migration
- feature/patients-migration
- feature/workflow-migration
- feature/finance-migration

## Política de merge

- merge do old para o new apenas quando o módulo estiver validado
- merge do new para o old somente com aprovação explícita e sem risco de regressão
- nunca fazer “merge completo do projeto” sem revisão por módulo

## Ambiente de teste

### O novo projeto deve ser testado em:
- login real
- usuário admin
- usuário dentista
- usuário financeiro
- usuário vendedor
- fluxo completo de caso
- upload de imagens e arquivos
- tratamentos de erro
- permissões e acesso

## Critérios para liberar

O novo Ortholab pode começar a ser testado quando:

- autenticação estiver estável
- pacientes e workflow essenciais estiverem funcionando
- banco e rotas estiverem consistentes
- a navegação principal estiver ok
- a base do antigo foi reproduzida com segurança

## Observação importante

O objetivo não é "copiar o antigo inteiro e colar no novo".
O objetivo é:

- reaproveitar a lógica que já funciona;
- trazer a base estável para a nova arquitetura;
- manter o novo como laboratório de inovação.

## Próximo passo prático

1. listar todos os módulos presentes no projeto antigo;
2. separar em: estável / pendente / experimental;
3. migrar a ordem acima;
4. testar por módulo;
5. só então abrir para uso geral no novo projeto.

## Arquivos relevantes do projeto

- [Ortholab/packages/frontend/src/App.tsx](Ortholab/packages/frontend/src/App.tsx)
- [Ortholab/packages/frontend/src/components/layout/sidebar.tsx](Ortholab/packages/frontend/src/components/layout/sidebar.tsx)
- [Ortholab/packages/frontend/src/pages/dashboard/index.tsx](Ortholab/packages/frontend/src/pages/dashboard/index.tsx)

