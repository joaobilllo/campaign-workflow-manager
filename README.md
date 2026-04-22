# Projetinho Rodar Campanhas

Aplicacao local para:

1. Receber dados da campanha via formulario.
2. Receber contatos por CSV e/ou texto manual.
3. Validar numeros na Evolution API.
4. Enviar campanha pronta para a rota da Naty.

## Como rodar

Requisitos:

- Node.js 18+

Comandos:

```bash
npm install
npm run start
```

Abrir no navegador:

```text
http://localhost:3000
```

Paginas:

- `http://localhost:3000/integration.html` (token, URLs, instance, opcoes de validacao)
- `http://localhost:3000/campaign.html` (parametros da campanha e contatos)
- `http://localhost:3000/routes.html` (consultas de rotas auxiliares como queues/channels)
- `http://localhost:3000/logs.html` (historico de execucoes)

## Banco local (persistencia)

Agora o sistema persiste dados em banco local de arquivo JSON:

- Arquivo: `data/app-db.json`
- Itens salvos: integracoes, mensagens cadastradas e logs

APIs locais de persistencia:

- `GET/PUT /api/settings/integration`
- `GET/POST/DELETE /api/message-templates`
- `GET/POST/DELETE /api/logs`

## Campos do formulario

Configuracao:

- URL da Naty (ex.: https://api.beta.naty.app/)
- Token da Naty
- URL Evolution (ex.: http://192.168.1.16:8080)
- Instance Evolution
- API Key Evolution

Campanha:

- name
- chanellId
- queueId
- ticketStatus
- minMsgInterval
- maxMsgInterval
- messageBody

Contatos:

- Texto manual: `numero,nome` (1 por linha)
- CSV com cabecalho: `number,validated_whatsapp` (opcionalmente `name`)

## Fluxo interno

1. Junta contatos manuais e CSV.
2. Remove duplicados.
3. (Opcional) Filtra por `validated_whatsapp = true`.
4. (Opcional) Chama Evolution em:

```text
/chat/whatsappNumbers/{instance}
```

5. Monta payload:

```json
{
  "name": "...",
  "chanellId": "...",
  "queueId": "...",
  "ticketStatus": "closed",
  "minMsgInterval": 120000,
  "maxMsgInterval": 140000,
  "messages": [
    { "number": "55...", "name": "Contato", "body": "Ola" }
  ]
}
```

6. Envia para:

```text
/api/v2/messages
```

## Observacoes

- Os tokens e chaves ficam no envio do formulario e nao ficam gravados em arquivo.
- Se preferir, voce pode criar um `.env` depois para defaults internos.