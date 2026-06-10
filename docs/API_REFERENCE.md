markdown# 🔌 API Reference - Documentação de Endpoints

Referência técnica completa de todos os endpoints do **MGM Agent**.

---

## 📋 Índice

- [Base URL](#base-url)
- [Autenticação](#autenticação)
- [Endpoints](#endpoints)
  - [POST /api/mgm](#post-apimgm)
  - [GET /api/mgm](#get-apimgm)
  - [GET /health](#get-health)
- [Modelos de Dados](#modelos-de-dados)
- [Códigos de Status HTTP](#códigos-de-status-http)
- [Exemplos de Uso](#exemplos-de-uso)

---

## 🌐 Base URL

### Local
http://localhost:3000

### Produção (Railway)
https://mgm-agent-production.up.railway.app

---

## 🔐 Autenticação

Atualmente, **não há autenticação** nos endpoints. 

**Recomendação:** Para produção, adicione verificação de token/API key.

---

## 📡 Endpoints

---

## **POST /api/mgm**

Processa uma indicação (criar ou atualizar contato no HubSpot).

### Descrição

Recebe dados de indicação, normaliza o telefone e sincroniza com HubSpot:
- Se o telefone **já existe** → Atualiza contato
- Se o telefone **não existe** → Cria novo contato

### Request

```http
POST /api/mgm HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "phone": "(11) 98765-4321",
  "name": "João Silva",
  "origin": "LinkedIn",
  "owner_id": "90532052"
}
```

### Headers

| Header | Valor | Obrigatório |
|--------|-------|------------|
| `Content-Type` | `application/json` | ✅ Sim |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-----------|-----------|---------|
| `phone` | string | ✅ Sim | Telefone do contato | `"(11) 98765-4321"` |
| `name` | string | ❌ Não | Nome do contato | `"João Silva"` |
| `origin` | string | ❌ Não | Origem da indicação | `"LinkedIn"` |
| `owner_id` | string | ❌ Não | ID do proprietário no HubSpot | `"90532052"` |

### Formatos de Telefone Aceitos

O sistema normaliza automaticamente. Você pode enviar em qualquer um desses formatos:
✅ (11) 98765-4321
✅ 11 98765-4321
✅ 11987654321
✅ 11 9 8765-4321
✅ +55 11 98765-4321
✅ +5511987654321
✅ 019 98765-4321 (com 0 inicial)

Todos são convertidos para: `+5511987654321` (E.164)

### Response - Sucesso (201)

```json
{
  "status": "success",
  "action": "created",
  "contact_id": "12345",
  "phone": "+5511987654321",
  "name": "João Silva",
  "message": "Indicação criada com sucesso!"
}
```

**ou se atualizar:**

```json
{
  "status": "success",
  "action": "updated",
  "contact_id": "12345",
  "phone": "+5511987654321",
  "name": "João Silva",
  "message": "Contato atualizado com sucesso!"
}
```

### Response - Erro (400)

```json
{
  "status": "error",
  "message": "Telefone é obrigatório",
  "phone": null
}
```

### Response - Erro HubSpot (500)

```json
{
  "status": "error",
  "message": "Erro ao criar contato: Invalid authorization header",
  "phone": "+5511987654321"
}
```

### Códigos de Status

| Status | Significado |
|--------|-----------|
| `200` | Sucesso (contato criado ou atualizado) |
| `400` | Erro na requisição (telefone inválido, falta dados) |
| `500` | Erro interno do servidor (API HubSpot falhou) |

### Exemplo cURL

```bash
curl -X POST http://localhost:3000/api/mgm \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "(11) 98765-4321",
    "name": "João Silva",
    "origin": "LinkedIn",
    "owner_id": "90532052"
  }'
```

### Exemplo JavaScript/Fetch

```javascript
const response = await fetch('http://localhost:3000/api/mgm', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone: '(11) 98765-4321',
    name: 'João Silva',
    origin: 'LinkedIn',
    owner_id: '90532052'
  })
});

const data = await response.json();
console.log(data);
```

### Exemplo Axios (Node.js)

```javascript
const axios = require('axios');

const response = await axios.post('http://localhost:3000/api/mgm', {
  phone: '(11) 98765-4321',
  name: 'João Silva',
  origin: 'LinkedIn',
  owner_id: '90532052'
});

console.log(response.data);
```

### Exemplo Python

```python
import requests

url = 'http://localhost:3000/api/mgm'
data = {
    'phone': '(11) 98765-4321',
    'name': 'João Silva',
    'origin': 'LinkedIn',
    'owner_id': '90532052'
}

response = requests.post(url, json=data)
print(response.json())
```

### O que Acontece Internamente

Recebe dados
↓
Valida telefone (não pode estar vazio)
↓
Normaliza para E.164: "(11) 98765-4321" → "+5511987654321"
↓
Busca no HubSpot se contato com esse telefone existe
↓
SE EXISTE:
└─ Atualiza propriedades (contador, origem, proprietário)
└─ Retorna action: "updated"
SE NÃO EXISTE:
└─ Cria novo contato
└─ Retorna action: "created"
└─ Automaticamente cria deal via Workflow HubSpot
↓
Retorna resposta JSON


---

## **GET /api/mgm**

Alternativa ao POST - processa indicação via query string (URL parameters).

### Descrição

Mesma funcionalidade do POST, mas usando parâmetros na URL ao invés de body JSON.

**Uso:** Testes rápidos, integração simples, webhooks.

### Request

```http
GET /api/mgm?phone=(11)98765-4321&name=Jo%C3%A3o&origin=LinkedIn&owner_id=90532052 HTTP/1.1
Host: localhost:3000
```

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-----------|-----------|
| `phone` | string | ✅ Sim | Telefone do contato |
| `name` | string | ❌ Não | Nome do contato |
| `origin` | string | ❌ Não | Origem da indicação |
| `owner_id` | string | ❌ Não | ID do proprietário HubSpot |

### Response

Idêntico ao POST (veja acima).

### Exemplo cURL

```bash
curl "http://localhost:3000/api/mgm?phone=(11)98765-4321&name=João&origin=LinkedIn&owner_id=90532052"
```

### Exemplo URL no Navegador

Você pode copiar e colar direto na barra de endereço:
http://localhost:3000/api/mgm?phone=(11)98765-4321&origin=LinkedIn&owner_id=90532052

Resultado aparece como JSON na página.

### ⚠️ Limitação

GET requests têm limite de comprimento de URL (~2000 caracteres). Para múltiplos telefones, use POST.

---

## **GET /health**

Health check - verifica se servidor está online e funcionando.

### Descrição

Endpoint simples para monitoramento e testes de conectividade.

### Request

```http
GET /health HTTP/1.1
Host: localhost:3000
```

### Response - Sucesso (200)

```json
{
  "status": "ok",
  "timestamp": "2025-06-10T10:30:45.123Z",
  "version": "1.3.0"
}
```

### Códigos de Status

| Status | Significado |
|--------|-----------|
| `200` | Servidor está online |
| `404` | Servidor respondendo, mas endpoint não encontrado |
| (timeout) | Servidor offline |

### Exemplo cURL

```bash
curl http://localhost:3000/health
```

### Exemplo JavaScript

```javascript
const response = await fetch('http://localhost:3000/health');
const data = await response.json();

if (data.status === 'ok') {
  console.log('✅ Servidor online');
} else {
  console.log('❌ Servidor com problemas');
}
```

### Uso em Monitoramento

```bash
# Verificar a cada 5 minutos
while true; do
  curl http://localhost:3000/health
  sleep 300
done
```

---

## 📊 Modelos de Dados

### Contact (Contato HubSpot)

```json
{
  "id": "12345",
  "properties": {
    "phone": "+5511987654321",
    "firstname": "João Silva",
    "contact_mgm_phone_normalized": "+5511987654321",
    "contact_mgm_indicator_received": true,
    "contact_mgm_indicator_date": "2025-06-10",
    "contact_mgm_indicator_count": 1,
    "contact__cross__source": "LinkedIn",
    "hubspot_owner_id": "90532052"
  }
}
```

### Deal (Negócio HubSpot)

```json
{
  "id": "98765",
  "properties": {
    "dealname": "MGM - +5511987654321",
    "pipeline": "904463895",
    "dealstage": "1372198928",
    "deal_mgm_phone_normalized": "+5511987654321",
    "hubspot_owner_id": "90532052"
  }
}
```

### Request Body (POST /api/mgm)

```json
{
  "phone": "(11) 98765-4321",
  "name": "João Silva",
  "origin": "LinkedIn",
  "owner_id": "90532052"
}
```

### Response Body (Sucesso)

```json
{
  "status": "success",
  "action": "created|updated",
  "contact_id": "12345",
  "phone": "+5511987654321",
  "name": "João Silva",
  "message": "Indicação criada com sucesso!"
}
```

### Response Body (Erro)

```json
{
  "status": "error",
  "message": "Descrição do erro",
  "phone": "(11) 98765-4321"
}
```

---

## 🔢 Códigos de Status HTTP

| Código | Significado | Quando Ocorre |
|--------|-----------|----------------|
| `200` | OK | Requisição bem-sucedida |
| `400` | Bad Request | Telefone inválido ou falta dados obrigatórios |
| `401` | Unauthorized | Falta autenticação (futuro) |
| `404` | Not Found | Endpoint não existe |
| `500` | Internal Server Error | Erro no servidor ou HubSpot API |
| `503` | Service Unavailable | Servidor offline ou HubSpot indisponível |

---

## 💬 Mensagens de Erro Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Telefone é obrigatório" | Não enviou `phone` | Adicione parâmetro `phone` |
| "Telefone inválido" | Formato não reconhecível | Use formato válido |
| "401 - Unauthorized" | API Key HubSpot inválida | Verifique `.env` |
| "503 - Service Unavailable" | HubSpot fora do ar | Tente depois |
| "Cannot POST /api/mgm" | Servidor não iniciou | Execute `npm start` |

---

## 📝 Exemplos de Uso Completos

### Cenário 1: Processar Uma Indicação

```javascript
// Enviar indicação
const indicacao = {
  phone: "(11) 98765-4321",
  name: "João Silva",
  origin: "LinkedIn",
  owner_id: "90532052"
};

const response = await fetch('http://localhost:3000/api/mgm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(indicacao)
});

const resultado = await response.json();

if (resultado.status === 'success') {
  console.log(`✅ Contato ${resultado.action}: ${resultado.contact_id}`);
} else {
  console.error(`❌ Erro: ${resultado.message}`);
}
```

### Cenário 2: Processar Múltiplas Indicações em Lote

```javascript
const telefones = [
  { phone: "(11) 98765-4321", name: "João" },
  { phone: "(21) 99999-8888", name: "Maria" },
  { phone: "(85) 98765-0000", name: "Pedro" }
];

const resultados = [];

for (const tel of telefones) {
  const response = await fetch('http://localhost:3000/api/mgm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...tel,
      origin: "LinkedIn",
      owner_id: "90532052"
    })
  });

  const resultado = await response.json();
  resultados.push(resultado);
}

console.log(`Processados: ${resultados.length} indicações`);
console.log(`Sucesso: ${resultados.filter(r => r.status === 'success').length}`);
```

### Cenário 3: Rotação de Proprietários

```javascript
const telefones = ["(11) 98765-4321", "(21) 99999-8888", "(85) 98765-0000"];
const proprietarios = ["90532052", "76004206", "741522075"]; // Stefany, Victor, Mariana

for (let i = 0; i < telefones.length; i++) {
  const owner = proprietarios[i % proprietarios.length]; // Rotaciona
  
  const response = await fetch('http://localhost:3000/api/mgm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: telefones[i],
      origin: "LinkedIn",
      owner_id: owner
    })
  });

  const resultado = await response.json();
  console.log(`${telefones[i]} → ${owner}: ${resultado.action}`);
}
```

### Cenário 4: Integração com Formulário HTML

```html
<form id="mgmForm">
  <input type="tel" id="phone" placeholder="Telefone" required>
  <input type="text" id="name" placeholder="Nome (opcional)">
  <select id="owner" required>
    <option value="90532052">Stefany Bertolacini</option>
    <option value="76004206">Victor Campioni</option>
  </select>
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById('mgmForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const response = await fetch('/api/mgm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: document.getElementById('phone').value,
      name: document.getElementById('name').value,
      owner_id: document.getElementById('owner').value,
      origin: "Web Form"
    })
  });

  const resultado = await response.json();
  alert(resultado.message);
});
</script>
```

### Cenário 5: Tratamento de Erros

```javascript
try {
  const response = await fetch('http://localhost:3000/api/mgm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: "(11) 98765-4321",
      owner_id: "90532052"
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const resultado = await response.json();

  if (resultado.status === 'success') {
    console.log(`✅ ${resultado.action}: ${resultado.contact_id}`);
  } else {
    console.error(`❌ ${resultado.message}`);
  }

} catch (error) {
  console.error('Erro ao processar:', error.message);
  // Aqui você pode retry, alertar usuário, etc
}
```

---

## 🔄 Fluxo de Requisição Completo

CLIENT (Navegador/Script)
↓
POST /api/mgm
Content-Type: application/json
{ phone, name, origin, owner_id }
SERVER (Node.js)
↓
if (!phone) return 400 error
↓
normalizePhone(phone) → "+5511987654321"
↓
findContact("+5511987654321")
└─ POST api.hubspot.com/search
HUBSPOT
↓
if (existe) updateContact(...) else createContact(...)
└─ POST/PATCH api.hubspot.com/objects/contacts
WORKFLOWS (Automático)
↓
Workflow 1: Cria deal
Workflow 2: Associa duplicados
CLIENT
↓
HTTP 200 OK
{ status, action, contact_id, ... }
DISPLAY
↓
✅ Criado / ❌ Erro


---

## 📊 Rate Limits

### HubSpot API
100 requests por 10 segundos

Se exceder:
- Aguarde 10 segundos
- Ou implemente fila com `bullmq`

### MGM Agent
Sem limitação implementada (pode adicionar em produção)

---

## 🔒 Segurança

### Dados Sensíveis

**Nunca envie em logs:**
- API Keys
- Tokens
- Senhas

**Atual:** Arquivo `.env` já está ignorado do Git

### Para Produção

Considere adicionar:
- ✅ Rate limiting
- ✅ Autenticação (JWT / OAuth)
- ✅ Validação de entrada rigorosa
- ✅ HTTPS obrigatório
- ✅ CORS restritivo

---

## 📚 Referências

- [HubSpot CRM API Docs](https://developers.hubspot.com/docs/crm/apis/crm-api)
- [HTTP Status Codes](https://httpwg.org/specs/rfc9110.html#status.codes)
- [E.164 Phone Format](https://en.wikipedia.org/wiki/E.164)
- [REST API Best Practices](https://restfulapi.net/)

---

## ❓ FAQ

### P: Posso chamar a API de um navegador de outro computador?
**R:** Sim! Use a URL de produção. Localmente use localhost apenas na mesma máquina.

### P: O que acontece se enviar um telefone que já existe?
**R:** O contato é **atualizado** (action: "updated"), não duplicado.

### P: Preciso de autenticação?
**R:** Atualmente não. Para produção, recomenda-se adicionar.

### P: Qual é o máximo de telefones por requisição?
**R:** GET tem limite de URL (~2000 char). POST não tem limite prático.

### P: Os dados são salvos em algum lugar?
**R:** Todos os dados vão para HubSpot CRM. MGM Agent não persiste dados.

---

## 🚀 Próximas Etapas

- Leia [SETUP_LOCAL.md](SETUP_LOCAL.md) para instalar localmente
- Veja [TROUBLESHOOTING.md](TROUBLESHOOTING.md) se tiver erros
- Consulte [ARQUITETURA.md](ARQUITETURA.md) para entender internamente