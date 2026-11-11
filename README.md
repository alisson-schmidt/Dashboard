Public Safety Workforce Governance & Tactical Readiness Dashboard

Painel de Gestão e Análise Operacional do Efetivo — Casa Militar da Governadoria

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Frontend: React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind-blue)
![Backend: Node.js Express](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20TypeScript-green)
![Cloud & APIs: Google Cloud](https://img.shields.io/badge/Integrations-Google%20Drive%20%26%20Sheets%20API-orange)
![AI Engine: Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%20API-blueviolet)

📌 Visão Geral / Executive Overview

EN: A full-stack, client-server web application and analytics platform engineered for strategic personnel management, tactical readiness tracking, operational shift governance, and automated shift schedule management (Escalas) at the Military House (Casa Militar) of the State Government of Paraná. Powered by React 19, Node.js/Express, Google Workspace APIs, and Google Gemini AI, the system streamlines troop readiness, enables rapid shift generation with instant WhatsApp/email sharing, clean Excel exports, and conversational data intelligence.

PT: Aplicação web full-stack (cliente-servidor) voltada à gestão analítica, governança de escalas e prontidão operacional do efetivo da Casa Militar da Governadoria do Paraná. Desenvolvida com React 19, Node.js/Express, integrações nativas com Google Drive/Sheets API, exportação automatizada para Excel e inteligência artificial Google Gemini, a plataforma elimina retrabalho burocrático, automatiza a confecção de escalas de serviço e acelera a tomada de decisão estratégica do comando.

📅 Módulo de Escalas Operacionais / Shift Schedule Governance

O sistema conta com um módulo dedicado para controle, confecção e distribuição de escalas de serviço, acessível diretamente pela navegação lateral:

Cadastrar Escala: Permite a seleção do período/turno de trabalho (expediente, 12x36, 24x72, etc.) e o vínculo direto dos militares cadastrados na planilha sincronizada do Google Drive.

Preview e Cópia Rápida (Finalização): Gera instantaneamente a pré-visualização organizada da escala com funcionalidade de cópia em texto formatado para envio direto via WhatsApp, Telegram ou e-mail institucional.

Exportação Profissional em Excel: Emite relatórios de escala formatados em arquivo .xlsx, com design moderno (linha zebrada, cabeçalhos institucionais e alinhamento automatizado).

🏛️ Arquitetura de Software e Tecnologias / System Architecture

├── Frontend (Client SPA)    : React 19, Vite, TanStack Router, Tailwind CSS, Recharts, Lucide Icons, SheetJS (xlsx)
├── Backend (REST Server)    : Node.js, Express, TypeScript (server.ts -> dist/server.cjs)
├── Data Integration / ETL   : Google Drive API v3 & Sheets API v4 (Service Account JWT authentication)
├── Resilience & Caching     : Dual-layer cache (In-Memory + Local JSON Disk Cache with 10-min auto-sync)
├── Security & Access        : Google OAuth 2.0 (Identity Services) + Institutional Whitelist (ALLOWED_EMAILS)
├── Generative AI Assistant  : Native integration with Google Gemini API (/api/chat endpoint)
└── Deployment & DevOps      : Host 0.0.0.0:3000, Linux systemd daemon (efetivo-cm.service) / Windows PM2


📁 Estrutura de Diretórios / Directory Structure

├── server.ts                    # Backend Express (Autenticação, Sincronização Google, Cache e API REST)
├── index.html                   # Ponto de entrada SPA (Frontend)
├── package.json                 # Dependências Node.js e scripts NPM
├── .env.example                 # Template de variáveis de ambiente seguras
├── vite.config.ts               # Configuração de compilação do Vite
├── tsconfig.json                # Configurações do compilador TypeScript
├── src/
│   ├── main.tsx                 # Ponto de entrada React
│   ├── router.tsx               # Roteamento TanStack Router
│   ├── routes/                  # Telas e rotas da aplicação (Home, Escalas, Analytics)
│   ├── components/              # Componentes de UI (Escalas, Filtros, Tabelas, Métricas e Chat IA)
│   │   ├── Escalas/             # Form, Preview, Exportador Excel e Accordion Sidebar
│   └── data/
│       └── efetivo.json         # Cache local do efetivo (offline fallback)
└── dist/                        # Build de produção (server.cjs + assets estáticos)


📡 Endpoints da API REST / API Reference

Método

Endpoint

Descrição / Description

GET

/api/health

Diagnóstico de integridade do servidor / Server health check.

POST

/api/auth/google

Validação de credencial JWT / Token Google e checagem na lista VIP.

GET

/api/auth/google/url

Geração da URL de autenticação Google OAuth 2.0.

GET

/api/verify-auth

Validação de sessão do usuário logado.

GET

/api/dados

Dados analíticos do efetivo (cache local com refresh automático a cada 10 min).

GET

/api/escalas

Consulta o histórico de escalas cadastradas no sistema.

POST

/api/escalas

Persiste ou atualiza uma nova escala finalizada.

GET

/api/drive/sync-status

Status da sincronização com Google Drive e timestamp do cache.

POST

/api/drive/sync

Força a sincronização imediata com a base do Google Drive.

GET

/api/database

Consulta direta à base de dados local JSON.

POST

/api/database

Atualização da base de dados local JSON.

POST

/api/chat

Consulta conversacional em linguagem natural via Google Gemini API.

🔑 Variáveis de Ambiente / Environment Setup (.env)

Crie o arquivo .env na raiz do projeto com base no modelo .env.example:

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


🚀 Instalação e Execução / Getting Started

1. Clonar e Instalar Dependências

git clone https://github.com/alisson-schmidt/Dashboard.git
cd Dashboard
npm install


2. Modo Desenvolvimento

npm run dev


Acesse localmente em http://localhost:3000 ou pelo IP da rede interna http://<IP_DO_SERVIDOR>:3000.

3. Build de Produção

npm run build
npm run start


⚙️ Execução como Serviço em Servidores Governamentais

Linux (systemd)

Crie o arquivo /etc/systemd/system/efetivo-cm.service:

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


Habilite e inicialize o serviço:

sudo systemctl daemon-reload
sudo systemctl enable efetivo-cm
sudo systemctl start efetivo-cm


Windows Server (via PM2)

npm install -g pm2
pm2 start dist/server.cjs --name "efetivo-cm"
pm2 save
pm2 startup


👨‍💻 Autor e Arquiteto da Solução / Author

Alisson Schmidt DinizAssessor – Símbolo FCE-13, Divisão Administrativa da Casa Militar da Governadoria do ParanáPolicial Militar do Estado do Paraná (PMPR)Especialista em Governança de Pessoal e IA

📄 Licença / License

Este projeto é distribuído sob a licença MIT. Veja o arquivo LICENSE para mais informações.
