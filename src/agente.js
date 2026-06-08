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
const PNF = phonenumbers.PhoneNumberFormat;

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
    // Se já estiver em formato E164, retorna direto
    if (phoneRaw && phoneRaw.startsWith('+') && phoneRaw.length > 10) {
      console.log(`✅ Telefone já normalizado: ${phoneRaw}`);
      return phoneRaw;
    }
    
    // Remove espaços e hífens
    const cleaned = phoneRaw.replace(/[\s\-]/g, '');
    
    // Parsear com google-libphonenumber
    const parsed = phoneUtil.parseAndKeepRawInput(cleaned, 'BR');
    
    // Retornar em formato E164
    const formatted = phoneUtil.format(parsed, PNF.E164);
    console.log(`✅ Telefone normalizado: ${formatted}`);
    return formatted;
  } catch (err) {
    console.error(`⚠️ Erro ao normalizar: ${phoneRaw}`, err.message);
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
    
    // O HubSpot envia: { hs_object_id: "...", phone: "..." }
    const { hs_object_id, phone } = req.body;
    
    if (!hs_object_id || !phone) {
      console.log(`⚠️ Dados incompletos no webhook`);
      return res.status(200).json({ status: 'ok', processed: 0, message: 'Dados incompletos' });
    }
    
    const contactId = hs_object_id;
    const phoneRaw = phone;
    
    console.log(`\n📋 Contato ID: ${contactId}, Telefone: ${phoneRaw}`);
    
    // Normalizar telefone
    const phoneNormalized = normalizePhone(phoneRaw);
    if (!phoneNormalized) {
      console.log(`⚠️ Telefone inválido: ${phoneRaw}`);
      return res.status(200).json({ status: 'ok', processed: 0, message: 'Telefone inválido' });
    }
    
    console.log(`✅ Telefone normalizado: ${phoneNormalized}`);
    
    // Buscar e associar contato MGM
    const result = await linkMGMDealToSignup(phoneNormalized, contactId);
    
    if (result.found) {
      console.log(`🎉 Contatos associados! MGM: ${result.mgmContactId}, Signup: ${result.signupContactId}`);
    } else {
      console.log(`ℹ️ Nenhum contato MGM encontrado para ${phoneNormalized}`);
    }
    
    console.log(`\n✅ Webhook processado com sucesso\n`);
    res.status(200).json({ 
      status: 'ok', 
      processed: result.found ? 1 : 0,
      message: result.found ? 'Contatos associados' : 'Nenhuma associação encontrada'
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
async function linkMGMDealToSignup(phoneNormalized, signupContactId) {
  try {
    console.log(`🔗 Buscando contato MGM para associar: ${phoneNormalized}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`;
    
    const phoneForSearch = phoneNormalized.replace(/[\s\-]/g, '');
    
    console.log(`📞 Telefone para busca (sem hífens): ${phoneForSearch}`);

    // Buscar CONTATO A (que foi criado via indicação MGM)
    const response = await axios.post(url, {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'contact_mgm_phone_normalized',
              operator: 'EQ',
              value: phoneForSearch
            }
          ]
        }
      ],
      limit: 1
    }, { headers: hubspotHeaders });
    
    if (response.data.results && response.data.results.length > 0) {
      const mgmContactId = response.data.results[0].id;
      console.log(`✅ Contato MGM encontrado: ${mgmContactId}`);
      
      // 1. ASSOCIAR CONTATO B ao CONTATO A
      try {
        console.log(`🔗 Associando contato ${signupContactId} ao contato MGM ${mgmContactId}`);
        
        const associateUrl = `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${signupContactId}/associations/contacts/${mgmContactId}`;
        
        await axios.put(associateUrl, [
          {
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: 1  // Related contact
          }
        ], { headers: hubspotHeaders });
        
        console.log(`✅ Contatos associados`);
      } catch (assocErr) {
        console.warn('⚠️ Aviso ao associar contatos:', assocErr.message);
      }
      
      // 2. MARCAR CONTATO B COM PROPRIEDADES MGM
      try {
        console.log(`📝 Marcando contato ${signupContactId} como MGM`);
        
        const updateUrl = `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${signupContactId}`;
        
        await axios.patch(updateUrl, {
          properties: {
            contact_mgm_phone_normalized: phoneNormalized,
            contact_mgm_indicator_received: 'true',
            contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
            contact_mgm_matching_confidence: 'High',
            contact_mgm_signup_confirmed: 'true',
            contact_mgm_signup_date: new Date().toISOString().split('T')[0]
          }
        }, { headers: hubspotHeaders });
        
        console.log(`✅ Contato marcado como MGM + Signup confirmado`);
      } catch (updateErr) {
        console.warn('⚠️ Aviso ao marcar contato MGM:', updateErr.message);
      }
      
      return {
        found: true,
        mgmContactId: mgmContactId,
        signupContactId: signupContactId,
        associated: true
      };
    }
    
    console.log(`ℹ️ Nenhum contato MGM encontrado para este telefone`);
    return { found: false };
    
  } catch (err) {
    console.error('⚠️ Erro ao buscar/associar contato MGM:', err.message);
    return { found: false };
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