# 🤖 MGM Agent

> Processador de indicações integrado ao HubSpot CRM

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Version](https://img.shields.io/badge/version-1.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 📌 O que é?

**MGM Agent** é uma aplicação web que captura **indicações de clientes em lote**, normaliza os dados e **sincroniza com HubSpot CRM automaticamente**.

### Em 3 passos:

1. 📱 Usuário preenche formulário com telefones
2. ⚙️ Sistema processa, normaliza e atualiza HubSpot
3. 🤖 HubSpot cria deals automaticamente via workflows

---

## 🎯 Para que serve?

| Problema | Solução |
|----------|---------|
| Indicações chegam desorganizadas | ✅ Sistema centralizado |
| Telefones com formatos diferentes | ✅ Normalização automática E.164 |
| Contatos duplicados no CRM | ✅ Detecção inteligente |
| Deals não são criados | ✅ Automação HubSpot |
| Sem responsável definido | ✅ Atribuição de proprietário |

---

## 🚀 Quick Start (Rápido)

### Instalação (5 min)

```bash
# 1. Clone ou extraia o projeto
cd mgm-agent

# 2. Instale dependências
npm install

# 3. Configure .env
cp .env.example .env
# ↑ Preencha com HUBSPOT_API_KEY

# 4. Rode localmente
npm start

# 5. Abra no navegador
http://localhost:3000
```

### Uso (1 min)

Cole telefones: (11) 98765-4321
Escolha origem: LinkedIn
Selecione proprietário: Seu nome
Clique "Processar"
Veja resultado ✅

---

## 📚 Documentação Completa

- **[Arquitetura](ARQUITETURA.md)** - Como o sistema funciona por dentro
- **[Setup Local](SETUP_LOCAL.md)** - Instruções detalhadas de instalação
- **[API Reference](API_REFERENCE.md)** - Endpoints e payloads
- **[Troubleshooting](TROUBLESHOOTING.md)** - Erros e soluções

---

## 🛠️ Stack Tecnológico

Frontend:  HTML5 + CSS3 + JavaScript Vanilla
Backend:   Node.js + Express
Database:  HubSpot CRM (via API REST)
Deploy:    Railway.com

---

## ⚡ Features Principais

- ✅ **Processamento em lote** - Múltiplos telefones por vez
- ✅ **Normalização E.164** - Padroniza formato internacional
- ✅ **Detecção de duplicados** - Não cria contatos repetidos
- ✅ **Rotação de proprietários** - Distribui entre vendedores
- ✅ **Interface responsiva** - Funciona no mobile
- ✅ **Integração HubSpot** - Sincronização automática
- ✅ **Workflows automáticos** - Cria deals sozinho

---

## 📊 Métricas de Impacto

> MGM Agent resolve o problema real de **captura desorganizada de indicações**

- 🎯 **Impacto**: Usado por 18 proprietários na Capim
- ⚡ **Velocidade**: Processa ~50 indicações/min
- 🤖 **Automação**: 100% da criação de deals via workflows
- 📈 **Reprodutibilidade**: Qualquer pessoa consegue instalar

---

## 🔗 Links Importantes

- **Repositório:** GitHub - StefanyBertolacini/mgm-agent
- **Produção:** https://mgm-agent-production.up.railway.app
- **HubSpot Workspace:** [Link do seu workspace]

---

## 👥 Suporte

Dúvidas? Veja a [documentação completa](ARQUITETURA.md) ou [troubleshooting](TROUBLESHOOTING.md).

---

## 📄 Licença

MIT License - Capim 2025