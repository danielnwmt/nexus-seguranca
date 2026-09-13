# Instalador Ubuntu do MediaMTX

## Objetivo
Criar um script independente para instalar e configurar somente o servidor MediaMTX no Ubuntu.

## Implementação
- Detectar Ubuntu, privilégios administrativos e arquitetura `amd64` ou `arm64`.
- Baixar uma versão estável do MediaMTX e instalar o executável e a configuração do Nexus.
- Detectar o IP público para configurar o WebRTC.
- Criar e ativar o serviço `systemd`, com reinício automático.
- Liberar no firewall as portas RTMP, RTSP, HLS, WebRTC, API e UDP do WebRTC.
- Tornar o script seguro para executar novamente, atualizando a instalação existente.
- Exibir ao final os links de publicação, visualização e comandos de status/logs.
- Documentar o comando único de instalação no manual.

## Arquivos
- Novo script `installer/install-mediamtx-ubuntu.sh`.
- Atualização da seção MediaMTX em `INSTALL.md`.

## Validação
- Validar a sintaxe Bash do instalador.
- Conferir a configuração e o serviço gerados pelo script sem alterar o servidor atual.
