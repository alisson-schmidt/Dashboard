import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { initAuth, googleSignIn, logout, getAccessToken } from "../lib/googleAuth";
import { fetchSpreadsheetData, createGoogleSpreadsheet } from "../lib/googleSheets";
import {
  syncProjectToDriveFolder,
  createDriveFolder,
  exportHtmlToDriveFolder,
  generateDashboardHtmlReport,
} from "../lib/googleDrive";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  FileSpreadsheet,
  Download,
  Upload,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Lock,
  FolderSync,
  Cloud,
} from "lucide-react";

interface GoogleSheetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentData: any[];
  onUpdateDatabase: (newData: any) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  open,
  onOpenChange,
  currentData,
  onUpdateDatabase,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<"import" | "export" | "sync">("import");

  // Import state
  const [sheetInput, setSheetInput] = useState(
    "https://docs.google.com/spreadsheets/d/SEU_SPREADSHEET_ID_EFETIVO/"
  );
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    spreadsheetTitle: string;
    sheetName: string;
    records: any[];
  } | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  // Export state
  const [exportTitle, setExportTitle] = useState(
    `Efetivo Casa Militar - ${new Date().toLocaleDateString("pt-BR")}`
  );
  const [isExporting, setIsExporting] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  // HTML Export state
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [exportedHtmlUrl, setExportedHtmlUrl] = useState<string | null>(null);
  const [htmlFileName, setHtmlFileName] = useState<string | null>(null);

  // Drive Sync state
  const [driveFolderInput, setDriveFolderInput] = useState(
    "https://drive.google.com/drive/folders/1RQuMRx67fwRdJ-k6fTf8VF44ZUaElLNp"
  );
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncedFolderUrl, setSyncedFolderUrl] = useState<string | null>(null);

  // Error & Info state
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setStatusMessage({
          type: "success",
          text: `Conectado com sucesso como ${result.user.displayName || result.user.email}`,
        });
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Erro ao conectar com a conta do Google.",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setImportResult(null);
    setCreatedUrl(null);
    setStatusMessage({
      type: "info",
      text: "Sessão encerrada.",
    });
  };

  const applyDatabaseUpdate = async (records: any[], title: string) => {
    const fullPayload = {
      "EFETIVO TOTAL CM": records,
    };

    // 1. Save to server API (/api/database)
    try {
      await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPayload),
      });
    } catch (err) {
      console.error("Failed to save to /api/database", err);
    }

    // 2. Save to client localStorage
    try {
      localStorage.setItem("efetivo_custom_database", JSON.stringify(fullPayload));
    } catch (err) {
      console.error("Failed to save to localStorage", err);
    }

    // 3. Update dashboard state live in parent component
    onUpdateDatabase(fullPayload);
  };

  const executeImport = async (urlToImport: string) => {
    if (!urlToImport.trim()) {
      setStatusMessage({
        type: "error",
        text: "Por favor, informe a URL ou ID da planilha do Google Sheets.",
      });
      return;
    }

    const currentToken = token || (await getAccessToken());

    setIsImporting(true);
    setStatusMessage(null);
    setImportResult(null);

    try {
      const data = await fetchSpreadsheetData(urlToImport, currentToken);
      
      if (!data.records || data.records.length === 0) {
        throw new Error("Nenhum registro foi encontrado nesta planilha.");
      }

      setImportResult({
        spreadsheetTitle: data.spreadsheetTitle,
        sheetName: data.sheetName,
        records: data.records,
      });

      // Automatically apply to Dashboard, server & localStorage immediately!
      await applyDatabaseUpdate(data.records, data.spreadsheetTitle);

      setShowImportConfirm(true);
      setStatusMessage({
        type: "success",
        text: `Dashboard atualizado com sucesso! ${data.records.length} militares carregados da planilha "${data.spreadsheetTitle}".`,
      });
    } catch (err: any) {
      console.error("Import error:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Não foi possível carregar a planilha. Se ela for privada, conecte sua conta Google acima ou altere as permissões no Google Drive para 'Qualquer pessoa com o link'.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFetchSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeImport(sheetInput);
  };

  const confirmImport = async () => {
    if (!importResult) return;
    await applyDatabaseUpdate(importResult.records, importResult.spreadsheetTitle);
    setShowImportConfirm(false);
    setStatusMessage({
      type: "success",
      text: `Dashboard e Banco de Dados re-sincronizados com sucesso! ${importResult.records.length} registros ativos.`,
    });
  };

  const handleExport = async () => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      setStatusMessage({
        type: "error",
        text: "Sua sessão expirou. Por favor, faça login no Google novamente.",
      });
      return;
    }

    setIsExporting(true);
    setStatusMessage(null);
    setCreatedUrl(null);

    try {
      const result = await createGoogleSpreadsheet(
        exportTitle,
        currentData,
        currentToken
      );
      setCreatedUrl(result.spreadsheetUrl);
      setShowExportConfirm(false);
      setStatusMessage({
        type: "success",
        text: `Planilha "${exportTitle}" criada no seu Google Drive com ${currentData.length} registros!`,
      });
    } catch (err: any) {
      console.error("Export error:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Erro ao exportar para o Google Sheets.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHtmlToDrive = async () => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      setStatusMessage({
        type: "error",
        text: "Sua sessão expirou. Por favor, faça login no Google novamente.",
      });
      return;
    }

    setIsExportingHtml(true);
    setStatusMessage(null);
    setExportedHtmlUrl(null);

    try {
      const res = await exportHtmlToDriveFolder(
        driveFolderInput,
        currentToken,
        currentData,
        `Relatório Efetivo Militar - Casa Militar (${new Date().toLocaleDateString("pt-BR")})`
      );

      setExportedHtmlUrl(res.fileUrl);
      setHtmlFileName(res.fileName);
      setStatusMessage({
        type: "success",
        text: `Relatório HTML "${res.fileName}" exportado com sucesso para o seu Google Drive!`,
      });
    } catch (err: any) {
      console.error("HTML Export error:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Erro ao exportar relatório HTML para o Google Drive.",
      });
    } finally {
      setIsExportingHtml(false);
    }
  };

  const handleDownloadHtmlLocal = () => {
    const html = generateDashboardHtmlReport(currentData);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_Efetivo_CasaMilitar_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({
      type: "success",
      text: "Relatório HTML gerado e baixado para o seu computador!",
    });
  };

  const handleSyncDrive = async () => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      setStatusMessage({
        type: "error",
        text: "Sua sessão expirou. Por favor, faça login no Google novamente.",
      });
      return;
    }

    const trimmedInput = driveFolderInput.trim();
    if (!trimmedInput) {
      setStatusMessage({
        type: "error",
        text: "Informe a URL ou ID da pasta do Google Drive.",
      });
      return;
    }

    // Check if user entered a Google Sheets URL instead of a Drive Folder URL
    if (trimmedInput.includes("/spreadsheets/") || trimmedInput.includes("docs.google.com/spreadsheets")) {
      setSheetInput(trimmedInput);
      setActiveTab("import");
      setStatusMessage({
        type: "info",
        text: "O link informado é de uma planilha do Google Sheets! Redirecionando para importação de dados...",
      });
      await executeImport(trimmedInput);
      return;
    }

    setIsSyncingDrive(true);
    setStatusMessage(null);
    setSyncProgress("Iniciando sincronização dos arquivos...");
    setSyncedFolderUrl(null);

    try {
      const res = await syncProjectToDriveFolder(
        driveFolderInput,
        currentToken,
        (msg) => setSyncProgress(msg)
      );

      setSyncedFolderUrl(res.folderUrl);
      setStatusMessage({
        type: "success",
        text: `Sincronização concluída! ${res.uploadedFiles} arquivos do projeto foram salvos na pasta informada no Google Drive.`,
      });
    } catch (err: any) {
      console.error("Drive sync error:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Erro ao sincronizar arquivos com o Google Drive.",
      });
    } finally {
      setIsSyncingDrive(false);
      setSyncProgress("");
    }
  };

  const handleCreateNewDriveFolder = async () => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      setStatusMessage({
        type: "error",
        text: "Sua sessão expirou. Por favor, faça login no Google novamente.",
      });
      return;
    }

    setIsSyncingDrive(true);
    setStatusMessage(null);
    setSyncProgress("Criando nova pasta no seu Google Drive...");
    setSyncedFolderUrl(null);

    try {
      const folderName = `Efetivo_CasaMilitar_Backup_${new Date().toISOString().slice(0, 10)}`;
      const folder = await createDriveFolder(folderName, currentToken);
      setDriveFolderInput(folder.webViewLink);
      setSyncProgress(`Pasta "${folderName}" criada. Enviando arquivos...`);

      const res = await syncProjectToDriveFolder(
        folder.id,
        currentToken,
        (msg) => setSyncProgress(msg)
      );

      setSyncedFolderUrl(res.folderUrl);
      setStatusMessage({
        type: "success",
        text: `Nova pasta "${folderName}" criada com sucesso e ${res.uploadedFiles} arquivos do projeto foram sincronizados!`,
      });
    } catch (err: any) {
      console.error("Create folder error:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Erro ao criar nova pasta no Google Drive.",
      });
    } finally {
      setIsSyncingDrive(false);
      setSyncProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#161618] border border-[#ececed]/20 text-[#ececed] font-sans">
        <DialogHeader className="border-b border-[#ececed]/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-syne text-xl font-bold text-[#ececed] flex items-center gap-2">
                Integração Google Sheets
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  Google Workspace
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#ececed]/60 mt-0.5">
                Sincronize o efetivo militar diretamente com suas planilhas do Google Drive
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User Auth Banner */}
        <div className="p-4 rounded-lg bg-[#1e1e22] border border-[#ececed]/10 my-2">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "Google Account"}
                    className="w-9 h-9 rounded-full border border-emerald-500/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/40">
                    {(user.displayName || user.email || "G")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-[#ececed] flex items-center gap-2">
                    {user.displayName || "Usuário Google"}
                    <span className="inline-flex items-center gap-1 text-[11px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Conectado
                    </span>
                  </div>
                  <div className="text-xs text-[#ececed]/60">{user.email}</div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-[#ececed]/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1.5" /> Sair
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-[#ececed] flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-400" /> Autenticação necessária
                </h4>
                <p className="text-xs text-[#ececed]/60 mt-1 max-w-md">
                  Conecte sua conta do Google para ler ou criar planilhas no Google Drive com permissão do usuário.
                </p>
              </div>

              <Button
                onClick={handleSignIn}
                disabled={isLoggingIn}
                className="bg-white hover:bg-neutral-100 text-neutral-900 font-medium px-4 py-2 rounded-md transition-all shadow-sm flex items-center gap-2.5 whitespace-nowrap border border-neutral-300"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-700" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                  </svg>
                )}
                Conectar com Google
              </Button>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-md text-xs border flex items-start gap-2.5 ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : statusMessage.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-300"
                : "bg-blue-500/10 border-blue-500/30 text-blue-300"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : statusMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
            )}
            <div className="flex-1">{statusMessage.text}</div>
          </div>
        )}

        {/* Action Tabs */}
        <div className="mt-2 space-y-4">
          <div className="flex border-b border-[#ececed]/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab("import");
                setStatusMessage(null);
              }}
              className={`py-2.5 px-4 font-syne text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === "import"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-[#ececed]/50 hover:text-[#ececed]"
              } flex items-center gap-2`}
            >
              <Download className="w-4 h-4" /> Importar Sheets
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("export");
                setStatusMessage(null);
              }}
              className={`py-2.5 px-4 font-syne text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === "export"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-[#ececed]/50 hover:text-[#ececed]"
              } flex items-center gap-2`}
            >
              <Upload className="w-4 h-4" /> Exportar Sheets
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("sync");
                setStatusMessage(null);
              }}
              className={`py-2.5 px-4 font-syne text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === "sync"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-[#ececed]/50 hover:text-[#ececed]"
              } flex items-center gap-2`}
            >
              <FolderSync className="w-4 h-4" /> Sincronizar Google Drive
            </button>
          </div>

            {/* TAB: DRIVE SYNC */}
            {activeTab === "sync" && (
              <div className="space-y-4 py-2">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#ececed]/80 mb-1.5">
                      URL ou ID da Pasta do Google Drive
                    </label>
                    <Input
                      type="text"
                      value={driveFolderInput}
                      onChange={(e) => setDriveFolderInput(e.target.value)}
                      className="bg-[#1e1e22] border-[#ececed]/20 text-xs text-[#ececed] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                    <p className="text-[11px] text-[#ececed]/40 mt-1">
                      Pasta de destino para envio direto dos arquivos e código-fonte do projeto.
                    </p>
                  </div>

                  <div className="p-3.5 rounded bg-[#1e1e22] border border-[#ececed]/10 text-xs space-y-1.5">
                    <div className="flex justify-between text-[#ececed]/80">
                      <span>Destino:</span>
                      <span className="font-mono text-emerald-400 truncate max-w-[280px]">
                        {driveFolderInput}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#ececed]/80">
                      <span>Arquivos a enviar:</span>
                      <span className="font-mono text-emerald-400">
                        Código do Projeto + efetivo.json
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={handleSyncDrive}
                      disabled={isSyncingDrive || !driveFolderInput.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 rounded transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSyncingDrive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>{syncProgress || "Sincronizando..."}</span>
                        </>
                      ) : (
                        <>
                          <FolderSync className="w-4 h-4" />
                          <span>Enviar p/ Pasta Específica</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={handleCreateNewDriveFolder}
                      disabled={isSyncingDrive}
                      variant="outline"
                      className="w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 font-semibold text-xs py-2.5 rounded transition-all flex items-center justify-center gap-2"
                    >
                      <Cloud className="w-4 h-4 text-emerald-400" />
                      <span>Criar Nova Pasta no Meu Drive</span>
                    </Button>
                  </div>
                </div>

                {/* Synced Success Link */}
                {syncedFolderUrl && (
                  <div className="p-4 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-center space-y-3 mt-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-white font-syne">
                        Arquivos Sincronizados com Sucesso!
                      </h4>
                      <p className="text-xs text-[#ececed]/70 mt-0.5">
                        Os arquivos do projeto foram enviados para a pasta configurada no seu Google Drive.
                      </p>
                    </div>

                    <a
                      href={syncedFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs px-5 py-2.5 rounded-md transition-all shadow-md mt-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Abrir Pasta no Google Drive
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* TAB: IMPORT */}
            {activeTab === "import" && (
              <div className="space-y-4 py-2">
                <form onSubmit={handleFetchSheet} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#ececed]/80 mb-1.5">
                      URL ou ID da Planilha do Google
                    </label>
                    <Input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit..."
                      value={sheetInput}
                      onChange={(e) => setSheetInput(e.target.value)}
                      className="bg-[#1e1e22] border-[#ececed]/20 text-xs text-[#ececed] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] text-[#ececed]/40">
                        Cole o link da sua planilha com os dados do efetivo. A primeira aba será lida automaticamente.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const userUrl = "https://docs.google.com/spreadsheets/d/SEU_SPREADSHEET_ID_EFETIVO/";
                          setSheetInput(userUrl);
                          executeImport(userUrl);
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 underline shrink-0 ml-2"
                      >
                        Usar planilha modelo
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isImporting || !sheetInput.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 rounded transition-all flex items-center justify-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando Planilha...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> Carregar Planilha do Google
                      </>
                    )}
                  </Button>
                </form>

                {/* Import Confirmation Step */}
                {showImportConfirm && importResult && (
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-3 mt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-emerald-300 font-syne">
                          Confirmar Atualização de Banco de Dados
                        </h4>
                        <p className="text-xs text-[#ececed]/70 mt-1">
                          Planilha: <strong className="text-white">{importResult.spreadsheetTitle}</strong> ({importResult.sheetName})
                        </p>
                        <p className="text-xs text-[#ececed]/70">
                          Total de militares encontrados: <strong className="text-emerald-400">{importResult.records.length} registros</strong>
                        </p>
                      </div>
                    </div>

                    {/* Preview first 3 records */}
                    <div className="bg-[#161618] p-2.5 rounded border border-[#ececed]/10 text-[11px] max-h-32 overflow-y-auto font-mono text-[#ececed]/80 space-y-1">
                      {importResult.records.slice(0, 3).map((r, idx) => (
                        <div key={idx} className="truncate">
                          #{r["Nº"] || idx + 1} - {r["POSTO/GRAD.  CARGO"] || r["POSTO/GRAD. CARGO"] || r["CARGO"] || ""} {r["NOME"] || r["Nome"] || "—"} ({r["SIGLA DIVISÃO"] || r["DIVISÃO"] || "—"})
                        </div>
                      ))}
                      {importResult.records.length > 3 && (
                        <div className="text-[#ececed]/40 italic pt-1">
                          ... +{importResult.records.length - 3} outros militares
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowImportConfirm(false);
                          setImportResult(null);
                        }}
                        className="text-xs text-[#ececed]/60 hover:text-white"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={confirmImport}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4"
                      >
                        Substituir Efetivo Atual ({importResult.records.length} registros)
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: EXPORT */}
            {activeTab === "export" && (
              <div className="space-y-5 py-2">
                {/* HTML Export Card */}
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      HTML
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white font-syne">
                        Exportar Relatório HTML para Visualização
                      </h4>
                      <p className="text-xs text-[#ececed]/70">
                        Gere um relatório HTML interativo completo e salve direto no seu Google Drive ou faça download.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={handleExportHtmlToDrive}
                      disabled={isExportingHtml}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded transition-all flex items-center justify-center gap-2"
                    >
                      {isExportingHtml ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Enviando p/ Drive...
                        </>
                      ) : (
                        <>
                          <Cloud className="w-4 h-4" /> Salvar HTML no Google Drive
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={handleDownloadHtmlLocal}
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 font-bold text-xs py-2.5 rounded transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Baixar HTML Local
                    </Button>
                  </div>

                  {exportedHtmlUrl && (
                    <div className="p-3 rounded bg-emerald-500/20 border border-emerald-500/40 text-center space-y-2 mt-2">
                      <p className="text-xs font-semibold text-emerald-300">
                        Relatório HTML "{htmlFileName}" enviado para seu Google Drive!
                      </p>
                      <a
                        href={exportedHtmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 font-bold px-3 py-1.5 rounded transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir no Google Drive
                      </a>
                    </div>
                  )}
                </div>

                {/* Google Sheets Export */}
                <div className="p-4 rounded-lg bg-[#1e1e22] border border-[#ececed]/10 space-y-3">
                  <h4 className="text-sm font-bold text-white font-syne flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Criar Planilha do Google Sheets
                  </h4>

                  <div>
                    <label className="block text-xs font-medium text-[#ececed]/80 mb-1.5">
                      Título da Nova Planilha
                    </label>
                    <Input
                      type="text"
                      value={exportTitle}
                      onChange={(e) => setExportTitle(e.target.value)}
                      className="bg-[#161618] border-[#ececed]/20 text-xs text-[#ececed] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 rounded bg-[#161618] border border-[#ececed]/10 text-xs text-[#ececed]/70 flex justify-between items-center">
                    <span>Registros a exportar:</span>
                    <strong className="text-emerald-400 font-mono text-sm">{currentData.length} militares</strong>
                  </div>

                  {!showExportConfirm && !createdUrl && (
                    <Button
                      type="button"
                      onClick={() => setShowExportConfirm(true)}
                      disabled={isExporting}
                      className="w-full bg-[#2a2a30] hover:bg-[#323238] text-white font-semibold text-xs py-2.5 rounded transition-all flex items-center justify-center gap-2 border border-[#ececed]/20"
                    >
                      <Upload className="w-4 h-4 text-emerald-400" /> Criar Planilha no Google Drive
                    </Button>
                  )}

                  {/* Export Confirmation Box */}
                  {showExportConfirm && !createdUrl && (
                    <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2.5 mt-2">
                      <h4 className="text-xs font-bold text-amber-300 font-syne">
                        Confirmar Criação de Planilha
                      </h4>
                      <p className="text-xs text-[#ececed]/80">
                        Uma nova planilha chamada <strong className="text-white">"{exportTitle}"</strong> será criada no seu Google Drive.
                      </p>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowExportConfirm(false)}
                          className="text-xs text-[#ececed]/60 hover:text-white"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleExport}
                          disabled={isExporting}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4"
                        >
                          {isExporting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Criando...
                            </>
                          ) : (
                            "Confirmar e Exportar"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Created URL Result */}
                  {createdUrl && (
                    <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-center space-y-2 mt-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                      <div>
                        <h4 className="text-xs font-bold text-white font-syne">
                          Planilha Criada com Sucesso!
                        </h4>
                      </div>

                      <a
                        href={createdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs px-4 py-2 rounded-md transition-all shadow-md"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir no Google Sheets
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
