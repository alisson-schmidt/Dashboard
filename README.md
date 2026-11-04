
# Public Safety Workforce Governance & Tactical Readiness Dashboard
### Painel de Gestão e Análise Operacional do Efetivo — Casa Militar da Governadoria

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frontend: React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind-blue)](https://react.dev/)
[![Backend: Node.js Express](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20TypeScript-green)](https://nodejs.org/)
[![Cloud & APIs: Google Cloud](https://img.shields.io/badge/Integrations-Google%20Drive%20%26%20Sheets%20API-orange)](https://cloud.google.com/)
[![AI Engine: Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%20API-blueviolet)](https://deepmind.google/technologies/gemini/)

---

## 📌 Visão Geral / Executive Overview

**EN:** A full-stack, client-server web application and analytics platform engineered for strategic personnel management, tactical readiness tracking, and operational shift governance at the Military House (Casa Militar) of the State Government of Paraná. Powered by **React 19**, **Node.js/Express**, **Google Workspace APIs**, and **Google Gemini AI**, the system streamlines troop readiness, prevents operational fatigue, and enables conversational data intelligence.

**PT:** Aplicação web *full-stack* (cliente-servidor) voltada à gestão analítica, governança de escalas e prontidão operacional do efetivo da Casa Militar da Governadoria do Paraná. Desenvolvida com **React 19**, **Node.js/Express**, integrações nativas com **Google Drive/Sheets API** e inteligência artificial **Google Gemini**, a plataforma elimina retrabalho burocrático e acelera a tomada de decisão estratégica do comando.

---

## 🏛️ Arquitetura de Software e Tecnologias / System Architecture

```text
├── Frontend (Client SPA)    : React 19, Vite, TanStack Router, Tailwind CSS, Recharts, Lucide Icons, Motion
├── Backend (REST Server)    : Node.js, Express, TypeScript (server.ts -> dist/server.cjs)
├── Data Integration / ETL   : Google Drive API v3 & Sheets API v4 (Service Account JWT authentication)
├── Resilience & Caching     : Dual-layer cache (In-Memory + Local JSON Disk Cache with 10-min auto-sync)
├── Security & Access        : Google OAuth 2.0 (Identity Services) + Institutional Whitelist (ALLOWED_EMAILS)
├── Generative AI Assistant  : Native integration with Google Gemini API (/api/chat endpoint)
└── Deployment & DevOps      : Host 0.0.0.0:3000, Linux systemd daemon (efetivo-cm.service) / Windows PM2
```

---

## 📁 Estrutura de Diretórios / Directory Structure

```text
├── server.ts                   # Backend Express (Autenticação, Sincronização Google, Cache e API REST)
├── index.html                  # Ponto de entrada SPA (Frontend)
├── package.json                # Dependências Node.js e scripts NPM
├── .env.example                # Template de variáveis de ambiente seguras
├── vite.config.ts              # Configuração de compilação do Vite
├── tsconfig.json               # Configurações do compilador TypeScript
├── src/
│   ├── main.tsx                # Ponto de entrada React
│   ├── router.tsx              # Roteamento TanStack Router
│   ├── routes/                 # Telas e rotas da aplicação
│   ├── components/             # Componentes de UI (Filtros, Tabelas, Métricas e Chat IA)
│   └── data/
│       └── efetivo.json        # Cache local do efetivo (offline fallback)
└── dist/                       # Build de produção (server.cjs + assets estáticos)
```

---

## 📡 Endpoints da API REST / API Reference

| Método | Endpoint | Descrição / Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Diagnóstico de integridade do servidor / Server health check. |
| `POST` | `/api/auth/google` | Validação de credencial JWT / Token Google e checagem na lista VIP. |
| `GET` | `/api/auth/google/url` | Geração da URL de autenticação Google OAuth 2.0. |
| `GET` | `/api/verify-auth` | Validação de sessão do usuário logado. |
| `GET` | `/api/dados` | Dados analíticos do efetivo (cache local com refresh automático a cada 10 min). |
| `GET` | `/api/drive/sync-status` | Status da sincronização com Google Drive e timestamp do cache. |
| `POST` | `/api/drive/sync` | Força a sincronização imediata com a base do Google Drive. |
| `GET` | `/api/database` | Consulta direta à base de dados local JSON. |
| `POST` | `/api/database` | Atualização da base de dados local JSON. |
| `POST` | `/api/chat` | Consulta conversacional em linguagem natural via **Google Gemini API**. |

---

## 🔑 Variáveis de Ambiente / Environment Setup (`.env`)

Crie o arquivo `.env` na raiz do projeto com base no modelo `.env.example`:

```env
# Porta do servidor e Host
PORT=3000
APP_URL=http://localhost:3000

# Autenticação Google OAuth 2.0 (Frontend & Backend)
VITE_GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com
ALLOWED_EMAILS=gestor1@casamilitar.pr.gov.br,gestor2@casamilitar.pr.gov.br

# Google Cloud Service Account (Integração Google Drive / Sheets API)
DRIVE_FILE_ID=SEU_SPREADSHEET_ID_EFETIVO
GOOGLE_CLIENT_EMAIL=sua-service-account@seu-projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"

# Inteligência Artificial Generativa
GEMINI_API_KEY=sua-chave-api-gemini
```

---

## 🚀 Instalação e Execução / Getting Started

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/alisson-schmidt/Dashboard.git
cd Dashboard
npm install
```

### 2. Modo Desenvolvimento
```bash
npm run dev
```
Acesse localmente em `http://localhost:3000` ou pelo IP da rede interna `http://<IP_DO_SERVIDOR>:3000`.

### 3. Build de Produção
```bash
npm run build
npm run start
```

---

## ⚙️ Execução como Serviço em Servidores Governamentais

### Linux (`systemd`)
Crie o arquivo `/etc/systemd/system/efetivo-cm.service`:
```ini
[Unit]
Description=Painel do Efetivo Casa Militar - Backend & Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/batalhao-insight
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
Habilite e inicialize o serviço:
```bash
sudo systemctl daemon-reload
sudo systemctl enable efetivo-cm
sudo systemctl start efetivo-cm
```

### Windows Server (via PM2)
```cmd
npm install -g pm2
pm2 start dist/server.cjs --name "efetivo-cm"
pm2 save
pm2 startup
```

---

## 👨‍💻 Autor e Arquiteto da Solução / Author

**Alisson Schmidt Diniz**  
*Assessor – Símbolo FCE-13, Divisão Administrativa da Casa Militar da Governadoria do Paraná*  
*Policial Militar do Estado do Paraná (PMPR)*  
*Especialista em Governança de Pessoal e IA*

---

## 📄 Licença / License
Este projeto é distribuído sob a licença **MIT**. Veja o arquivo `LICENSE` para mais informações.
