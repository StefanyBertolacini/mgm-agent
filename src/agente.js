// ============================================
// MGM AGENT - Processador de Indicações
// ============================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURAÇÕES
// ============================================

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_ACCOUNT_ID = process.env.HUBSPOT_ACCOUNT_ID;

if (!HUBSPOT_API_KEY) {
  console.error('❌ ERRO: HUBSPOT_API_KEY não configurada em .env');
  process.exit(1);
}

const HUBSPOT_API_URL = 'https://api.hubapi.com';

// Headers para HubSpot API
const hubspotHeaders = {
  'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
  'Content-Type': 'application/json'
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Normaliza telefone para formato padrão
 * Input: "11 98765-4321", "+55 11 98765-4321", "554799999999"
 * Output: "+5554799999999" ou "11987654321"
 */
function normalizePhone(phoneRaw) {
  if (!phoneRaw) return null;
  
  try {
    // Remove TUDO exceto números e +
    let cleaned = phoneRaw.replace(/[^\d+]/g, '');
    
    // Remove o + se existir (para padronização)
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    
    // Se começar com 0, remove (comum em formatação brasileira)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Se não tem código de país (55 para Brasil), adiciona
    if (!cleaned.startsWith('55')) {
      // Assumindo Brasil como padrão
      if (cleaned.length === 11 || cleaned.length === 10) {
        cleaned = '55' + cleaned;
      }
    }
    
    // Formata em E.164
    const normalized = '+' + cleaned;
    
    console.log(`✅ Telefone normalizado: ${phoneRaw} → ${normalized}`);
    return normalized;
    
  } catch (err) {
    console.error(`⚠️ Erro ao normalizar: ${phoneRaw}`, err.message);
    return null;
  }
}

/**
 * Busca contato no HubSpot por telefone
 */
async function searchContactByPhone(phoneNormalized) {
  try {
    console.log(`🔍 Buscando contato com telefone: ${phoneNormalized}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`;
    
    const response = await axios.post(url, {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'phone',
              operator: 'EQ',
              value: phoneNormalized
            }
          ]
        }
      ],
      limit: 10
    }, { headers: hubspotHeaders });
    
    if (response.data.results && response.data.results.length > 0) {
      console.log(`✅ Contato encontrado: ${response.data.results[0].id}`);
      return response.data.results[0];
    }
    
    console.log(`ℹ️ Nenhum contato encontrado`);
    return null;
    
  } catch (err) {
    console.error('❌ Erro ao buscar contato:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Cria novo contato no HubSpot
 */
async function createContact(phoneNormalized, name) {
  try {
    console.log(`➕ Criando novo contato: ${name || 'sem nome'} (${phoneNormalized})`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts`;
    
    const response = await axios.post(url, {
      properties: {
        firstname: name || `Indicação MGM - ${phoneNormalized}`,
        phone: phoneNormalized,
        contact_mgm_phone_normalized: phoneNormalized,
        contact_mgm_indicator_received: 'true',
        contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
        contact_mgm_indicator_phone: 'true',
        contact_mgm_indicator_count: '1',
        contact_mgm_matching_confidence: 'High',
      }
    }, { headers: hubspotHeaders });
    
    const contactId = response.data.id;
    console.log(`✅ Contato criado: ${contactId}`);
    return contactId;
    
  } catch (err) {
    console.error('❌ Erro ao criar contato:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Atualiza contato existente
 */
async function updateContact(contactId, properties) {
  try {
    console.log(`✏️ Atualizando contato: ${contactId}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${contactId}`;
    
    await axios.patch(url, {
      properties: properties
    }, { headers: hubspotHeaders });
    
    console.log(`✅ Contato atualizado`);
    
  } catch (err) {
    console.error('❌ Erro ao atualizar contato:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Cria deal MGM no pipeline
 */
async function createDeal(contactId, phoneNormalized) {
  try {
    console.log(`➕ Criando deal MGM para contato: ${contactId}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/deals`;
    
    const response = await axios.post(url, {
      properties: {
        dealname: `MGM - ${phoneNormalized}`,
        pipeline: '904463895',
        mgm_phone_normalized: phoneNormalized,
        dealstage: '1372198928'
      }
    }, { headers: hubspotHeaders });
    
    const dealId = response.data.id;
    console.log(`✅ Deal criado: ${dealId}`);
    return dealId;
    
  } catch (err) {
    console.error('❌ Erro ao criar deal:', err.response?.data || err.message);
    throw err;
  }
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

/**
 * Processa indicação: cria contato e deal
 */
async function processarIndicacao(phoneRaw, name = null) {
  try {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 PROCESSANDO INDICAÇÃO: ${phoneRaw}`);
    console.log(`${'='.repeat(50)}\n`);
    
    // 1. VALIDAR E NORMALIZAR TELEFONE
    const phoneNormalized = normalizePhone(phoneRaw);
    if (!phoneNormalized) {
      return {
        status: 'error',
        message: 'Telefone inválido ou formato incorreto',
        phone: phoneRaw
      };
    }
    console.log();
    
    // 2. BUSCAR CONTATO EXISTENTE
    let existingContact = await searchContactByPhone(phoneNormalized);
    console.log();
    
    let contactId, action;
    let dealId = null;
    let confidenceScore = 100;
    
    if (existingContact) {
      // CONTATO JÁ EXISTE - APENAS ATUALIZAR
      action = 'updated';
      contactId = existingContact.id;
      
      const currentCount = parseInt(
        existingContact.properties.contact_mgm_indicator_count || 0
      );
      
      await updateContact(contactId, {
        contact_mgm_indicator_received: 'true',
        contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
        contact_mgm_indicator_count: (currentCount + 1).toString(),
        contact_mgm_matching_confidence: 'High'
      });
      
      confidenceScore = 85;
      
    } else {
      // CONTATO NOVO - CRIAR CONTATO + DEAL
      action = 'created';
      contactId = await createContact(phoneNormalized, name);
      console.log();
      dealId = await createDeal(contactId, phoneNormalized);
      confidenceScore = 100;
    }
    
    console.log();
    console.log(`✅ SUCESSO! Indicação processada.\n`);
    
    // RESPOSTA
    return {
      status: 'success',
      action: action,
      contact_id: contactId,
      deal_id: dealId,
      phone: phoneNormalized,
      confidence_score: confidenceScore,
      message: `Indicação ${action === 'created' ? 'criada' : 'atualizada'} com sucesso!`
    };
    
  } catch (error) {
    console.error(`\n❌ ERRO:`, error.message);
    return {
      status: 'error',
      message: error.message,
      phone: phoneRaw
    };
  }
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * POST /api/mgm
 * Processar indicação via JSON
 */
app.post('/api/mgm', async (req, res) => {
  const { phone, name } = req.body;
  
  if (!phone) {
    return res.status(400).json({
      status: 'error',
      message: 'Campo "phone" obrigatório. Exemplo: {"phone": "11 98765-4321"}'
    });
  }
  
  const result = await processarIndicacao(phone, name);
  res.json(result);
});

/**
 * GET /api/mgm
 * Processar indicação via query string (para testes rápidos)
 */
app.get('/api/mgm', async (req, res) => {
  const { phone, name } = req.query;
  
  if (!phone) {
    return res.status(400).json({
      status: 'error',
      message: 'Parâmetro "phone" obrigatório. Exemplo: /api/mgm?phone=11987654321&name=João'
    });
  }
  
  const result = await processarIndicacao(phone, name);
  res.json(result);
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.2.0'
  });
});

/**
 * GET /
 * Homepage com informações
 */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>MGM Agent</title>
      <style>
        body { font-family: Arial; margin: 40px; background: #f5f5f5; }
        h1 { color: #667eea; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
        ul { line-height: 1.8; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 MGM Agent - HubSpot</h1>
        <p><strong>Versão:</strong> 1.2.0</p>
        <p><strong>Status:</strong> ✅ Online</p>
        
        <h2>📡 Endpoints:</h2>
        <ul>
          <li><code>POST /api/mgm</code> - Processar indicação (JSON)</li>
          <li><code>GET /api/mgm?phone=11987654321</code> - Processar indicação (Query)</li>
          <li><code>GET /health</code> - Status da aplicação</li>
        </ul>
        
        <h2>🔄 Fluxo:</h2>
        <ol>
          <li>Cliente envia telefone via web ou API</li>
          <li>Sistema normaliza e valida telefone</li>
          <li>Busca contato existente no HubSpot</li>
          <li>Se novo → cria contato + deal no pipeline MGM</li>
          <li>Se existe → atualiza propriedades MGM</li>
        </ol>
        
        <h2>📊 Properties Preenchidas:</h2>
        <ul>
          <li>contact_mgm_phone_normalized</li>
          <li>contact_mgm_indicator_received</li>
          <li>contact_mgm_indicator_date</li>
          <li>contact_mgm_indicator_count</li>
          <li>contact_mgm_matching_confidence</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🤖 MGM AGENT v1.2.0 - RUNNING         ║
║  📍 http://localhost:${PORT}            ║
╚════════════════════════════════════════╝

Endpoints:
  POST http://localhost:${PORT}/api/mgm
  GET  http://localhost:${PORT}/api/mgm?phone=11987654321&name=João

Exemplo:
  curl "http://localhost:${PORT}/api/mgm?phone=11987654321&name=João Silva"
  `);
});