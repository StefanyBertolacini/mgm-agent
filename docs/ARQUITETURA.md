# 🏗️ Arquitetura do MGM Agent

Explicação técnica de como o sistema funciona.

---

## 📐 Diagrama Geral do Sistema
┌──────────────────────────────────────────────────────────────────┐
│                          USUÁRIO FINAL                           │
│                    (Vendedor na Capim)                           │
└──────────────────────────┬───────────────────────────────────────┘
│
Acessa no navegador
│
▼
┌──────────────────────────────────────────────────────────────────┐
│                       FRONTEND (app.html)                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  📱 Formulário Web (Interface Bonita)                      │  │
│  │  • Campo de telefones (textarea)                           │  │
│  │  • Campo de origem (input)                                │  │
│  │  • Seleção de proprietário (select + checkboxes)         │  │
│  │  • Botões: Processar, Limpar                             │  │
│  │  • Exibição de resultados (✅ Criado / ❌ Erro)          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  JavaScript envia dados via HTTP POST                            │
└──────────────────────────┬───────────────────────────────────────┘
│
POST /api/mgm
Content-Type: JSON
│
▼
┌──────────────────────────────────────────────────────────────────┐
│                 BACKEND (agente.js - Node.js)                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1️⃣ RECEBER DADOS                                          │  │
│  │    {                                                       │  │
│  │      "phone": "(11) 98765-4321",                           │  │
│  │      "name": "João Silva",                                │  │
│  │      "origin": "LinkedIn",                                │  │
│  │      "owner_id": "90532052"                               │  │
│  │    }                                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                  Passa para processamento                         │
│                           │                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 2️⃣ NORMALIZAR TELEFONE                                    │  │
│  │    "(11) 98765-4321" → "+5511987654321" (E.164)          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│          Verifica se contato já existe                            │
│                           │                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 3️⃣ BUSCAR NO HUBSPOT                                      │  │
│  │    GET /crm/v3/objects/contacts/search                    │  │
│  │    Filtra por: phone = "+5511987654321"                   │  │
│  │                                                            │  │
│  │    Resposta: Contato encontrado? SIM / NÃO               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│              ┌────────────┴────────────┐                          │
│              │                         │                          │
│         NÃO EXISTE              EXISTE                            │
│              │                         │                          │
│              ▼                         ▼                          │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ 4A️⃣ CRIAR CONTATO   │  │ 4B️⃣ ATUALIZAR      │               │
│  │                     │  │                     │               │
│  │ POST /crm/v3/...    │  │ PATCH /crm/v3/...   │               │
│  │                     │  │                     │               │
│  │ Propriedades:       │  │ Propriedades:       │               │
│  │ • phone             │  │ • counter +1        │               │
│  │ • firstname         │  │ • date (hoje)       │               │
│  │ • origin            │  │ • origin            │               │
│  │ • owner_id          │  │ • owner_id          │               │
│  └─────────────────────┘  └─────────────────────┘               │
│              │                         │                          │
│              └────────────┬────────────┘                          │
│                           │                                       │
│                  Retorna contact_id                               │
│                           │                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 5️⃣ CRIAR DEAL (Automático)                                │  │
│  │    POST /crm/v3/objects/deals                             │  │
│  │    Associa contato ao deal                                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                  Retorna resposta JSON                            │
└──────────────────────────┬───────────────────────────────────────┘
│
HTTP 200 OK
{ status, action, id }
│
▼
┌──────────────────────────────────────────────────────────────────┐
│              HUBSPOT WORKFLOWS (Automático)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Workflow 1: "[MGM] Deal Creation"                         │  │
│  │ • Trigger: Novo contato com propriedade MGM criado        │  │
│  │ • Ação: Cria deal no pipeline MGM                         │  │
│  │ • Resultado: Deal pronto em "Novo negócio"               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Workflow 2: "[MGM] Associate Contacts"                    │  │
│  │ • Trigger: Contato duplicado detectado                    │  │
│  │ • Ação: Associa contato ao deal anterior                 │  │
│  │ • Resultado: Evita duplicação de deals                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
│
HubSpot sincroniza dados
│
▼
┌──────────────────────────────────────────────────────────────────┐
│              HUBSPOT CRM (Banco de Dados)                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 👤 CONTATO                                                │  │
│  │ • ID: 12345                                               │  │
│  │ • phone: +5511987654321                                   │  │
│  │ • firstname: João Silva                                   │  │
│  │ • contact_mgm_phone_normalized: +5511987654321            │  │
│  │ • contact_mgm_indicator_date: 2025-06-10                 │  │
│  │ • contact_mgm_indicator_received: true                    │  │
│  │ • contact__cross__source: LinkedIn                        │  │
│  │ • hubspot_owner_id: 90532052                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                    Associado a:                                   │
│                           │                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📊 DEAL                                                    │  │
│  │ • ID: 98765                                               │  │
│  │ • dealname: MGM - +5511987654321                          │  │
│  │ • pipeline: 904463895 (MGM Pipeline)                      │  │
│  │ • dealstage: 1372198928 (Novo negócio)                    │  │
│  │ • hubspot_owner_id: 90532052                              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
│
Vendedor vê no CRM
│
▼
✅ PRONTO PARA VENDER!

---

## 🎯 Fluxo Passo-a-Passo (Detalhado)

### **Passo 1: Usuário Preenche Formulário**

```javascript
// O formulário coleta:
{
  phones: "(11) 98765-4321\n(21) 99999-8888",
  origin: "LinkedIn",
  owner: "Stefany Bertolacini",
  mode: "single" // ou "multiple" para rotação
}
```

**O que acontece:**
- Usuário abre http://localhost:3000
- Vê formulário bonito com branding Capim
- Preenche telefones (um por linha, com ou sem nome)
- Seleciona origem
- Escolhe proprietário
- Clica "Processar"

---

### **Passo 2: JavaScript Envia Requisição**

```javascript
// app.html (linha ~800)

// Para cada telefone:
const response = await fetch('/api/mgm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: "(11) 98765-4321",
    name: "João Silva",           // opcional
    origin: "LinkedIn",
    owner_id: "90532052"          // ID do Stefany
  })
});

const result = await response.json();
```

**O que é enviado:**
- URL: `POST http://localhost:3000/api/mgm`
- Headers: `Content-Type: application/json`
- Body: JSON com phone, name, origin, owner_id

---

### **Passo 3: Backend Recebe em agente.js**

```javascript
// agente.js (linha ~250)

app.post('/api/mgm', async (req, res) => {
  const { phone, name, origin, owner_id } = req.body;
  
  // Valida
  if (!phone) return res.status(400).json({ error: '...' });
  
  // Normaliza
  const normalizedPhone = normalizePhone(phone);
  // "(11) 98765-4321" → "+5511987654321"
  
  // Busca no HubSpot
  const existing = await findContact(normalizedPhone);
  
  if (existing) {
    // Atualiza contato existente
    result = await updateContact(existing.id, origin, owner_id);
  } else {
    // Cria novo contato
    result = await createContact(normalizedPhone, name, origin, owner_id);
  }
  
  // Retorna resultado
  return res.json(result);
});
```

**O que acontece:**
1. Recebe dados do formulário
2. Valida se telefone existe
3. Normaliza para E.164: `+55 11 98765-4321` → `+5511987654321`
4. Busca no HubSpot se contato com esse telefone já existe
5. Se existe → atualiza | Se não → cria

---

### **Passo 4: Normalização de Telefone**

```javascript
// agente.js (linha ~30)

function normalizePhone(phoneRaw) {
  let cleaned = phoneRaw.replace(/\D/g, ''); // Remove tudo que não é número
  // "(11) 98765-4321" → "11987654321"
  
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1); // Remove 0 inicial (padrão BR)
  }
  
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned; // Adiciona código país
  }
  // "11987654321" → "5511987654321"
  
  return '+' + cleaned; // "+5511987654321"
}
```

**Exemplo real:**
Entrada: "(11) 9 8765-4321"
↓
Passo 1 (remove não-numéricos): "11987654321"
↓
Passo 2 (remove 0 inicial): "11987654321"
↓
Passo 3 (adiciona país): "5511987654321"
↓
Saída: "+5511987654321" (E.164)

---

### **Passo 5: Buscar Contato no HubSpot**

```javascript
// agente.js (linha ~50)

async function findContact(normalizedPhone) {
  const response = await axios.post(
    'https://api.hubapi.com/crm/v3/objects/contacts/search',
    {
      filterGroups: [{
        filters: [{
          propertyName: 'phone',          // Campo padrão do HubSpot
          operator: 'EQ',                  // Igualdade
          value: normalizedPhone           // "+5511987654321"
        }]
      }],
      limit: 1
    },
    { headers: hubspotHeaders }
  );
  
  return response.data.results.length > 0 
    ? response.data.results[0]  // Contato encontrado
    : null;                      // Não encontrou
}
```

**O que acontece:**
- Faz requisição POST na HubSpot API
- Busca contato com `phone = "+5511987654321"`
- Se encontrar 1+ contatos → retorna o primeiro
- Se não encontrar → retorna `null`

---

### **Passo 6A: CRIAR Novo Contato**

```javascript
// agente.js (linha ~70)

async function createContact(normalizedPhone, name, origin, ownerId) {
  const response = await axios.post(
    'https://api.hubapi.com/crm/v3/objects/contacts',
    {
      properties: {
        phone: normalizedPhone,                      // "+5511987654321"
        firstname: name || 'Contato MGM',           // "João Silva"
        contact_mgm_phone_normalized: normalizedPhone,
        contact_mgm_indicator_received: 'true',
        contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
        contact__cross__source: origin || 'MGM',    // "LinkedIn"
        hubspot_owner_id: ownerId                    // "90532052"
      }
    },
    { headers: hubspotHeaders }
  );
  
  return {
    contact_id: response.data.id,
    action: 'created',
    status: 'success'
  };
}
```

**Resultado no HubSpot:**
📝 Novo Contato Criado
├─ Nome: João Silva
├─ Telefone: +5511987654321
├─ Origem: LinkedIn
├─ Proprietário: Stefany Bertolacini
└─ Data de indicação: 2025-06-10
🤖 Workflow dispara automaticamente:
└─ Cria deal no pipeline MGM

---

### **Passo 6B: ATUALIZAR Contato Existente**

```javascript
// agente.js (linha ~95)

async function updateContact(contactId, origin, ownerId) {
  const response = await axios.patch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
    {
      properties: {
        contact_mgm_indicator_count: '1',           // Incrementa contador
        contact__cross__source: origin || 'MGM',
        hubspot_owner_id: ownerId
      }
    },
    { headers: hubspotHeaders }
  );
  
  return {
    contact_id: response.data.id,
    action: 'updated',
    status: 'success'
  };
}
```

**Resultado no HubSpot:**
📝 Contato Atualizado
├─ Contato já existia (ID 12345)
├─ Contador de indicações: +1
├─ Última origem: LinkedIn
└─ Data atualizada: 2025-06-10
🤖 Workflow dispara automaticamente:
└─ Associa contato ao deal anterior

---

### **Passo 7: Resposta Retorna Pro Frontend**

```javascript
// Resposta da API:
{
  status: 'success',
  action: 'created',        // ou 'updated'
  contact_id: '12345',
  phone: '+5511987654321',
  name: 'João Silva',
  message: 'Indicação criada com sucesso!'
}
```

**O que o usuário vê:**
✅ +5511987654321 (João Silva)
✓ Criado | ID: 12345
Indicação criada com sucesso!

---

## 🔌 Integração com HubSpot

### **Propriedades Customizadas (MGM)**

Seu contato no HubSpot tem essas propriedades especiais:

| Propriedade | Tipo | Exemplo | Uso |
|------------|------|---------|-----|
| `contact_mgm_phone_normalized` | Text | +5511987654321 | Busca de duplicados |
| `contact_mgm_indicator_received` | Checkbox | true | Indica se é indicação |
| `contact_mgm_indicator_date` | Date | 2025-06-10 | Quando foi indicado |
| `contact_mgm_indicator_count` | Number | 3 | Quantas indicações recebeu |
| `contact__cross__source` | Text | LinkedIn | Onde veio a indicação |
| `hubspot_owner_id` | Number | 90532052 | Proprietário do contato |

### **Workflows Automáticos**

#### **Workflow 1: [MGM] Deal Creation**
Trigger: Novo contato criado com
"contact_mgm_indicator_received" = true
Ação: 1. Ramificação: "Tem negócio aberto em vendas?"
2. Se SIM: Associar ao deal existente
3. Se NÃO: Criar novo deal
Resultado: Deal em "Novo negócio" pronto pro vendedor

#### **Workflow 2: [MGM] Associate Contacts**
Trigger: Novo contato criado com mesmo telefone que outro
Ação: 1. Encontrar contato anterior
2. Encontrar deal anterior
3. Criar associação contato ↔ deal
Resultado: Duplicados unidos, sem deals duplicados

---

## 📊 Stack Tecnológico

### **Frontend**
- **HTML5** - Estrutura semântica
- **CSS3** - Design com gradientes e animações
- **JavaScript Vanilla** - Sem frameworks, executado no navegador
- **Branding Capim** - Cores roxo (#8D57F6) e verde (#D9F363)

### **Backend**
- **Node.js** - Runtime JavaScript no servidor
- **Express.js** - Framework web leve
- **Axios** - HTTP client para chamadas à API HubSpot
- **dotenv** - Gerenciamento de variáveis de ambiente

### **Banco de Dados**
- **HubSpot CRM** - Banco de dados via API REST
- **API HubSpot v3** - Endpoints `/crm/v3/objects/contacts`

### **Deploy**
- **Railway.com** - Hospedagem de Node.js
- **GitHub** - Versionamento de código
- **CI/CD** - Deploy automático a cada push

---

## 🔐 Variáveis de Ambiente

Arquivo `.env`:
```bash
PORT=3000                              # Porta do servidor
HUBSPOT_API_KEY=pat-na1-xxxxx...       # Token de autenticação HubSpot
NODE_ENV=development                   # ou production
```

---

## 🚀 Fluxo de Requisição HTTP Completo

FRONTEND (Browser)
│
└─ POST /api/mgm
└─ Headers: Content-Type: application/json
└─ Body: { phone, name, origin, owner_id }
│
▼
BACKEND (Node.js)
│
├─ Normaliza telefone
├─ Busca em HubSpot
│  └─ POST https://api.hubapi.com/crm/v3/objects/contacts/search
│
├─ SE NÃO EXISTE:
│  └─ POST https://api.hubapi.com/crm/v3/objects/contacts
│
├─ SE EXISTE:
│  └─ PATCH https://api.hubapi.com/crm/v3/objects/contacts/{id}
│
└─ Retorna resposta JSON
│
▼
HUBSPOT
│
├─ Armazena contato/atualiza propriedades
├─ Dispara Workflow 1 (Deal Creation)
├─ Dispara Workflow 2 (Associate Contacts)
│
└─ Sincroniza dados
│
▼
FRONTEND (Browser)
│
└─ Exibe resultado na interface
✅ Criado / ❌ Erro


---

## 💡 Por que essa arquitetura?

| Decisão | Benefício |
|---------|-----------|
| Frontend simples (sem framework) | ⚡ Rápido, sem dependências |
| Backend Node.js | 🟢 Mesmo linguagem (JavaScript) |
| HubSpot como banco | 📊 Dados centralizados com CRM |
| Workflows HubSpot | 🤖 Automação sem código extra |
| Deploy Railway | 🚀 Fácil, com CI/CD automático |

---

## 🔄 Escalabilidade

**Pode processar:**
- ✅ 1-10 telefones: Instantâneo
- ✅ 11-100 telefones: ~10 segundos
- ✅ 100+ telefones: Considere batch processing

**Limitações HubSpot:**
- Rate limit: 100 req/10s
- Para volumes muito altos: Implementar fila com `bullmq`

---

## 🐛 Pontos de Falha Possíveis

| Ponto | Causa | Solução |
|------|-------|--------|
| API Key inválida | `.env` mal preenchido | Verificar no HubSpot |
| Telefone mal formatado | Usuário digitou errado | Sistema normaliza |
| Contato duplicado no HubSpot | Mesmo telefone, contatos diferentes | Workflow associa |
| Workflow não dispara | Workflow desligado | Ligar no HubSpot |
| Servidor offline | Railway caiu | Verificar status |

Veja [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para mais detalhes.

---

## 📚 Referências

- [HubSpot CRM API](https://developers.hubspot.com/docs/crm/apis/crm-api)
- [Express.js Docs](https://expressjs.com/)
- [E.164 Phone Format](https://en.wikipedia.org/wiki/E.164)