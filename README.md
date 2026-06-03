# 🤖 MGM Agent - HubSpot

Agente de processamento de indicações MGM integrado ao HubSpot.

## 📋 O que faz?

Input: Número de telefone (ex: 11 98765-4321)
↓
Process: 
- Valida telefone
- Busca no HubSpot
- Cria/atualiza contato
- Cria deal MGM
↓
Output: ✅ Contato criado/atualizado, ✅ Deal criado

## 🚀 Quick Start

### Requisitos
- Node.js v16+
- HubSpot Account com API access
- Chave de API do HubSpot

### Instalação

```bash
npm install
cp .env.example .env
npm start
```

## 📁 Estrutura do Projeto
mgm-agent/
├── src/
├── docs/
├── tests/
├── package.json
├── README.md
└── .env.example
## 📞 Autor

Capim