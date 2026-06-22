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
async function findContact(normalizedPhone, email) {
  try {
    let filterGroups = [];
    
    // Filtro por telefone
    if (normalizedPhone) {
      filterGroups.push({
        filters: [{
          propertyName: 'phone',
          operator: 'EQ',
          value: normalizedPhone
        }]
      });
    }
    
    // Filtro por e-mail
    if (email) {
      filterGroups.push({
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: email
        }]
      });
    }

    if (filterGroups.length === 0) return null;

    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/contacts/search',
      {
        filterGroups: filterGroups,
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
async function createContact(normalizedPhone, email, name, origem, subsourceIndirectChannelMgm, subsourceMgmDetails, acquisitionMethodsIndirectChannel, ownerId) {
  try {
    const properties = {
      firstname: name || 'Contato MGM',
      contact_mgm_indicator_received: 'true',
      contact_mgm_indicator_date: new Date().toISOString().split('T')[0],
      hubspot_owner_id: ownerId
    };

    // Adiciona telefone se fornecido
    if (normalizedPhone) {
      properties.phone = normalizedPhone;
      properties.contact_mgm_phone_normalized = normalizedPhone;
    }

    // Adiciona e-mail se fornecido
    if (email) {
      properties.email = email;
    }

    // Adiciona origem (obrigatório, mas com default)
    properties.origem = origem || 'Indicação';

    // Adiciona campos opcionais
    if (subsourceIndirectChannelMgm) {
      properties.contact_cross_subsource_indirect_chanel_mgm = subsourceIndirectChannelMgm;
    }

    if (subsourceMgmDetails) {
      properties.contact_cross_subsource_mgm_details = subsourceMgmDetails;
    }

    if (acquisitionMethodsIndirectChannel) {
      properties.contact_cross_acquisition_methods_indirect_chanel = acquisitionMethodsIndirectChannel;
    }

    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/contacts',
      { properties },
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
async function updateContact(contactId, normalizedPhone, email, name, origem, subsourceIndirectChannelMgm, subsourceMgmDetails, acquisitionMethodsIndirectChannel, ownerId) {
  try {
    const properties = {};

    // Adiciona telefone se fornecido
    if (normalizedPhone) {
      properties.phone = normalizedPhone;
    }

    // Adiciona e-mail se fornecido
    if (email) {
      properties.email = email;
    }

    // Adiciona nome se fornecido
    if (name) {
      properties.firstname = name;
    }

    // Adiciona origem se fornecida
    if (origem) {
      properties.origem = origem;
    }

    // Adiciona campos opcionais
    if (subsourceIndirectChannelMgm) {
      properties.contact_cross_subsource_indirect_chanel_mgm = subsourceIndirectChannelMgm;
    }

    if (subsourceMgmDetails) {
      properties.contact_cross_subsource_mgm_details = subsourceMgmDetails;
    }

    if (acquisitionMethodsIndirectChannel) {
      properties.contact_cross_acquisition_methods_indirect_chanel = acquisitionMethodsIndirectChannel;
    }

    // Adiciona owner se fornecido
    if (ownerId) {
      properties.hubspot_owner_id = ownerId;
    }

    // Se não houver nada para atualizar, retorna sucesso
    if (Object.keys(properties).length === 0) {
      return {
        contact_id: contactId,
        action: 'updated',
        status: 'success',
        message: 'Contato já existente (nenhuma mudança)'
      };
    }

    const response = await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      { properties },
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
    const { 
      phone, 
      email, 
      name, 
      origem, 
      subsourceIndirectChannelMgm, 
      subsourceMgmDetails, 
      acquisitionMethodsIndirectChannel, 
      owner_id 
    } = req.body;

    // Validação: telefone OU email obrigatório
    if (!phone && !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Telefone ou e-mail é obrigatório'
      });
    }

    const normalizedPhone = phone ? normalizePhone(phone) : null;

    // Se tiver telefone mas for inválido, retorna erro
    if (phone && !normalizedPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Telefone inválido'
      });
    }

    // Busca contato existente (por telefone E/OU email)
    const existingContact = await findContact(normalizedPhone, email);

    let result;

    if (existingContact) {
      // Atualiza contato existente
      result = await updateContact(
        existingContact.id, 
        normalizedPhone, 
        email, 
        name, 
        origem, 
        subsourceIndirectChannelMgm, 
        subsourceMgmDetails, 
        acquisitionMethodsIndirectChannel, 
        owner_id
      );
    } else {
      // Cria novo contato
      result = await createContact(
        normalizedPhone, 
        email, 
        name, 
        origem, 
        subsourceIndirectChannelMgm, 
        subsourceMgmDetails, 
        acquisitionMethodsIndirectChannel, 
        owner_id
      );
    }

    if (result.status === 'success') {
      // Cria deal se tiver telefone normalizado
      if (normalizedPhone) {
        await createDeal(result.contact_id, normalizedPhone, owner_id);
      }
    }

    return res.json({
      ...result,
      phone: normalizedPhone,
      email: email || null,
      name: name || null
    });
  } catch (error) {
    console.error('Erro ao processar indicação:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Erro interno ao processar indicação',
      phone: req.body.phone,
      email: req.body.email
    });
  }
});

// ================================================
// GET /api/mgm - Processa indicação por query string
// ================================================

app.get('/api/mgm', async (req, res) => {
  try {
    const { 
      phone, 
      email, 
      name, 
      origem, 
      subsourceIndirectChannelMgm, 
      subsourceMgmDetails, 
      acquisitionMethodsIndirectChannel, 
      owner_id 
    } = req.query;

    // Validação: telefone OU email obrigatório
    if (!phone && !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Telefone ou e-mail é obrigatório'
      });
    }

    const normalizedPhone = phone ? normalizePhone(phone) : null;

    // Se tiver telefone mas for inválido, retorna erro
    if (phone && !normalizedPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Telefone inválido'
      });
    }

    // Busca contato existente (por telefone E/OU email)
    const existingContact = await findContact(normalizedPhone, email);

    let result;

    if (existingContact) {
      // Atualiza contato existente
      result = await updateContact(
        existingContact.id, 
        normalizedPhone, 
        email, 
        name, 
        origem, 
        subsourceIndirectChannelMgm, 
        subsourceMgmDetails, 
        acquisitionMethodsIndirectChannel, 
        owner_id
      );
    } else {
      // Cria novo contato
      result = await createContact(
        normalizedPhone, 
        email, 
        name, 
        origem, 
        subsourceIndirectChannelMgm, 
        subsourceMgmDetails, 
        acquisitionMethodsIndirectChannel, 
        owner_id
      );
    }

    if (result.status === 'success') {
      // Cria deal se tiver telefone normalizado
      if (normalizedPhone) {
        await createDeal(result.contact_id, normalizedPhone, owner_id);
      }
    }

    return res.json({
      ...result,
      phone: normalizedPhone,
      email: email || null,
      name: name || null
    });
  } catch (error) {
    console.error('Erro ao processar indicação:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Erro interno ao processar indicação',
      phone: req.query.phone,
      email: req.query.email
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