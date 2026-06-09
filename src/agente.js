// ================================================
// MGM AGENT - Processador de Indicações
// ================================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ================================================
// Headers para HubSpot API
const hubspotHeaders = {
  'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
  'Content-Type': 'application/json'
};

// ================================================
// MIDDLEWARE
// ================================================

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

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

// ================================================
// ROTA GET / para servir app.html
// ================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../app.html'));
});

// ================================================
// FUNÇÕES AUXILIARES
// ================================================

// Normaliza telefone para formato E.164
function normalizePhone(phoneRaw) {
  if (!phoneRaw) return null;
  
  let cleaned = phoneRaw.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  if (!cleaned.startsWith('55')) {
    if (cleaned.length === 11 || cleaned.length === 10) {
      cleaned = '55' + cleaned;
    }
  }
  
  return '+' + cleaned;
}

// ================================================
// START SERVER
// ================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🤖 MGM AGENT - RUNNING                ║
║  📍 http://localhost:${PORT}              ║
╚════════════════════════════════════════╝
`);
  console.log(`
Endpoints:
  POST http://localhost:${PORT}/api/mgm
  GET  http://localhost:${PORT}/api/mgm?phone=119876543 21

Features:
  ✅ Processamento em lote
  ✅ Normalização de telefone
  ✅ Origem customizável
  ✅ Proprietário atribuível
  ✅ Rotação de proprietários
`);
});

// ================================================
// FUNÇÕES AUXILIARES
// ================================================

// Busca contato existente no HubSpot
async function findContact(normalizedPhone) {
  try {
    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/contacts/search',
      {
        filterGroups: [{
          filters: [{
            propertyName: 'phone',  // ← CAMPO PADRÃO
            operator: 'EQ',
            value: normalizedPhone
          }]
        }],
        limit: 1
      },
      { headers: hubspotHeaders }
    );

    return response.data.results.length > 0 ? response.data.results[0] : null;
  } catch (error) {
    console.error('Erro ao buscar contato:', error.message);
    return null;
  }
}

// Cria novo contato no HubSpot
async function createContact(normalizedPhone, name, origin, ownerId) {
  try {
    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/contacts',
      {
        properties: {
          phone: normalizedPhone,
          firstname: name || 'Contato MGM',
          contact_mgm_phone_normalized: normalizedPhone,
          contact_mgm_indicator_received: 'true',
          contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
          contact__cross__source: origin || 'MGM',
          hubspot_owner_id: ownerId
        }
      },
      { headers: hubspotHeaders }
    );

    return {
      contact_id: response.data.id,
      action: 'created',
      status: 'success',
      message: 'Indicação criada com sucesso!'
    };
  } catch (error) {
    console.error('Erro ao criar contato:', error.response?.data || error.message);
    return {
      status: 'error',
      message: 'Erro ao criar contato: ' + (error.response?.data?.message || error.message)
    };
  }
}

// Atualiza contato existente
async function updateContact(contactId, origin, ownerId) {
  try {
    const response = await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        properties: {
          contact_mgm_indicator_count: '1',
          contact__cross__source: origin || 'MGM',
          hubspot_owner_id: ownerId
        }
      },
      { headers: hubspotHeaders }
    );

    return {
      contact_id: response.data.id,
      action: 'updated',
      status: 'success',
      message: 'Contato atualizado com sucesso!'
    };
  } catch (error) {
    console.error('Erro ao atualizar contato:', error.response?.data || error.message);
    return {
      status: 'error',
      message: 'Erro ao atualizar contato: ' + (error.response?.data?.message || error.message)
    };
  }
}

// Cria deal no pipeline MGM
async function createDeal(contactId, normalizedPhone, ownerId) {
  try {
    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/deals',
      {
        properties: {
          dealname: `MGM - ${normalizedPhone}`,
          pipeline: '904463895',
          dealstage: '1372198928',
          deal_mgm_phone_normalized: normalizedPhone,
          hubspot_owner_id: ownerId
        },
        associations: [{
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
          id: contactId
        }]
      },
      { headers: hubspotHeaders }
    );

    return response.data.id;
  } catch (error) {
    console.error('Erro ao criar deal:', error.response?.data || error.message);
    return null;
  }
}

// ================================================
// POST /api/mgm - Processa indicação
// ================================================

app.post('/api/mgm', async (req, res) => {
  try {
    const { phone, name, origin, owner_id } = req.body;

    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Telefone é obrigatório'
      });
    }

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Telefone inválido'
      });
    }

    // Busca contato existente
    const existingContact = await findContact(normalizedPhone);

    let result;

    if (existingContact) {
      // Atualiza contato existente
      result = await updateContact(existingContact.id, origin, owner_id);
    } else {
      // Cria novo contato
      result = await createContact(normalizedPhone, name, origin, owner_id);
    }

    if (result.status === 'success') {
      // Cria deal
      await createDeal(result.contact_id, normalizedPhone, owner_id);
    }

    return res.json({
      ...result,
      phone: normalizedPhone,
      name: name || null
    });
  } catch (error) {
    console.error('Erro ao processar indicação:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Erro interno ao processar indicação',
      phone: req.body.phone
    });
  }
});

// ================================================
// GET /api/mgm - Processa indicação por query string
// ================================================

app.get('/api/mgm', async (req, res) => {
  try {
    const { phone, name, origin, owner_id } = req.query;

    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Telefone é obrigatório'
      });
    }

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Telefone inválido'
      });
    }

    // Busca contato existente
    const existingContact = await findContact(normalizedPhone);

    let result;

    if (existingContact) {
      // Atualiza contato existente
      result = await updateContact(existingContact.id, origin, owner_id);
    } else {
      // Cria novo contato
      result = await createContact(normalizedPhone, name, origin, owner_id);
    }

    if (result.status === 'success') {
      // Cria deal
      await createDeal(result.contact_id, normalizedPhone, owner_id);
    }

    return res.json({
      ...result,
      phone: normalizedPhone,
      name: name || null
    });
  } catch (error) {
    console.error('Erro ao processar indicação:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Erro interno ao processar indicação',
      phone: req.query.phone
    });
  }
});

// ================================================
// GET /health - Status check
// ================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.3.0'
  });
});