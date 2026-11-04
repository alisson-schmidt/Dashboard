# Efetivo CM — Painel de Gestão e Dashboard do Efetivo Casa Militar (Arquitetura Cliente-Servidor)

Aplicação web e servidor local Express em Node.js para gestão, consulta e visualização analítica do efetivo da Casa Militar do Governo do Estado do Paraná.

---

## 🏛️ Arquitetura Cliente-Servidor (Hospedagem Local & Rede Interna)

A aplicação foi adaptada para rodar localmente ou em um servidor da rede interna (Windows Server ou Linux):

- **Frontend (Cliente)**: Interface SPA reativa desenvolvida em React 19, Vite, Tailwind CSS, Recharts, Lucide Icons e Motion.
- **Backend (Servidor)**: Servidor REST em **Node.js com Express**.
  - **Acesso na Rede Interna**: O servidor escuta no host `0.0.0.0` e porta `3000`, permitindo o acesso via `http://localhost:3000` e também pelo IP do servidor na rede local (ex: `http://192.168.1.100:3000`).
  - **Sincronização com Google Drive**: Conexão nativa via Google Drive API v3 e Sheets API v4 utilizando Conta de Serviço (Service Account JWT).
  - **Sincronização Automática a cada 10 Minutos**: Um job em segundo plano busca atualizações do arquivo configurado no Google Drive a cada 10 minutos (`600.000 ms`).
  - **Cache Local na Memória e em Disco**: Evita requisições desnecessárias à API do Google Drive retornando os dados armazenados em cache local (`src/data/efetivo.json`).
  - **Autenticação e Lista VIP**: Validação via Google OAuth 2.0 (Google Sign-In / Identity Services). O acesso às rotas da API e ao painel é liberado exclusivamente para e-mails cadastrados na lista de usuários autorizados (`ALLOWED_EMAILS` ou lista VIP interna).

---

## 📁 Estrutura Completa do Projeto

```text
├── server.ts                # Backend Express (Autenticação, Sincronização Google Drive, Cache, API REST e Servidor de Arquivos)
├── index.html               # Ponto de entrada do Frontend
├── package.json             # Dependências Node.js e scripts NPM
├── .env.example             # Modelo com variáveis de ambiente do servidor
├── .env                     # Variáveis de ambiente locais (Chaves de API, OAuth, Service Account, Emails)
├── firebase-applet-config.json # Configuração de referência do applet
├── vite.config.ts           # Configuração de compilação do Vite
├── tsconfig.json            # Configurações do TypeScript
├── src/
│   ├── main.tsx             # Ponto de entrada React
│   ├── router.tsx           # Roteamento TanStack Router
│   ├── routes/              # Páginas e rotas da aplicação
│   ├── components/          # Componentes visuais do Dashboard (Filtros, Tabelas, Gráficos, Chat IA)
│   └── data/
│       └── efetivo.json     # Cache local do efetivo
└── dist/                    # Build de produção gerado pelo `npm run build` (contém `server.cjs` e frontend estático)
```

---

## 🔑 Configuração de Variáveis de Ambiente (`.env`)

Crie ou edite o arquivo `.env` na raiz do projeto conforme a estrutura do `.env.example`:

```env
# Porta do servidor (Padrão: 3000)
PORT=3000

# URL pública da aplicação ou IP da máquina na rede (ex: http://192.168.1.100:3000)
APP_URL=http://localhost:3000

# Google OAuth Client ID para autenticação dos usuários no frontend
VITE_GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com

# Lista de e-mails autorizados separados por vírgula
ALLOWED_EMAILS=admin@exemplo.gov.br,usuario@exemplo.gov.br

# Google Drive / Sheets Integration (Service Account)
DRIVE_FILE_ID=SEU_SPREADSHEET_ID_EFETIVO
GOOGLE_CLIENT_EMAIL=leitor-drive@seu-projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"

# Gemini API Key (para o assistente IA do painel)
GEMINI_API_KEY=
```

---

## 🚀 Guia de Instalação e Execução (Windows e Linux)

### Pré-requisitos
- **Node.js**: Versão 18.0.0 ou superior (recomendado Node.js 20 LTS).
- **NPM**: Incluído junto com o Node.js.

---

### 💻 Passo 1: Clonar/Copiar o Projeto e Instalar Dependências

Abra o terminal (Prompt de Comando / PowerShell no Windows ou Terminal no Linux) e execute:

```bash
cd caminho/para/o/projeto
npm install
```

---

### 🛠️ Modo Desenvolvimento

Para rodar com suporte a Hot Reloading e servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:
- **Localmente**: `http://localhost:3000`
- **Na Rede Interna**: `http://<IP_DO_SERVIDOR>:3000`

---

### 📦 Modo Produção (Recomendado para Servidores)

#### 1. Gerar o Build de Produção
O comando de build compila o frontend estático do Vite e empacota o backend Express em um único arquivo CommonJS executável (`dist/server.cjs`):

```bash
npm run build
```

#### 2. Iniciar o Servidor em Produção

```bash
npm run start
```

---

## 🐧 Configuração como Serviço no Linux (systemd)

Para manter o backend rodando continuamente no Linux:

1. Crie o arquivo `/etc/systemd/system/efetivo-cm.service`:
   ```ini
   [Unit]
   Description=Efetivo Casa Militar - Backend & Frontend
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
2. Ative e inicie o serviço:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable efetivo-cm
   sudo systemctl start efetivo-cm
   ```

---

## 🪟 Configuração como Serviço no Windows (NSSM ou PM2)

No Windows Server, você pode usar o **NSSM** (Non-Sucking Service Manager) ou o **PM2**:

### Opção com PM2:
```cmd
npm install -g pm2
pm2 start dist/server.cjs --name "efetivo-cm"
pm2 save
pm2 startup
```

---

## 📡 Endpoints da API REST

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Verifica a integridade do servidor. |
| `POST` | `/api/auth/google` | Autentica a credencial JWT / Token Google e valida o e-mail na lista permitida. |
| `GET` | `/api/auth/google/url` | Retorna a URL para login OAuth 2.0. |
| `GET` | `/api/verify-auth` | Valida a sessão do usuário. |
| `GET` | `/api/dados` | Retorna os dados do efetivo/planilha do Google Drive (usa o cache local com refresh a cada 10 min). |
| `GET` | `/api/drive/sync-status` | Retorna o status da sincronização com o Google Drive e horário do último cache. |
| `POST` | `/api/drive/sync` | Força a sincronização imediata com o Google Drive. |
| `GET` | `/api/database` | Obtém o JSON local da base de dados. |
| `POST` | `/api/database` | Atualiza a base de dados local. |
| `POST` | `/api/chat` | Interage com o assistente inteligente alimentado por Gemini AI. |

