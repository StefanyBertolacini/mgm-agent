// ============================================
// MGM AGENT - Processador de Indicações
// ============================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const phonenumbers = require('google-libphonenumber');

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
        pipeline: '904463895',
        deal_mgm_phone_normalized: phoneNormalized,
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

/**
 * Atualiza contato com ID do deal
 */
async function linkContactToDeal(contactId, dealId) {
  try {
    console.log(`🔗 Vinculando deal ${dealId} ao contato ${contactId}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}`;
    
    await axios.delete(url, { headers: hubspotHeaders });
    
    const associateUrl = `${HUBSPOT_API_URL}/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}`;
    
    await axios.put(associateUrl, {
      data: [
        {
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 1
        }
      ]
    }, { headers: hubspotHeaders });
    
    console.log(`✅ Deal vinculado ao contato`);
    
  } catch (err) {
    console.warn('⚠️ Aviso ao vincular deal (não crítico):', err.message);
    // Continuar mesmo se falhar
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
 * POST /api/mgm/webhook
 * Recebe webhook do HubSpot quando contato é criado/atualizado
 */
app.post('/api/mgm/webhook', async (req, res) => {
  try {
    console.log(`\n🔔 WEBHOOK RECEBIDO DO HUBSPOT`);
    console.log(`📦 Payload:`, JSON.stringify(req.body, null, 2));
    
    // HubSpot envia array de eventos
    const events = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(200).json({ status: 'ok', processed: 0 });
    }
    
    let processed = 0;
    
    for (const event of events) {
      try {
        const contactId = event.objectId;
        const propertyName = event.propertyName;
        const propertyValue = event.propertyValue;
        
        console.log(`\n📋 Evento: contactId=${contactId}, property=${propertyName}`);
        
        // Só processa se é a propriedade de phone
        if (propertyName !== 'phone' && propertyName !== 'hs_lead_status') {
          console.log(`⏭️ Ignorando propriedade: ${propertyName}`);
          continue;
        }
        
        // Buscar contato completo no HubSpot
        const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${contactId}`;
        const contactResponse = await axios.get(url, { headers: hubspotHeaders });
        const phone = contactResponse.data.properties?.phone;
        
        if (!phone) {
          console.log(`⚠️ Contato ${contactId} sem telefone`);
          continue;
        }
        
        console.log(`📞 Telefone encontrado: ${phone}`);
        
        // Normalizar telefone
        const phoneNormalized = normalizePhone(phone);
        if (!phoneNormalized) {
          console.log(`⚠️ Telefone inválido: ${phone}`);
          continue;
        }
        
        console.log(`✅ Telefone normalizado: ${phoneNormalized}`);
        
        // Buscar deal MGM
        const dealId = await linkMGMDealToSignup(phoneNormalized);
        
        if (dealId) {
          console.log(`🎉 SUCESSO! Deal MGM encontrado e será vinculado: ${dealId}`);
          // [FASE 2] Aqui você vincularia o contato ao deal
          // await associateContactToDeal(contactId, dealId);
        } else {
          console.log(`ℹ️ Nenhum deal MGM encontrado para ${phoneNormalized}`);
        }
        
        processed++;
        
      } catch (eventErr) {
        console.error(`❌ Erro ao processar evento:`, eventErr.message);
      }
    }
    
    console.log(`\n✅ Webhook processado. ${processed} evento(s) tratado(s)\n`);
    res.status(200).json({ 
      status: 'ok', 
      processed: processed,
      message: `${processed} evento(s) processado(s)`
    });
    
  } catch (err) {
    console.error(`❌ Erro no webhook:`, err.message);
    res.status(500).json({ 
      status: 'error', 
      message: err.message 
    });
  }
});

/**
 * GET /api/mgm/link-signup
 * Testa se consegue encontrar deal MGM por telefone
 */
app.get('/api/mgm/link-signup', async (req, res) => {
  const { phone, contactId } = req.query;
  
  if (!phone) {
    return res.status(400).json({
      status: 'error',
      message: 'Parâmetro "phone" obrigatório. Exemplo: /api/mgm/link-signup?phone=11987654321&contactId=123'
    });
  }
  
  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized) {
    return res.status(400).json({
      status: 'error',
      message: 'Telefone inválido'
    });
  }
  
  const dealId = await linkMGMDealToSignup(phoneNormalized);
  
  res.json({
    status: 'ok',
    phone: phoneNormalized,
    dealFound: dealId !== null,
    dealId: dealId,
    message: dealId ? 'Deal MGM encontrado!' : 'Nenhum deal MGM encontrado'
  });
});


/**
 * Vincula deal MGM a um contato que fez signup
 */
async function linkMGMDealToSignup(phoneNormalized) {
  try {
    console.log(`🔗 Buscando deal MGM para ${phoneNormalized}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/deals/search`;
    
    const response = await axios.post(url, {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'deal_mgm_phone_normalized',
              operator: 'EQ',
              value: phoneNormalized
            }
          ]
        }
      ],
      limit: 1
    }, { headers: hubspotHeaders });
    
    if (response.data.results && response.data.results.length > 0) {
      const dealId = response.data.results[0].id;
      console.log(`✅ Deal MGM encontrado: ${dealId}`);
      return dealId;
    }
    
    console.log(`ℹ️ Nenhum deal MGM encontrado`);
    return null;
    
  } catch (err) {
    console.error('⚠️ Erro ao buscar deal:', err.message);
    return null;
  }
}

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