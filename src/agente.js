// ============================================
// MGM AGENT - Processador de Indicações
// ============================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const phonenumbers = require('google-libphonenumber');

const app = express();
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
const phoneUtil = phonenumbers.PhoneNumberUtil.getInstance();

// Headers para HubSpot API
const hubspotHeaders = {
  'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
  'Content-Type': 'application/json'
};

// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json());

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Normaliza telefone para formato padrão
 * Input: "11 98765-4321" ou "+55 11 98765-4321"
 * Output: "+5511987654321"
 */
function normalizePhone(phoneRaw) {
  try {
    if (!phoneRaw) return null;
    
    const parsed = phoneUtil.parse(phoneRaw, 'BR');
    if (!phoneUtil.isValidNumber(parsed)) {
      return null;
    }
    
    return phoneUtil.format(
      parsed,
      phonenumbers.PhoneNumberFormat.E164
    );
  } catch (err) {
    console.log(`⚠️ Erro ao normalizar telefone "${phoneRaw}":`, err.message);
    return null;
  }
}

/**
 * Calcula score de confiança (sem IA, baseado em regras simples)
 */
function calculateConfidenceScore(isNew, phoneMatch) {
  if (phoneMatch === 'exact') return { score: 95, confidence: 'High' };
  if (phoneMatch === 'fuzzy') return { score: 75, confidence: 'Medium' };
  if (isNew) return { score: 100, confidence: 'High' };
  return { score: 50, confidence: 'Low' };
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
    
    console.log(`ℹ️ Nenhum contato encontrado com esse telefone`);
    return null;
    
  } catch (err) {
    console.error('❌ Erro ao buscar contato:', err.message);
    throw err;
  }
}

/**
 * Cria novo contato no HubSpot
 */
async function createContact(phoneNormalized, name) {
  try {
    console.log(`➕ Criando novo contato: ${name} (${phoneNormalized})`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts`;
    
    const response = await axios.post(url, {
      properties: {
        firstname: name || 'Unknown',
        phone: phoneNormalized,
        contact_mgm_phone_normalized: phoneNormalized,
        contact_mgm_indicator_received: 'true',
        contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
        contact_mgm_indicator_phone: phoneNormalized,
        contact_mgm_indicator_count: '1',
        contact_mgm_matching_confidence: 'High',
        lifecycleStage: 'subscriber'
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
 * Cria deal MGM
 */
async function createDeal(contactId, phoneNormalized, confidenceScore) {
  try {
    console.log(`➕ Criando deal MGM para contato: ${contactId}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/deals`;
    
    const response = await axios.post(url, {
      properties: {
        dealname: `MGM - ${phoneNormalized}`,
        pipeline: 'mgm_indications_pipeline',
        dealstage: 'indication_received',
        mgm_indication_date: new Date().toISOString().split('T')[0],
        mgm_phone_used: phoneNormalized,
        mgm_confidence_score: confidenceScore.toString()
      },
      associations: [
        {
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 1
            }
          ],
          id: contactId
        }
      ]
    }, { headers: hubspotHeaders });
    
    const dealId = response.data.id;
    console.log(`✅ Deal criado: ${dealId}`);
    return dealId;
    
  } catch (err) {
    console.error('❌ Erro ao criar deal:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Atualiza contato com ID do deal
 */
async function linkContactToDeal(contactId, dealId) {
  try {
    await updateContact(contactId, {
      contact_mgm_primary_deal_id: dealId
    });
  } catch (err) {
    console.error('⚠️ Erro ao linkar deal ao contato:', err.message);
  }
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

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
    console.log(`✅ Telefone normalizado: ${phoneNormalized}\n`);
    
    // 2. BUSCAR CONTATO EXISTENTE
    let existingContact = await searchContactByPhone(phoneNormalized);
    console.log();
    
    let contactId, action;
    let confidenceScore = 100;
    
    if (existingContact) {
      // ATUALIZAR CONTATO EXISTENTE
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
      // CRIAR NOVO CONTATO
      action = 'created';
      contactId = await createContact(phoneNormalized, name);
      confidenceScore = 100;
    }
    
    console.log();
    
    // 3. CRIAR DEAL MGM (apenas se for novo contato)
    let dealId = null;
    if (action === 'created') {
      dealId = await createDeal(contactId, phoneNormalized, confidenceScore);
      await linkContactToDeal(contactId, dealId);
    }
    
    console.log();
    console.log(`✅ SUCESSO! Indicação processada.\n`);
    
    // 4. RESPOSTA
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
    version: '1.0.0'
  });
});

/**
 * GET /
 * Homepage com informações
 */
app.get('/', (req, res) => {
  res.send(`
    <h1>🤖 MGM Agent - HubSpot</h1>
    <p>Agente de processamento de indicações MGM</p>
    
    <h2>Endpoints:</h2>
    <ul>
      <li>POST /api/mgm - Processar indicação (JSON)</li>
      <li>GET /api/mgm?phone=11987654321 - Processar indicação (Query)</li>
      <li>GET /health - Status da aplicação</li>
    </ul>
    
    <h2>Exemplo de uso:</h2>
    <p><a href="/api/mgm?phone=11987654321&name=João" target="_blank">/api/mgm?phone=11987654321&name=João</a></p>
  `);
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🤖 MGM AGENT - RUNNING                ║
║  📍 http://localhost:${PORT}            ║
╚════════════════════════════════════════╝

Endpoints:
  POST http://localhost:${PORT}/api/mgm
  GET  http://localhost:${PORT}/api/mgm?phone=11987654321

Exemplo:
  curl "http://localhost:${PORT}/api/mgm?phone=11987654321&name=João"
  `);
});