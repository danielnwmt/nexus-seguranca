# Painel do dono SaaS

## Objetivo
Criar uma área exclusiva para o dono do SaaS, vinculada a suporte@protenexus.com, com visão geral operacional e acesso protegido.

## Implementação
- Criar um papel separado de proprietário, concedido somente ao usuário informado.
- Adicionar uma página de gestão com indicadores de empresas, usuários, câmeras, alarmes e armazenamento.
- Proteger a rota e mostrar o acesso no menu apenas para o proprietário.
- Reutilizar os padrões visuais e componentes atuais.

## Segurança
- Validar o papel no banco; não confiar no e-mail ou no navegador para autorizar.
- Manter os dados das empresas isolados e conceder leitura global somente ao proprietário.

## Validação
- Verificar tipos, abertura da página e bloqueio para usuários sem o papel.
