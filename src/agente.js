// ============================================
// MGM AGENT - Processador de Indicações (CORRIGIDO)
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
// MIDDLEWARE
// ============================================

app.use(express.json());

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Normaliza telefone para formato padrão E.164
 * Input: "11 98765-4321", "+55 11 98765-4321", "554799999999"
 * Output: "+5554799999999"
 */
function normalizePhone(phoneRaw) {
  if (!phoneRaw) return null;
  
  try {
   // Remove TUDO exceto números
   let cleaned = phoneRaw.replace(/\D/g, '');
    
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
      if (cleaned.length === 11) {
        // Telefone brasileiro sem código país
        cleaned = '55' + cleaned;
      } else if (cleaned.length === 10) {
        // Telefone brasileiro antigo
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
async function searchContactByPhone(phoneNormalized, propertyName = 'phone') {
  try {
    console.log(`🔍 Buscando contato com ${propertyName}: ${phoneNormalized}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`;
    
    const response = await axios.post(url, {
      filterGroups: [
        {
          filters: [
            {
              propertyName: propertyName,
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
    console.log(`➕ Criando novo contato: ${name} (${phoneNormalized})`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts`;
    
    const response = await axios.post(url, {
      properties: {
        firstname: name || `Indicação MGM - ${phoneNormalized}`,
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
 * ⭐ ASSOCIA DOIS CONTATOS NO HUBSPOT
 */
async function associateContacts(contactId1, contactId2) {
  try {
    console.log(`🔗 Associando contatos: ${contactId1} ↔ ${contactId2}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${contactId1}/associations/contacts/${contactId2}`;
    
    const response = await axios.put(url, 
      [
        {
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 1  // Related contact
        }
      ], 
      { headers: hubspotHeaders }
    );
    
    console.log(`✅ Contatos associados com sucesso!`);
    return true;
    
  } catch (err) {
    console.error('❌ Erro ao associar contatos:', err.response?.data || err.message);
    return false;
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

/**
 * ⭐ VINCULA CONTATO DE SIGNUP AO CONTATO MGM (CORRIGIDO)
 */
async function linkMGMContactToSignup(phoneNormalized, signupContactId) {
  try {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔗 BUSCANDO CONTATO MGM PARA ASSOCIAR`);
    console.log(`${'='.repeat(50)}\n`);
    
    console.log(`📞 Telefone normalizado: ${phoneNormalized}`);
    console.log(`👤 Contato Signup ID: ${signupContactId}\n`);
    
    // 1. BUSCAR CONTATO A (criado via indicação MGM)
    const mgmContact = await searchContactByPhone(
      phoneNormalized, 
      'contact_mgm_phone_normalized'
    );
    
    console.log();
    
    if (!mgmContact) {
      console.log(`⚠️ Nenhum contato MGM encontrado para ${phoneNormalized}`);
      return { found: false, message: 'Contato MGM não encontrado' };
    }
    
    const mgmContactId = mgmContact.id;
    console.log(`✅ Contato MGM encontrado: ${mgmContactId}`);
    console.log();
    
    // 2. ASSOCIAR CONTATO B (signup) AO CONTATO A (MGM)
    const associated = await associateContacts(mgmContactId, signupContactId);
    
    if (!associated) {
      return { 
        found: true, 
        mgmContactId, 
        signupContactId,
        associated: false,
        message: 'Contato MGM encontrado mas associação falhou'
      };
    }
    
    console.log();
    
    // 3. MARCAR CONTATO B (signup) COM PROPRIEDADES MGM
    try {
      console.log(`📝 Marcando contato ${signupContactId} como signup confirmado`);
      
      await updateContact(signupContactId, {
        contact_mgm_phone_normalized: phoneNormalized,
        contact_mgm_signup_confirmed: 'true',
        contact_mgm_signup_date: new Date().toISOString().split('T')[0],
        contact_mgm_associated_to: mgmContactId
      });
      
      console.log(`✅ Contato de signup marcado com sucesso!`);
      console.log();
      
    } catch (updateErr) {
      console.warn('⚠️ Aviso ao marcar contato:', updateErr.message);
    }
    
    console.log(`🎉 SUCESSO! Contatos associados!\n`);
    
    return {
      found: true,
      mgmContactId: mgmContactId,
      signupContactId: signupContactId,
      associated: true,
      message: 'Contatos associados com sucesso!'
    };
    
  } catch (err) {
    console.error('❌ Erro ao buscar/associar contato MGM:', err.message);
    return { 
      found: false, 
      message: err.message 
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
    
    // O HubSpot envia: { hs_object_id: "...", phone: "..." }
    const { hs_object_id, phone } = req.body;
    
    if (!hs_object_id || !phone) {
      console.log(`⚠️ Dados incompletos no webhook`);
      return res.status(200).json({ status: 'ok', processed: 0, message: 'Dados incompletos' });
    }
    
    const contactId = hs_object_id;
    const phoneRaw = phone;
    
    console.log(`\n📋 Contato Signup ID: ${contactId}, Telefone: ${phoneRaw}`);
    
    // Normalizar telefone
    const phoneNormalized = normalizePhone(phoneRaw);
    if (!phoneNormalized) {
      console.log(`⚠️ Telefone inválido: ${phoneRaw}`);
      return res.status(200).json({ status: 'ok', processed: 0, message: 'Telefone inválido' });
    }
    
    console.log();
    
    // Buscar e associar contato MGM
    const result = await linkMGMContactToSignup(phoneNormalized, contactId);
    
    console.log(`\n✅ Webhook processado com sucesso\n`);
    res.status(200).json({ 
      status: 'ok', 
      processed: result.found ? 1 : 0,
      found: result.found,
      associated: result.associated || false,
      message: result.message
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
 * Testa se consegue encontrar e associar contato MGM
 */
app.get('/api/mgm/link-signup', async (req, res) => {
  const { phone, contactId } = req.query;
  
  if (!phone || !contactId) {
    return res.status(400).json({
      status: 'error',
      message: 'Parâmetros obrigatórios: phone e contactId. Exemplo: /api/mgm/link-signup?phone=11987654321&contactId=123'
    });
  }
  
  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized) {
    return res.status(400).json({
      status: 'error',
      message: 'Telefone inválido'
    });
  }
  
  const result = await linkMGMContactToSignup(phoneNormalized, contactId);
  
  res.json({
    status: 'ok',
    ...result
  });
});

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
    version: '1.1.0 - FIXED'
  });
});

/**
 * GET /
 * Homepage com informações
 */
app.get('/', (req, res) => {
  res.send(`
    <h1>🤖 MGM Agent - HubSpot (v1.1.0 FIXED)</h1>
    <p>Agente de processamento de indicações MGM com associação de contatos</p>
    
    <h2>Endpoints:</h2>
    <ul>
      <li><strong>POST /api/mgm</strong> - Processar indicação (JSON)</li>
      <li><strong>GET /api/mgm?phone=11987654321</strong> - Processar indicação (Query)</li>
      <li><strong>GET /api/mgm/link-signup?phone=11987654321&contactId=123</strong> - Testar associação</li>
      <li><strong>GET /health</strong> - Status da aplicação</li>
    </ul>
    
    <h2>Fluxo de Associação:</h2>
    <ol>
      <li>Contato A criado via /api/mgm (indicação)</li>
      <li>Webhook disparado quando Contato B chega (form/signup)</li>
      <li>Sistema busca Contato A pelo telefone</li>
      <li>Se encontrado, associa B a A automaticamente</li>
    </ol>
  `);
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🤖 MGM AGENT - RUNNING (v1.1.0)       ║
║  📍 http://localhost:${PORT}            ║
╚════════════════════════════════════════╝

Endpoints:
  POST http://localhost:${PORT}/api/mgm
  GET  http://localhost:${PORT}/api/mgm?phone=11987654321
  GET  http://localhost:${PORT}/api/mgm/link-signup?phone=11987654321&contactId=123

Exemplo:
  curl "http://localhost:${PORT}/api/mgm?phone=11987654321&name=João"
  `);
});