markdown# 📦 Setup Local - Guia de Instalação

Passo-a-passo para instalar e rodar **MGM Agent** na sua máquina.

---

## ⏱️ Tempo Total: ~10 minutos
Pré-requisitos: 2 min
Download projeto: 1 min
Instalar dependências: 5 min
Configurar .env: 1 min
Rodar servidor: 1 min

---

## 🔧 Pré-Requisitos

Você precisa ter instalado na sua máquina:

### 1️⃣ **Node.js** (v16+)

Baixe em: https://nodejs.org/

Verificar instalação:
```bash
node --version    # Deve mostrar v16+ (ex: v18.15.0)
npm --version     # Deve mostrar v8+ (ex: v8.19.2)
```

### 2️⃣ **Git** (opcional, mas recomendado)

Baixe em: https://git-scm.com/

Verificar instalação:
```bash
git --version     # Deve mostrar a versão (ex: git version 2.40.0)
```

### 3️⃣ **VS Code** (ou editor preferido)

Baixe em: https://code.visualstudio.com/

### 4️⃣ **HubSpot API Key**

Você vai precisar de uma API Key válida do HubSpot. Veja como conseguir no final deste documento.

---

## 📥 Passo 1: Baixar o Projeto

### Opção A: Via Git (Recomendado)

```bash
# Abra o terminal/PowerShell na pasta onde quer instalar

git clone https://github.com/StefanyBertolacini/mgm-agent.git
cd mgm-agent
```

### Opção B: Download ZIP

1. Acesse: https://github.com/StefanyBertolacini/mgm-agent
2. Clique em "Code" → "Download ZIP"
3. Extraia em uma pasta
4. Abra a pasta no terminal

---

## 📂 Passo 2: Entender a Estrutura de Pastas

Depois de clonar, você deve ter:
mgm-agent/
├── src/
│   └── agente.js ..................... Servidor principal (Node.js)
├── app.html .......................... Interface web
├── package.json ...................... Dependências do projeto
├── package-lock.json ................. Lock file (não mexer)
├── .env ......................... ⚠️  CRIAR (credenciais)
├── .env.example ...................... Modelo de .env
├── .gitignore ........................ Arquivos ignorados pelo Git
├── docs/ ............................ Documentação
│   ├── README.md
│   ├── ARQUITETURA.md
│   ├── SETUP_LOCAL.md ............... ← Você está aqui
│   ├── API_REFERENCE.md
│   └── TROUBLESHOOTING.md
├── node_modules/ (criada depois) ..... Dependências instaladas
└── .git/ (se clonou com Git) ........ Histórico Git

---

## 🔑 Passo 3: Configurar Variáveis de Ambiente (.env)

### 3.1: Criar arquivo `.env`

1. Na **raiz do projeto** (mesma pasta de `app.html`), crie um arquivo chamado `.env`
   
```bash
   # No terminal:
   touch .env    # No macOS/Linux
   
   # No Windows PowerShell:
   New-Item -Path ".env" -ItemType File
```

   Ou via VS Code:
   - Click direito na raiz do projeto
   - "New File"
   - Nome: `.env`

### 3.2: Copiar conteúdo

Abra o arquivo `.env` e copie:

```env
# ================================================
# MGM Agent - Configuração Local
# ================================================

PORT=3000
NODE_ENV=development
HUBSPOT_API_KEY=seu_api_key_aqui
```

**⚠️ IMPORTANTE:**
- Nunca compartilhe este arquivo
- Nunca faça commit no Git (já está no `.gitignore`)
- Cada desenvolvedor deve ter seu próprio `.env`

### 3.3: Obter HubSpot API Key

#### Como conseguir sua API Key:

1. **Acesse HubSpot:**
   - Login em https://app.hubspot.com
   - Settings → "Integrations" → "Private apps"

2. **Crie nova app:**
   - Clique "Create app"
   - Nome: "MGM Agent Local"
   - Descrição: "Desenvolvimento local"

3. **Dê permissões:**
   - Na aba "Scopes"
   - Procure e selecione:
 ✅ crm.objects.contacts.read
 ✅ crm.objects.contacts.write
 ✅ crm.objects.deals.read
 ✅ crm.objects.deals.write
 ✅ crm.objects.contacts.manage
 ✅ crm.objects.deals.manage

4. **Copie a chave:**
   - Clique "Create app"
   - Vá para "Auth"
   - Copie "Access token"
   - Cole no seu `.env`:
```env
     HUBSPOT_API_KEY=pat-na1-1234567890abcdef...
```

---

## 📦 Passo 4: Instalar Dependências

No terminal, dentro da pasta `mgm-agent/`:

```bash
npm install
```

**O que acontece:**
- ✅ Lê `package.json`
- ✅ Baixa todas as dependências (Express, Axios, etc)
- ✅ Cria pasta `node_modules/`
- ✅ Cria arquivo `package-lock.json`
- ✅ Leva ~30-60 segundos

**Resposta esperada:**
added 84 packages in 45s

---

## 🚀 Passo 5: Rodar o Servidor

```bash
npm start
```

**Você deve ver no terminal:**
╔════════════════════════════════════════╗
║  🤖 MGM AGENT - RUNNING                ║
║  📍 http://localhost:3000              ║
╚════════════════════════════════════════╝
Endpoints:
POST http://localhost:3000/api/mgm
GET  http://localhost:3000/api/mgm?phone=119876543 21
Features:
✅ Processamento em lote
✅ Normalização de telefone
✅ Origem customizável
✅ Proprietário atribuível
✅ Rotação de proprietários

---

## 🌐 Passo 6: Acessar a Aplicação

1. Abra o navegador
2. Vá para: **http://localhost:3000**
3. Você deve ver a interface bonita com branding Capim

**Se você vir:**
- ✅ Formulário com campos → **Tudo funcionando!**
- ❌ "Cannot GET /" → Servidor não iniciou (ver troubleshooting)

---

## ✅ Teste Rápido

Para confirmar que tudo está funcionando:

### Teste 1: Interface Web

1. Acesse http://localhost:3000
2. Preencha com dados de teste:
Telefone: (11) 98765-4321
Origem: Teste Local
Proprietário: Qualquer um
3. Clique "Processar"
4. Você deve ver resultado:
✅ +5511987654321
✓ Criado | ID: 12345
Indicação criada com sucesso!

### Teste 2: API via cURL (Terminal)

```bash
curl -X POST http://localhost:3000/api/mgm \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "(11) 98765-4321",
    "name": "Teste",
    "origin": "Teste Local",
    "owner_id": "90532052"
  }'
```

Resposta esperada:
```json
{
  "status": "success",
  "action": "created",
  "contact_id": "12345",
  "phone": "+5511987654321",
  "name": "Teste",
  "message": "Indicação criada com sucesso!"
}
```

### Teste 3: Health Check

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-06-10T10:30:45.123Z",
  "version": "1.3.0"
}
```

---

## 🛑 Parar o Servidor

No terminal onde está rodando, pressione:

```bash
Ctrl + C    # Windows/Linux
⌘ + C      # macOS
```

---

## 🔄 Reiniciar o Servidor

Se fez mudanças no código e quer recarregar:

```bash
# Opção 1: Pare (Ctrl+C) e rode de novo
npm start

# Opção 2: Use nodemon (hot reload)
npm install -g nodemon
nodemon src/agente.js
```

---

## 📝 Modificar o Código

Você pode editar os arquivos sem parar o servidor:
app.html ........................ Mude interface, atualizar página no navegador
src/agente.js .................. Mude backend, reiniciar servidor
.env ........................... Mude variáveis, reiniciar servidor

**Fluxo típico:**
1. Abra VS Code
2. Faça edição em `app.html`
3. Salve (Ctrl+S)
4. Atualizar página no navegador (F5)
5. Veja mudança aplicada

---

## 🌍 Acessar de Outra Máquina

Se quer acessar o servidor de outro computador na **mesma rede**:

1. Descubra seu IP local:
```bash
   # macOS/Linux:
   ifconfig | grep "inet "
   
   # Windows PowerShell:
   ipconfig | findstr "IPv4"
```
   
   Procure por algo como `192.168.x.x`

2. Acesse de outra máquina:
http://seu_ip_local:3000
Exemplo: http://192.168.1.100:3000

---

## 💾 Opções de Salvar/Backup

### Seu Projeto está pronto para:

1. **Git + GitHub**
```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
```

2. **Fazer backup local**
```bash
   # Copie toda pasta mgm-agent para outro local
   # Ou use: zip -r mgm-agent-backup.zip mgm-agent/
```

---

## 🚀 Próximas Etapas

Depois de testar localmente, você pode:

### 1. Deploy em Produção (Railway)
```bash
   git push origin main
   # Railway faz deploy automático
```
   Veja [Railway Docs](https://docs.railway.app/)

### 2. Compartilhar com Time
URL Produção: https://mgm-agent-production.up.railway.app

### 3. Continuar Desenvolvendo
   - Veja [API_REFERENCE.md](API_REFERENCE.md) para endpoints
   - Veja [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para erros

---

## ❌ Erros Comuns

### ❌ "npm: command not found"
**Solução:** Node.js não está instalado. Baixe em https://nodejs.org/

### ❌ "Cannot GET /"
**Solução:** Servidor não iniciou. Verifique:
- Está na pasta certa?
- Rodou `npm install`?
- Rodou `npm start`?

### ❌ "EADDRINUSE: address already in use :::3000"
**Solução:** Porta 3000 já está sendo usada. Execute:
```bash
# Mate o processo na porta 3000
# macOS/Linux:
lsof -ti:3000 | xargs kill

# Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

### ❌ "401 - Unauthorized" (HubSpot)
**Solução:** API Key inválida ou expirada:
- Verifique `.env`
- Gere novo token em https://app.hubspot.com/

### ❌ "Cannot find module 'express'"
**Solução:** Dependências não instaladas:
```bash
npm install
```

Veja mais em [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 💡 Dicas de Desenvolvimento

### VS Code Extensions Úteis

REST Client (para testar API)
Thunder Client (alternativa a Postman)
Prettier (formatar código)
Thunder Client


### Teste com ferramentas:
- **Postman** - Testar endpoints HTTP
- **Insomnia** - Alternativa mais leve
- **REST Client** - Extensão do VS Code

### Estrutura de Projeto Escalável:
Se o projeto crescer, considere:
src/
├── routes/
│   └── mgm.js
├── controllers/
│   └── contactController.js
├── services/
│   └── hubspotService.js
└── middleware/
└── auth.js

---

## ✅ Checklist Final

- [ ] Node.js instalado? (`node --version`)
- [ ] Projeto clonado/baixado?
- [ ] Arquivo `.env` criado com API Key?
- [ ] `npm install` executado?
- [ ] `npm start` rodando?
- [ ] http://localhost:3000 abrindo?
- [ ] Teste com um telefone funcionou?

---

## 📞 Suporte

Se tiver problemas:

1. **Leia o [TROUBLESHOOTING.md](TROUBLESHOOTING.md)**
2. **Verifique o [ARQUITETURA.md](ARQUITETURA.md)** para entender fluxo
3. **Veja logs no terminal** - mensagens de erro costumam ser claras

---

## 🎉 Pronto!

Você tem um **MGM Agent funcionando localmente**.

Agora você pode:
- ✅ Testar a aplicação
- ✅ Fazer mudanças no código
- ✅ Debugar problemas
- ✅ Deploy em produção

**Próximo passo:** Leia [API_REFERENCE.md](API_REFERENCE.md) para entender os endpoints disponíveis.