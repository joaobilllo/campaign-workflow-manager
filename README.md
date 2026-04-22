# Campaign Workflow Manager

Aplicacao web para montar e enviar campanhas de mensagem a partir de contatos digitados manualmente ou importados por CSV, com suporte de validacao via Evolution API e envio para a API da Naty.

## O que este projeto faz

- Configura integracoes (Naty e Evolution) por interface web.
- Recebe contatos por texto livre e arquivo CSV.
- Remove contatos duplicados antes do envio.
- Permite validacao opcional de numeros no WhatsApp.
- Dispara campanhas para a rota de mensagens da Naty.
- Mantem historico local de templates e logs.

## Stack

- Node.js
- Express
- Front-end estatico (HTML, CSS e JavaScript)
- Persistencia local em arquivo JSON

## Como executar localmente

Pre-requisitos:

- Node.js 18 ou superior

Instalacao e execucao:

```bash
npm install
npm start
```

Acesse no navegador:

```text
http://localhost:3000
```

## Paginas da aplicacao

- /integration.html: configuracao de URLs, token, instance e parametros de validacao
- /campaign.html: configuracao da campanha e envio de contatos
- /routes.html: consulta de rotas auxiliares (queues e channels)
- /logs.html: historico de execucoes

## Persistencia local

Os dados sao salvos em:

- data/app-db.json

Colecoes persistidas:

- Configuracao de integracao
- Templates de mensagem
- Logs de execucao

Endpoints locais:

- GET e PUT /api/settings/integration
- GET, POST e DELETE /api/message-templates
- GET, POST e DELETE /api/logs

## Formato dos contatos

Entrada manual:

- Uma linha por contato no formato: numero,nome

Entrada CSV:

- Cabecalho minimo: number,validated_whatsapp
- Campo opcional: name

## Fluxo de envio

1. Consolida contatos manuais e CSV.
2. Remove duplicidades.
3. Aplica filtro opcional por validated_whatsapp.
4. Faz validacao opcional na Evolution (/chat/whatsappNumbers/{instance}).
5. Monta o payload da campanha.
6. Envia para a Naty em /api/v2/messages.

## Observacoes

- Tokens e chaves sao enviados no formulario e nao sao persistidos em arquivo local.
- A aplicacao foi desenhada para uso operacional interno, com setup simples e rapido.