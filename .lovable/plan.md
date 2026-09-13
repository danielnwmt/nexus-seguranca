# Gestão SaaS por empresa

## Objetivo
Transformar a área do proprietário em um painel exclusivo para administrar as empresas assinantes do SaaS, sem mostrar os módulos operacionais da empresa de segurança.

## O que será feito
- Exibir ao proprietário apenas **Gestão SaaS** e **Sair** no menu lateral.
- Adicionar na Gestão SaaS uma lista de empresas cadastradas, com situação ativa/inativa e informações principais.
- Criar o botão **Adicionar empresa** com formulário de cadastro.
- Criar a ação **Liberar recursos** para definir, por empresa, quais módulos estarão disponíveis.
- Permitir editar, ativar e desativar empresas e alterar seus recursos liberados.
- Manter os indicadores gerais já existentes no topo do painel.

## Recursos controláveis
- Dashboard
- Câmeras, Ao Vivo, Mapa, Gravações e Timeline
- Clientes
- Vigilantes e Técnicos
- Ordens de Serviço
- Estoque, Orçamentos, Vendedores e Financeiro
- Alarmes e Centrais de Alarme
- Analíticos IA
- Saúde do Sistema
- Atendimento
- Configurações

## Segurança e funcionamento
- Criar estrutura própria para empresas SaaS e seus recursos no banco.
- Permitir gerenciamento somente ao papel `owner`.
- Associar usuários e dados operacionais à empresa correspondente para que as liberações sejam aplicadas no menu e nas páginas.
- Validar no banco, e não apenas na tela, que cada empresa só acessa seus próprios dados e recursos.

## Validação
- Confirmar que o proprietário vê somente a Gestão SaaS.
- Cadastrar uma empresa de teste, alterar seus recursos e verificar a persistência.
- Confirmar que um usuário da empresa vê apenas os recursos liberados.
- Executar as verificações de código e segurança após as mudanças.
