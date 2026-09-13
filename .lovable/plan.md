# Correção geral do Nexus Segurança

## Objetivo
Deixar o sistema abrindo corretamente na nuvem e no Ubuntu, corrigindo os erros críticos já identificados.

## Correções
- Impedir tela preta quando a configuração da nuvem estiver ausente, mostrando uma mensagem clara em vez de travar.
- Corrigir os avisos de referências inválidas na tela de login.
- Restaurar as permissões necessárias para usuários autenticados acessarem os dados protegidos.
- Garantir que a marca da empresa carregue com segurança na tela de login.
- Corrigir a troca obrigatória de senha no primeiro acesso da instalação local.
- Fazer a análise contínua por IA permanecer ativa mesmo após sair da tela de Analíticos.
- Validar abertura, login, navegação principal e erros do navegador.

## Detalhes técnicos
- Aplicar uma migração mínima para liberar apenas as funções usadas pelas regras de acesso.
- Manter dados privados bloqueados para visitantes.
- Mover o agendamento contínuo da IA para execução na nuvem, sem depender da aba aberta.
- Adicionar proteção de inicialização sem alterar os arquivos gerados automaticamente.
