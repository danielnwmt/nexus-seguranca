# Endereço próprio por empresa

## O que será feito
- Adicionar no cadastro da empresa a escolha entre **Subdomínio automático** e **Domínio próprio do cliente**.
- Exibir somente o campo correspondente à opção escolhida, com prévia do endereço final.
- Salvar o domínio próprio de forma exclusiva e validada.
- Reconhecer o domínio próprio no acesso e permitir login somente para usuários vinculados à empresa correta.
- Mostrar o endereço escolhido na lista de empresas.

## Detalhes técnicos
- Incluir `domain_type` e `custom_domain` nas empresas, com validação e índice único para domínio próprio.
- Enviar o endereço atual ao serviço de login para validar subdomínio ou domínio próprio.
- Manter empresas existentes usando subdomínio automático.
- O cliente ainda precisará apontar o DNS do domínio próprio para a hospedagem antes de o endereço funcionar publicamente.

## Validação
- Testar criação e edição nos dois modos.
- Confirmar a exibição correta do endereço na Gestão SaaS.
- Validar o login por subdomínio e por domínio próprio.
