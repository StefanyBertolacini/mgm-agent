// ============================================
// MGM AGENT - Processador de Indicações
// ============================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

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
app.use(express.static(path.join(__dirname, '..')));

// Rota GET / para servir app.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../app.html'));
});

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Normaliza telefone para formato padrão E.164
 */
function normalizePhone(phoneRaw) {
  if (!phoneRaw) return null;
  
  try {
    // Remove TODOS os caracteres não numéricos (hífens, espaços, etc)
    let cleaned = phoneRaw.replace(/\D/g, '');
    
    // Se começar com 0, remove
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Se não tem código de país (55), adiciona
    if (!cleaned.startsWith('55')) {
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
async function createContact(phoneNormalized, name, origin, ownerId) {
  try {
    console.log(`➕ Criando novo contato: ${name || phoneNormalized}`);
    
    const url = `${HUBSPOT_API_URL}/crm/v3/objects/contacts`;
    
    const properties = {
      firstname: name || `Indicação MGM - ${phoneNormalized}`,
      phone: phoneNormalized,
      contact_mgm_phone_normalized: phoneNormalized,
      contact_mgm_indicator_received: 'true',
      contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
      contact_mgm_indicator_phone: phoneNormalized,
      contact_mgm_indicator_count: '1',
      contact_mgm_matching_confidence: 'High',
    };

    // Adicionar origem se fornecida
    if (origin) {
      properties.contact__cross__source = origin;
      console.log(`📝 Origem adicionada: ${origin}`);
    }

    // Adicionar proprietário se fornecido
    if (ownerId) {
      properties.hubspot_owner_id = ownerId;
      console.log(`👤 Proprietário adicionado: ${ownerId}`);
    }

    const response = await axios.post(url, { properties }, { headers: hubspotHeaders });
    
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
    
    await axios.patch(url, { properties }, { headers: hubspotHeaders });
    
    console.log(`✅ Contato atualizado`);
    
  } catch (err) {
    console.error('❌ Erro ao atualizar contato:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Cria deal MGM
 */
async function createDeal(contactId, phoneNormalized) {
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
    return null; // Continuar mesmo se falhar
  }
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

async function processarIndicacao(phoneRaw, name = null, origin = null, ownerId = null) {
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
    
    if (existingContact) {
      // ATUALIZAR CONTATO EXISTENTE
      action = 'updated';
      contactId = existingContact.id;
      
      const currentCount = parseInt(
        existingContact.properties.contact_mgm_indicator_count || 0
      );
      
      const updateProperties = {
        contact_mgm_indicator_received: 'true',
        contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
        contact_mgm_indicator_count: (currentCount + 1).toString(),
        contact_mgm_matching_confidence: 'High'
      };

      // Atualizar origem se fornecida
      if (origin) {
        updateProperties.contact__cross__source = origin;
      }

      // Atualizar proprietário se fornecido
      if (ownerId) {
        updateProperties.hubspot_owner_id = ownerId;
      }
      
      await updateContact(contactId, updateProperties);
      
    } else {
      // CRIAR NOVO CONTATO
      action = 'created';
      contactId = await createContact(phoneNormalized, name, origin, ownerId);
    }
    
    console.log();
    
    // 3. CRIAR DEAL MGM (apenas se for novo contato)
    let dealId = null;
    if (action === 'created') {
      dealId = await createDeal(contactId, phoneNormalized);
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
  const { phone, name, origin, owner_id } = req.body;
  
  if (!phone) {
    return res.status(400).json({
      status: 'error',
      message: 'Campo "phone" obrigatório'
    });
  }
  
  const result = await processarIndicacao(phone, name, origin, owner_id);
  res.json(result);
});

/**
 * GET /api/mgm
 * Processar indicação via query string (para testes rápidos)
 */
app.get('/api/mgm', async (req, res) => {
  const { phone, name, origin, owner_id } = req.query;
  
  if (!phone) {
    return res.status(400).json({
      status: 'error',
      message: 'Parâmetro "phone" obrigatório'
    });
  }
  
  const result = await processarIndicacao(phone, name, origin, owner_id);
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
    version: '1.3.0'
  });
});


// ============================================
// START SERVER
// ============================================
// Serve app.html para rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../app.html'));
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🤖 MGM AGENT - RUNNING                ║
║  📍 http://localhost:${PORT}            ║
╚════════════════════════════════════════╝

Endpoints:
  POST http://localhost:${PORT}/api/mgm
  GET  http://localhost:${PORT}/api/mgm?phone=11987654321

Features:
  ✅ Processamento em lote
  ✅ Normalização de telefone
  ✅ Origem customizável
  ✅ Proprietário atribuível
  ✅ Rotação de proprietários
  `);
});