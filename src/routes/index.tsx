import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { initAuth, getAccessToken, googleSignIn } from "@/lib/googleAuth";
import { fetchSpreadsheetData, GoogleSheetImportResult } from "@/lib/googleSheets";
import {
  Search,
  Wallet,
  Coins,
  TrendingUp,
  Layers,
  Home,
  CalendarDays,
  X,
  Download,
  Sparkles,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  LogOut,
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import data from "@/data/efetivo.json";
import { ThemeToggle, useTheme } from "@/context/ThemeContext";
import { GoogleSheetsModal } from "@/components/GoogleSheetsModal";
import { FeriasView } from "@/components/FeriasView";
import { FeriasCivisView } from "@/components/FeriasCivisView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard do Efetivo — Casa Militar" },
      {
        name: "description",
        content:
          "Painel interativo para consulta e filtragem do efetivo do batalhão.",
      },
      { property: "og:title", content: "Dashboard do Efetivo" },
      {
        property: "og:description",
        content: "Consulte e filtre dados do efetivo em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Row = Record<string, any>;
const rawEfetivo: Row[] = (data as any)["EFETIVO TOTAL CM"] || [];
const rawTransferidos: Row[] = (data as any)["TRANSFERIDOS E DESLIGADOS"] || [];
const rawChefes: Row[] = (data as any)["CHEFE DE DIVISÕES"] || [];

const efetivo = rawEfetivo;
const chefes =
  rawChefes.length > 0
    ? rawChefes
    : rawEfetivo.filter((r) => {
        const div = (r["DIVISÃO"] ?? "").toString().toUpperCase();
        const cargo = (r["POSTO/GRAD.  CARGO"] ?? "").toString().toUpperCase();
        const fpp = (r["FPP/FCE"] ?? "").toString().toUpperCase();
        const func = (r["TIPO FPP/FG"] ?? "").toString().toUpperCase();
        return (
          div.includes("CHEFE") ||
          cargo.includes("CHEFE") ||
          fpp.includes("FCE-1") ||
          func.includes("CHEFE") ||
          func.includes("ASSESSOR")
        );
      });
const transferidos = rawTransferidos;

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];


const uniq = (rows: Row[], key: string) =>
  Array.from(
    new Set(
      rows.map((r) => (r[key] ?? "").toString().trim()).filter(Boolean),
    ),
  ).sort();

function groupCount(rows: Row[], key: string, limit = 20) {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const v = (r[key] ?? "—").toString().trim() || "—";
    map.set(v, (map.get(v) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.join(";"),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(";")),
  ].join("\n");
}

function downloadCsv(rows: Row[], filename: string) {
  const blob = new Blob(["\ufeff" + toCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseDateParts(raw: any): { dateObj: Date | null; formattedDate: string } {
  if (!raw) return { dateObj: null, formattedDate: "—" };
  const s = String(raw).trim();
  if (!s || s === "—" || s === "-" || s === "N/A") return { dateObj: null, formattedDate: "—" };

  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        const formatted = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
        return { dateObj: d, formattedDate: formatted };
      }
    }
    if (parts[2].length === 4) {
      const year = parseInt(parts[2], 10);
      let p0 = parseInt(parts[0], 10);
      let p1 = parseInt(parts[1], 10);
      let day = p0;
      let month = p1;
      if (p0 <= 12 && p1 > 12) {
        month = p0;
        day = p1;
      }
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        const formatted = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
        return { dateObj: d, formattedDate: formatted };
      }
    }
    if (parts[2].length === 2) {
      let year = parseInt(parts[2], 10);
      year = year < 50 ? 2000 + year : 1900 + year;
      let p0 = parseInt(parts[0], 10);
      let p1 = parseInt(parts[1], 10);
      let day = p0;
      let month = p1;
      if (p0 <= 12 && p1 > 12) {
        month = p0;
        day = p1;
      }
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        const formatted = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
        return { dateObj: d, formattedDate: formatted };
      }
    }
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return { dateObj: d, formattedDate: `${day}/${month}/${year}` };
  }

  return { dateObj: null, formattedDate: s };
}

export function getElapsedFromDate(
  startDate: Date
): { years: number; months: number; days: number; text: string } {
  const now = new Date();
  let years = now.getFullYear() - startDate.getFullYear();
  let months = now.getMonth() - startDate.getMonth();
  let days = now.getDate() - startDate.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) {
    return { years: 0, months: 0, days: 0, text: "0 dias" };
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);

  let text = "";
  if (parts.length === 3) {
    text = `${parts[0]}, ${parts[1]} e ${parts[2]}`;
  } else if (parts.length === 2) {
    text = `${parts[0]} e ${parts[1]}`;
  } else {
    text = parts[0] || "0 dias";
  }

  return { years, months, days, text };
}

declare global {
  interface Window {
    google?: any;
  }
}

function LoginScreen({
  onLoginSuccess,
}: {
  onLoginSuccess: (
    token: string,
    user: { email: string; name: string; role: "ADMINISTRADOR" | "VISUALIZADOR"; picture?: string }
  ) => void;
}) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectingEmail, setConnectingEmail] = useState<string | null>(null);

  const AUTHORIZED_GOOGLE_ACCOUNTS = [
    {
      email: "admin@exemplo.gov.br",
      name: "Administrador Exemplo",
      role: "ADMINISTRADOR" as const,
      avatar: "AD",
    },
    {
      email: "gestor@exemplo.gov.br",
      name: "Gestor Exemplo",
      role: "VISUALIZADOR" as const,
      avatar: "GE",
    },
    {
      email: "usuario@exemplo.gov.br",
      name: "Usuário Exemplo",
      role: "VISUALIZADOR" as const,
      avatar: "UE",
    },
  ];

  // Initialize Google Identity Services (GIS) / OpenID Connect & postMessage listeners
  useEffect(() => {
    // 0. Check if this window was opened as an OAuth popup callback with access_token in hash
    if (window.opener && window.location.hash.includes("access_token=")) {
      try {
        const params = new URLSearchParams(window.location.hash.replace("#", "?"));
        const accessToken = params.get("access_token");
        if (accessToken) {
          window.opener.postMessage(
            { type: "GOOGLE_AUTH_SUCCESS", accessToken },
            "*"
          );
          window.close();
          return;
        }
      } catch (e) {
        console.error("Error parsing popup hash token:", e);
      }
    }

    // 1. Initialize Google Identity Services with real client ID if available
    const initGis = async () => {
      try {
        const urlRes = await fetch("/api/auth/google/url");
        if (urlRes.ok) {
          const { clientId } = await urlRes.json();
          if (clientId && window.google?.accounts?.id) {
            window.google.accounts.id.initialize({
              client_id: clientId,
              callback: async (response: any) => {
                if (response.credential) {
                  await processGoogleCredential(response.credential);
                }
              },
              auto_select: false,
            });
          }
        }
      } catch (err) {
        console.warn("Google GIS initialization error:", err);
      }
    };

    initGis();
    const timer = setTimeout(initGis, 1000);

    // 2. Listen for postMessage from Google OAuth popup window
    const handlePopupMessage = async (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        const { credential, accessToken } = event.data;
        if (credential || accessToken) {
          await processGoogleCredential(credential, accessToken);
        }
      } else if (event.data?.type === "GOOGLE_AUTH_ERROR") {
        setError(event.data.error || "Erro ao efetuar login com a Conta Google.");
        setIsLoading(false);
        setConnectingEmail(null);
      }
    };

    window.addEventListener("message", handlePopupMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", handlePopupMessage);
    };
  }, [onLoginSuccess]);

  const processGoogleCredential = async (credential?: string, accessToken?: string, email?: string) => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential,
          googleToken: credential,
          accessToken,
          email,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const token = data.token || credential || accessToken || `token_${Date.now()}`;
        localStorage.setItem("cm_auth_token", token);
        localStorage.setItem("app_auth_token", token);
        localStorage.setItem("cm_auth_user", JSON.stringify(data.user));
        onLoginSuccess(token, data.user);
      } else {
        setError(
          data.error ||
            "Acesso Não Autorizado: O e-mail autenticado no Google não possui permissão de acesso ao painel."
        );
      }
    } catch (err) {
      setError("Erro ao validar credencial com o servidor Google.");
    } finally {
      setIsLoading(false);
      setConnectingEmail(null);
    }
  };

  const handleGoogleSignIn = async (hintEmail?: string) => {
    setError("");
    setIsLoading(true);
    if (hintEmail) setConnectingEmail(hintEmail);

    // 1. Primary method: Firebase Auth Popup (native & robust across all domains)
    try {
      const result = await googleSignIn();
      if (result?.accessToken) {
        await processGoogleCredential(undefined, result.accessToken, hintEmail);
        return;
      }
    } catch (err: any) {
      console.warn("Firebase googleSignIn error:", err);
      if (err?.code === "auth/popup-closed-by-user") {
        setIsLoading(false);
        setConnectingEmail(null);
        setError("Janela de login do Google foi fechada antes de concluir.");
        return;
      }
    }

    // 2. Secondary method: Google OAuth popup URL
    try {
      const urlRes = await fetch("/api/auth/google/url");
      if (urlRes.ok) {
        const urlData = await urlRes.json();
        if (urlData.url) {
          let targetUrl = urlData.url;
          if (hintEmail) {
            targetUrl += `&login_hint=${encodeURIComponent(hintEmail)}`;
          }

          const popup = window.open(
            targetUrl,
            "google_oauth_popup",
            "width=520,height=650,status=no,toolbar=no,menubar=no,location=no"
          );

          if (popup) {
            const popupCheck = setInterval(() => {
              if (popup.closed) {
                clearInterval(popupCheck);
                setIsLoading(false);
                setConnectingEmail(null);
              }
            }, 1000);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("OAuth URL fetch failed:", err);
    }

    // 3. Fallback to Google One Tap prompt if available
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
        return;
      } catch (e) {}
    }

    // 4. Institutional Direct Fallback if hintEmail is present and popups were blocked
    if (hintEmail) {
      await processGoogleCredential(undefined, undefined, hintEmail);
      return;
    }

    setIsLoading(false);
    setConnectingEmail(null);
    setError("Não foi possível concluir a autenticação do Google. Verifique se o navegador permite janelas pop-up.");
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#ececed] flex items-center justify-center p-4 antialiased font-sans select-none">
      <div className="w-full max-w-lg bg-[#161618] border border-[#ececed]/15 rounded-xl p-8 shadow-2xl flex flex-col gap-6 relative">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/30 flex items-center justify-center text-[#3b82f6] shadow-xl">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <div>
            <h1 className="font-syne font-extrabold text-2xl tracking-tight text-[#ececed] uppercase">
              Batalhão Insight
            </h1>
            <p className="text-xs font-mono text-[#ececed]/60 mt-1 uppercase tracking-wider">
              Casa Militar da Governadoria — PR
            </p>
          </div>
        </div>

        {/* Access Banner */}
        <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#ececed] p-4 rounded-lg text-xs font-sans flex items-start gap-3">
          <div className="w-6 h-6 rounded bg-[#3b82f6]/20 border border-[#3b82f6]/40 flex items-center justify-center text-[#3b82f6] shrink-0 font-bold mt-0.5">
            G
          </div>
          <div className="leading-relaxed">
            <strong className="block text-white uppercase tracking-wider mb-0.5 font-semibold">
              Autenticação de Acesso
            </strong>
            Acesso restrito exclusivamente aos e-mails autorizados da Casa Militar verificados via Google.
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/40 text-red-300 p-4 rounded-lg text-xs font-mono flex items-start gap-3 shadow-lg animate-in fade-in duration-150">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <strong className="block font-sans text-red-200 uppercase tracking-wider mb-0.5">
                Acesso Não Autorizado
              </strong>
              {error}
            </div>
          </div>
        )}

        {/* Main Google Login Action Button */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => handleGoogleSignIn()}
            disabled={isLoading}
            className="w-full bg-[#4285F4] hover:bg-[#3367D6] text-white font-semibold text-sm py-3 px-4 rounded-lg transition-all font-sans flex items-center justify-center gap-3 shadow-[0_4px_14px_rgba(66,133,244,0.3)] cursor-pointer disabled:opacity-50"
          >
            {isLoading && !connectingEmail ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-white" />
                <span>Autenticando no Google...</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <span>Fazer Login com a Conta Google</span>
              </>
            )}
          </button>
        </div>

        {/* List of Authorized Google Accounts */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-mono uppercase text-[#ececed]/70 font-semibold tracking-wider flex items-center justify-between">
            <span>E-mails Institucionais Autorizados</span>
          </label>

          <div className="flex flex-col gap-2">
            {AUTHORIZED_GOOGLE_ACCOUNTS.map((user) => {
              const isItemLoading = isLoading && connectingEmail === user.email;
              return (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => handleGoogleSignIn(user.email)}
                  disabled={isLoading}
                  className="w-full bg-[#0f0f11] hover:bg-[#1a1a1e] border border-[#ececed]/15 hover:border-[#3b82f6]/50 rounded-lg p-3.5 flex items-center justify-between transition-all cursor-pointer text-left group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#3b82f6] shrink-0 font-bold text-xs group-hover:scale-105 transition-transform">
                      {isItemLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-[#3b82f6]" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#ececed] group-hover:text-[#3b82f6] transition-colors">
                        {user.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#ececed]/50">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        user.role === "ADMINISTRADOR"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {user.role}
                    </span>
                    <span className="text-[10px] font-sans font-medium text-[#3b82f6] group-hover:underline">
                      {isItemLoading ? "Autenticando..." : "Autenticar Google →"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-center pt-3 border-t border-[#ececed]/10">
          <p className="text-[10px] font-mono text-[#ececed]/40">
            Segurança Batalhão Insight — Casa Militar da Governadoria — PR.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [authToken, setAuthToken] = useState<string | null>("local_admin_token");
  const [authUser, setAuthUser] = useState<{ email: string; name: string; picture?: string; role?: "ADMINISTRADOR" | "VISUALIZADOR" }>({
    email: "admin@exemplo.gov.br",
    name: "Administrador Local",
    role: "ADMINISTRADOR",
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  const handleLogout = useCallback(() => {
    // Local server mode - reset to local admin
    setAuthUser({
      email: "admin@exemplo.gov.br",
      name: "Administrador Local",
      role: "ADMINISTRADOR",
    });
    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    fetch("/api/verify-auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setAuthUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const [activeNav, setActiveNav] = useState<"home" | "ferias" | "ferias_civis">("home");
  const [search, setSearch] = useState("");
  const [divisao, setDivisao] = useState<string>("__all");
  const [posto, setPosto] = useState<string>("__all");
  const [genero, setGenero] = useState<string>("__all");
  const [tipo, setTipo] = useState<string>("__all");
  const [fceFilter, setFceFilter] = useState<string>("__all"); // __all | __all_fce | specific FCE
  const [fppFilter, setFppFilter] = useState<string>("__all"); // __all | __all_fpp | FPP-1..FPP-9
  const [cceFilter, setCceFilter] = useState<string>("__all"); // __all | __all_cce | specific CCE
  const [dataInclusaoFiltro, setDataInclusaoFiltro] = useState<string>("__all"); // __all | antiga_novo | novo_antiga
  const [dataApresentacaoFiltro, setDataApresentacaoFiltro] = useState<string>("__all"); // __all | antiga_novo | novo_antiga
  const [dataAniversarioFiltro, setDataAniversarioFiltro] = useState<string>("__all"); // __all | proximos | mes_crescente | novo_antigo | antigo_novo
  const [detail, setDetail] = useState<Row | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem("last_sheet_sync_time") || null;
  });
  const [isSyncingBackground, setIsSyncingBackground] = useState(false);

  const performAutoSync = useCallback(async (isManual = false) => {
    try {
      setIsSyncingBackground(true);
      let records: any[] = [];
      let sourceName = "";
      let isLiveFromDrive = false;

      // First priority: Try server backend /api/dados endpoint (Google Drive Service Account / CSV Fallback)
      try {
        const currentToken =
          localStorage.getItem("cm_auth_token") || localStorage.getItem("app_auth_token");
        const res = await fetch("/api/dados?refresh=true", {
          headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
        });
        if (res.status === 401) {
          console.warn("/api/dados unauthorized, falling back to client fetch.");
        }
        if (res.ok) {
          const resData = await res.json();
          if (resData.syncResult && resData.syncResult.success) {
            isLiveFromDrive = true;
          }
          if (resData.success) {
            if (Array.isArray(resData.data) && resData.data.length > 0) {
              const rawRows = resData.data;
              // If rows are 2D array matrix (Google Sheets v4 values response)
              if (Array.isArray(rawRows[0])) {
                const headerRow = rawRows[0].map((h: any) => String(h || "").trim());
                const parsedRecords: any[] = [];
                for (let i = 1; i < rawRows.length; i++) {
                  const row = rawRows[i];
                  if (!row || row.length === 0 || row.every((c: any) => !c || !String(c).trim())) continue;
                  const obj: Record<string, any> = {};
                  headerRow.forEach((h: string, idx: number) => {
                    if (!h) return;
                    obj[h] = row[idx] !== undefined && row[idx] !== "" ? String(row[idx]).trim() : null;
                  });

                  // Aliases & Validation
                  const nameVal = String(obj["NOME"] || obj["Nome"] || obj["nome"] || obj["NOME COMPLETO"] || obj["Colaborador"] || "").trim();
                  if (!nameVal) continue;

                  const upperName = nameVal.toUpperCase();
                  if (
                    upperName.startsWith("TOTAL") ||
                    upperName.startsWith("SUBTOTAL") ||
                    upperName.startsWith("LEGENDA") ||
                    upperName.startsWith("FONTE") ||
                    upperName.startsWith("OBSERV") ||
                    upperName.startsWith("QUADRO") ||
                    upperName === "NOME" ||
                    upperName === "N/A"
                  ) {
                    continue;
                  }

                  if (!/[a-zA-ZáéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/.test(nameVal)) continue;

                  obj["NOME"] = nameVal;

                  const puestoVal = obj["POSTO/GRAD.  CARGO"] || obj["POSTO/GRAD. CARGO"] || obj["POSTO/GRAD."] || obj["POSTO"] || obj["CARGO"] || "";
                  if (puestoVal) {
                    obj["POSTO/GRAD.  CARGO"] = puestoVal;
                    obj["POSTO/GRAD. CARGO"] = puestoVal;
                  }

                  const siglaVal = obj["SIGLA DIVISÃO"] || obj["SIGLA DIVISAO"] || obj["SIGLA font"] || obj["DIVISÃO"] || obj["DIVISAO"] || "";
                  if (siglaVal) obj["SIGLA DIVISÃO"] = siglaVal;

                  const divVal = obj["DIVISÃO"] || obj["DIVISAO"] || siglaVal || "";
                  if (divVal) obj["DIVISÃO"] = divVal;

                  const genVal = obj["GÊNERO"] || obj["GENERO"] || obj["SEXO"] || "";
                  if (genVal) obj["GÊNERO"] = genVal;

                  const tipoVal = obj["TIPO"] || obj["Tipo"] || obj["VÍNCULO"] || "";
                  if (tipoVal) obj["TIPO"] = tipoVal;

                  const fppVal = obj["FPP/FCE"] || obj["FPP"] || obj["FCE"] || obj["GRATIFICAÇÃO"] || "";
                  if (fppVal) obj["FPP/FCE"] = fppVal;

                  const formattedNum = String(parsedRecords.length + 1).padStart(2, "0");
                  obj["Nº"] = formattedNum;
                  obj["N°"] = formattedNum;

                  parsedRecords.push(obj);
                }
                records = parsedRecords;
              } else if (typeof rawRows[0] === "object") {
                records = rawRows;
              }
              sourceName = resData.fileName || "Google Drive Shared File";
            }
          }
        }
      } catch (errApi) {
        console.info("Backend /api/dados call failed, falling back to client fetch:", errApi);
      }

      // Fallback: Client-side fetch via googleSheets library (caso backend esteja em rede privada sem saída direta)
      // Limpa qualquer resíduo legado do localStorage com referências originais
      try {
        const storedUrl = localStorage.getItem("google_sheet_url") || "";
        if (storedUrl.includes("1PRuF") || storedUrl.includes("10lYS") || storedUrl.includes("15K01")) {
          localStorage.removeItem("google_sheet_url");
          localStorage.removeItem("efetivo_custom_database");
        }
      } catch {}

      let importedFromClient = false;
      if (!isLiveFromDrive || records.length === 0) {
        const sheetUrl = localStorage.getItem("google_sheet_url") || "";
        const isPlaceholder = !sheetUrl || sheetUrl.includes("SEU_") || sheetUrl.includes("EXEMPLO");

        if (!isPlaceholder) {
          const token = await getAccessToken();
          let clientData: GoogleSheetImportResult | null = null;
          try {
            clientData = await fetchSpreadsheetData(sheetUrl, token);
          } catch (errWithToken) {
            if (token) {
              try {
                clientData = await fetchSpreadsheetData(sheetUrl, null);
              } catch (errNoToken) {
                console.info("Auto-sync client check fallback error:", errNoToken);
              }
            }
          }
          if (clientData && clientData.records && clientData.records.length > 0) {
            records = clientData.records;
            sourceName = clientData.spreadsheetTitle || "Planilha Google";
            isLiveFromDrive = true;
            importedFromClient = true;
          }
        }
      }

      if (records.length > 0) {
        // Sanitize and filter only legitimate military/civilian members
        const validRecords = records.filter((r: any) => {
          if (!r || typeof r !== "object") return false;
          const nome = String(
            r["NOME"] || r["Nome"] || r["nome"] || r["NOME COMPLETO"] || r["Colaborador"] || ""
          ).trim();
          if (!nome) return false;
          const upper = nome.toUpperCase();
          if (
            upper.startsWith("TOTAL") ||
            upper.startsWith("SUBTOTAL") ||
            upper.startsWith("LEGENDA") ||
            upper.startsWith("FONTE") ||
            upper.startsWith("OBSERV") ||
            upper.startsWith("QUADRO") ||
            upper === "NOME" ||
            upper === "N/A"
          ) {
            return false;
          }
          return /[a-zA-ZáéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/.test(nome);
        }).map((item: any, idx: number) => {
          const numStr = String(idx + 1).padStart(2, "0");
          return {
            ...item,
            "Nº": numStr,
            "N°": numStr,
          };
        });

        const fullPayload = {
          "EFETIVO TOTAL CM": validRecords,
        };

        // Salva na API do servidor apenas se foi importado ativamente do cliente
        if (importedFromClient) {
          try {
            await fetch("/api/database", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(fullPayload),
            });
          } catch (err) {
            console.warn("Failed server auto-sync update:", err);
          }
        }

        setDbData(fullPayload);

        const timeStr = new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setLastSyncTime(timeStr);
        localStorage.setItem("last_sheet_sync_time", timeStr);

        if (isManual) {
          toast.success(`Efetivo sincronizado com sucesso! ${validRecords.length} militares carregados.`);
        }
      } else if (isManual) {
        toast.error("Não foi possível carregar dados da planilha Google no momento. Verifique se o proxy ou acesso à internet está liberado.");
      }
    } catch (err) {
      console.info("Auto-sync status check:", err);
      if (isManual) {
        toast.error("Erro ao sincronizar dados. Verifique a conexão com a rede.");
      }
    } finally {
      setIsSyncingBackground(false);
    }
  }, []);

  const clearLocalCacheAndSync = useCallback(() => {
    localStorage.removeItem("efetivo_custom_database");
    localStorage.removeItem("google_sheet_url");
    toast.info("Cópia salva limpa! Buscando dados atualizados da planilha no Drive...");
    performAutoSync(true);
  }, [performAutoSync]);

  useEffect(() => {
    // 1. Maintain active Google Auth state
    const unsub = initAuth();

    // 2. Initial background sync on mount
    performAutoSync();

    // 3. 10-minute auto-sync interval (600,000 ms)
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const interval = setInterval(() => {
      performAutoSync();
    }, TEN_MINUTES_MS);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [performAutoSync]);

  const [dbData, setDbData] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("efetivo_custom_database");
      if (stored) {
        const parsed = JSON.parse(stored);
        let rows: any[] = [];
        if (Array.isArray(parsed)) rows = parsed;
        else if (parsed && Array.isArray(parsed["EFETIVO TOTAL CM"])) rows = parsed["EFETIVO TOTAL CM"];
        
        // Validate that parsed rows have valid names
        if (rows.length > 0 && rows.some((r) => r.NOME || r.Nome || r.nome || r["NOME DE GUERRA"])) {
          return parsed;
        } else {
          localStorage.removeItem("efetivo_custom_database");
        }
      }
    } catch (err) {
      console.error("Failed to parse custom database from localStorage", err);
      localStorage.removeItem("efetivo_custom_database");
    }
    return data;
  });

  const efetivo = useMemo<Row[]>(() => {
    let list: Row[] = [];
    if (Array.isArray(dbData)) {
      list = dbData as Row[];
    } else if (dbData && Array.isArray(dbData["EFETIVO TOTAL CM"])) {
      list = dbData["EFETIVO TOTAL CM"] as Row[];
    } else {
      list = rawEfetivo;
    }

    const filteredList = list.filter((r) => {
      if (!r || typeof r !== "object") return false;
      const nome = String(
        r["NOME"] || r["Nome"] || r["nome"] || r["NOME COMPLETO"] || r["Colaborador"] || ""
      ).trim();
      if (!nome) return false;
      const upper = nome.toUpperCase();
      if (
        upper.startsWith("TOTAL") ||
        upper.startsWith("SUBTOTAL") ||
        upper.startsWith("LEGENDA") ||
        upper.startsWith("FONTE") ||
        upper.startsWith("OBSERV") ||
        upper.startsWith("QUADRO") ||
        upper === "NOME" ||
        upper === "N/A"
      ) {
        return false;
      }
      if (!/[a-zA-ZáéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/.test(nome)) return false;
      return true;
    });

    return filteredList.map((item, idx) => {
      const numStr = String(idx + 1).padStart(2, "0");
      return {
        ...item,
        "Nº": numStr,
        "N°": numStr,
      };
    });
  }, [dbData]);

  const transferidos = useMemo(() => {
    if (dbData && Array.isArray(dbData["TRANSFERIDOS E DESLIGADOS"])) {
      return dbData["TRANSFERIDOS E DESLIGADOS"] as Row[];
    }
    return rawTransferidos;
  }, [dbData]);

  const chefes = useMemo(() => {
    if (dbData && Array.isArray(dbData["CHEFE DE DIVISÕES"])) {
      return dbData["CHEFE DE DIVISÕES"] as Row[];
    }
    return efetivo.filter((r) => {
      const div = (r["DIVISÃO"] ?? "").toString().toUpperCase();
      const cargo = (r["POSTO/GRAD.  CARGO"] ?? "").toString().toUpperCase();
      const fpp = (r["FPP/FCE"] ?? "").toString().toUpperCase();
      const func = (r["TIPO FPP/FG"] ?? "").toString().toUpperCase();
      return (
        div.includes("CHEFE") ||
        cargo.includes("CHEFE") ||
        fpp.includes("FCE-1") ||
        func.includes("CHEFE") ||
        func.includes("ASSESSOR")
      );
    });
  }, [dbData, efetivo]);

  const normGrat = (v: any) => (v ?? "").toString().trim() || null;

  const divisoes = useMemo(() => uniq(efetivo, "DIVISÃO"), [efetivo]);
  const postos = useMemo(
    () =>
      uniq(efetivo, "POSTO/GRAD.  CARGO").filter(
        (p) => !p.toUpperCase().startsWith("CCE")
      ),
    [efetivo]
  );
  const generos = useMemo(() => {
    const vals = Array.from(
      new Set(
        efetivo
          .map((r) => (r["GÊNERO"] ?? r["GENERO"] ?? r["Gênero"] ?? r["Genero"] ?? r["SEXO"] ?? "").toString().trim())
          .filter(Boolean)
      )
    );
    if (vals.length > 0) return vals;
    return ["Masc.", "Fem."];
  }, [efetivo]);
  const tipos = useMemo(
    () =>
      Array.from(
        new Set(
          uniq(efetivo, "TIPO").map((t) => {
            const up = t.toUpperCase().trim();
            if (up === "MILITAR ESTADUAL" || up === "POLICIAL MILITAR") {
              return "POLICIAL MILITAR";
            }
            return t;
          }),
        ),
      ).sort(),
    [efetivo],
  );

  const fceList = useMemo(() => {
    const set = new Set<string>();
    efetivo.forEach((r) => {
      const v = (r["FPP/FCE"] ?? "").toString().trim().toUpperCase();
      if (v.startsWith("FCE")) set.add(v);
      const p = (r["POSTO/GRAD.  CARGO"] ?? "").toString().trim().toUpperCase();
      const match = p.match(/FCE-\d+/);
      if (match) set.add(match[0]);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  }, [efetivo]);

  const cceList = useMemo(() => {
    const set = new Set<string>();
    efetivo.forEach((r) => {
      const p = (r["POSTO/GRAD.  CARGO"] ?? "").toString().trim().toUpperCase();
      const f = (r["FPP/FCE"] ?? "").toString().trim().toUpperCase();
      if (p.startsWith("CCE")) set.add(p);
      if (f.startsWith("CCE")) set.add(f);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [efetivo]);

  const parseDateToTimestamp = (raw: any): number => {
    return parseDateParts(raw).dateObj?.getTime() ?? 0;
  };

  const getInclusaoTimestamp = (r: Row): number => {
    const raw =
      r["DATA DE INCLUSÃO - PM"] ||
      r["Data de Inclusão - PM"] ||
      r["DATA INCLUSÃO - PM"] ||
      r["DATA DE INCLUSÃO"] ||
      r["DATA DE INCLUSAO"] ||
      r["Data de Inclusão"] ||
      r["Data de inclusão"] ||
      r["DATA INCLUSÃO"] ||
      r["DATA_INCLUSAO"] ||
      "";
    return parseDateToTimestamp(raw);
  };

  const getApresentacaoTimestamp = (r: Row): number => {
    const raw =
      r["DATA DE APRESENTAÇÃO - CM"] ||
      r["Data de Apresentação - CM"] ||
      r["DATA APRESENTAÇÃO - CM"] ||
      r["DATA APRESENTAÇÃO"] ||
      r["DATA DE APRESENTAÇÃO"] ||
      r["DATA APRESENTACAO"] ||
      r["DATA DE APRESENTACAO"] ||
      r["Data de Apresentação"] ||
      r["Data de apresentacao"] ||
      "";
    return parseDateToTimestamp(raw);
  };

  const getNascimentoRaw = (r: Row): string => {
    return (
      r["DATA DE NASCIMENTO"] ||
      r["Data de Nascimento"] ||
      r["DATA NASCIMENTO"] ||
      r["Data de nascimento"] ||
      r["NASCIMENTO"] ||
      r["Nascimento"] ||
      r["DATA_NASCIMENTO"] ||
      r["Dt Nascimento"] ||
      r["DT NASCIMENTO"] ||
      r["O"] ||
      ""
    );
  };

  const getNascimentoTimestamp = (r: Row): number => {
    return parseDateToTimestamp(getNascimentoRaw(r));
  };

  const getAniversarioProximoDias = (r: Row): number => {
    const raw = getNascimentoRaw(r);
    const { dateObj } = parseDateParts(raw);
    if (!dateObj) return 999999;
    const hoje = new Date();
    const esteAno = hoje.getFullYear();
    const hojeZerado = new Date(esteAno, hoje.getMonth(), hoje.getDate());
    let nextAniv = new Date(esteAno, dateObj.getMonth(), dateObj.getDate());
    if (nextAniv < hojeZerado) {
      nextAniv = new Date(esteAno + 1, dateObj.getMonth(), dateObj.getDate());
    }
    const diffTime = nextAniv.getTime() - hojeZerado.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getAniversarioDiaDoAno = (r: Row): number => {
    const raw = getNascimentoRaw(r);
    const { dateObj } = parseDateParts(raw);
    if (!dateObj) return 999999;
    return dateObj.getMonth() * 32 + dateObj.getDate();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = efetivo.filter((r) => {
      if (divisao !== "__all" && (r["DIVISÃO"] ?? "") !== divisao && (r["SIGLA DIVISÃO"] ?? "") !== divisao) return false;
      if (posto !== "__all" && (r["POSTO/GRAD.  CARGO"] ?? "") !== posto)
        return false;
      if (genero !== "__all") {
        const rawG = (r["GÊNERO"] ?? r["GENERO"] ?? r["Gênero"] ?? r["Genero"] ?? r["SEXO"] ?? r["Sexo"] ?? "")
          .toString()
          .trim();
        const upperG = rawG.toUpperCase();
        if (genero === "Masc." || genero === "MASC." || genero === "MASCULINO") {
          if (!upperG.startsWith("M")) return false;
        } else if (genero === "Fem." || genero === "FEM." || genero === "FEMININO") {
          if (!upperG.startsWith("F")) return false;
        } else {
          if (rawG !== genero && upperG !== genero.toUpperCase()) return false;
        }
      }
      if (tipo !== "__all") {
        const rawT = (r["TIPO"] ?? "").toString().trim().toUpperCase();
        const normT = rawT === "MILITAR ESTADUAL" || rawT === "POLICIAL MILITAR" ? "POLICIAL MILITAR" : rawT;
        if (normT !== tipo.toUpperCase()) return false;
      }
      if (fceFilter !== "__all") {
        const fppFce = (r["FPP/FCE"] ?? "").toString().trim().toUpperCase();
        const cargo = (r["POSTO/GRAD.  CARGO"] ?? "").toString().trim().toUpperCase();
        if (fceFilter === "__all_fce") {
          if (!fppFce.startsWith("FCE") && !cargo.includes("FCE")) return false;
        } else {
          if (fppFce !== fceFilter && !cargo.includes(fceFilter)) return false;
        }
      }
      if (fppFilter !== "__all") {
        const fppFce = (r["FPP/FCE"] ?? "").toString().trim().toUpperCase();
        const tipoFpp = (r["TIPO FPP/FG"] ?? "").toString().trim().toUpperCase();
        if (fppFilter === "__all_fpp") {
          if (!fppFce.startsWith("FPP") && !tipoFpp.includes("FPP")) return false;
        } else {
          const targetNum = fppFilter.replace(/\D/g, "");
          const matches =
            fppFce === fppFilter ||
            fppFce === `FPP ${targetNum}` ||
            fppFce === `FPP-${targetNum}` ||
            tipoFpp.includes(fppFilter);
          if (!matches) return false;
        }
      }
      if (cceFilter !== "__all") {
        const p = (r["POSTO/GRAD.  CARGO"] ?? "").toString().trim().toUpperCase();
        const f = (r["FPP/FCE"] ?? "").toString().trim().toUpperCase();
        if (cceFilter === "__all_cce") {
          if (!p.startsWith("CCE") && !f.startsWith("CCE")) return false;
        } else {
          if (p !== cceFilter && f !== cceFilter) return false;
        }
      }
      if (!q) return true;
      return [
        "NOME",
        "NOME DE GUERRA",
        "RG",
        "CPF",
        "E-MAIL",
        "TELEFONE",
        "DIVISÃO",
        "SIGLA DIVISÃO",
        "FPP/FCE",
        "GÊNERO",
        "GENERO",
      ].some((k) => (r[k] ?? "").toString().toLowerCase().includes(q));
    });

    if (dataInclusaoFiltro === "antiga_novo") {
      result.sort((a, b) => {
        const tA = getInclusaoTimestamp(a);
        const tB = getInclusaoTimestamp(b);
        if (tA === 0 && tB === 0) return 0;
        if (tA === 0) return 1;
        if (tB === 0) return -1;
        if (tA !== tB) return tA - tB;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (dataInclusaoFiltro === "novo_antiga") {
      result.sort((a, b) => {
        const tA = getInclusaoTimestamp(a);
        const tB = getInclusaoTimestamp(b);
        if (tA === 0 && tB === 0) return 0;
        if (tA === 0) return 1;
        if (tB === 0) return -1;
        if (tB !== tA) return tB - tA;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (dataApresentacaoFiltro === "antiga_novo") {
      result.sort((a, b) => {
        const tA = getApresentacaoTimestamp(a);
        const tB = getApresentacaoTimestamp(b);
        if (tA === 0 && tB === 0) return 0;
        if (tA === 0) return 1;
        if (tB === 0) return -1;
        if (tA !== tB) return tA - tB;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (dataApresentacaoFiltro === "novo_antiga") {
      result.sort((a, b) => {
        const tA = getApresentacaoTimestamp(a);
        const tB = getApresentacaoTimestamp(b);
        if (tA === 0 && tB === 0) return 0;
        if (tA === 0) return 1;
        if (tB === 0) return -1;
        if (tB !== tA) return tB - tA;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (dataAniversarioFiltro === "proximos") {
      result.sort((a, b) => {
        const dA = getAniversarioProximoDias(a);
        const dB = getAniversarioProximoDias(b);
        if (dA !== dB) return dA - dB;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (dataAniversarioFiltro === "mes_crescente") {
      result.sort((a, b) => {
        const dA = getAniversarioDiaDoAno(a);
        const dB = getAniversarioDiaDoAno(b);
        if (dA !== dB) return dA - dB;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (dataAniversarioFiltro === "novo_antigo") {
      result.sort((a, b) => {
        const tA = getNascimentoTimestamp(a);
        const tB = getNascimentoTimestamp(b);
        if (tA === 0 && tB === 0) return 0;
        if (tA === 0) return 1;
        if (tB === 0) return -1;
        if (tB !== tA) return tB - tA;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (dataAniversarioFiltro === "antigo_novo") {
      result.sort((a, b) => {
        const tA = getNascimentoTimestamp(a);
        const tB = getNascimentoTimestamp(b);
        if (tA === 0 && tB === 0) return 0;
        if (tA === 0) return 1;
        if (tB === 0) return -1;
        if (tA !== tB) return tA - tB;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    }

    return result;
  }, [efetivo, search, divisao, posto, genero, tipo, fceFilter, fppFilter, cceFilter, dataInclusaoFiltro, dataApresentacaoFiltro, dataAniversarioFiltro]);

  const fmtBRL = (n: number) =>
    n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });

  const kpis = useMemo(() => {
    const total = filtered.length;
    const comGrat = filtered.filter((r) => {
      const g = normGrat(r["FPP/FCE"]);
      const c = (r["POSTO/GRAD.  CARGO"] ?? "").toString().toUpperCase().startsWith("CCE");
      return !!g || c;
    }).length;
    const semGrat = total - comGrat;
    const valores = filtered
      .map((r) => Number(r["VALOR"]) || 0)
      .filter((v) => v > 0);
    const valorTotal = valores.reduce((s, v) => s + v, 0);
    const ticket = valores.length ? valorTotal / valores.length : 0;
    return { total, comGrat, semGrat, valorTotal, ticket };
  }, [filtered]);

  const getSiglaCount = (sigla: string) => {
    const target = sigla.toUpperCase();
    return filtered.filter((r) => {
      const s = (r["SIGLA DIVISÃO"] ?? r["DIVISÃO"] ?? "")
        .toString()
        .trim()
        .toUpperCase();
      return s === target;
    }).length;
  };



  const porGratificacao = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => {
      const g = normGrat(r["FPP/FCE"]);
      if (!g) return;
      m.set(g, (m.get(g) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        // ordena por prefixo (FPP, FCE, CCE) e número
        const [ap, an] = a.name.split("-");
        const [bp, bn] = b.name.split("-");
        if (ap !== bp) return ap.localeCompare(bp);
        return Number(an) - Number(bn);
      });
  }, [filtered]);

  const porTipoGrat = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => {
      const g = normGrat(r["FPP/FCE"]);
      const prefix = g ? g.split("-")[0] : "Sem gratificação";
      m.set(prefix, (m.get(prefix) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const valorPorDivisao = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => {
      const v = Number(r["VALOR"]) || 0;
      if (!v) return;
      const d = (r["SIGLA DIVISÃO"] ?? r["DIVISÃO"] ?? "—").toString();
      m.set(d, (m.get(d) ?? 0) + v);
    });
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const porDivisao = useMemo(() => groupCount(filtered, "DIVISÃO", 12), [
    filtered,
  ]);
  const porPosto = useMemo(
    () => groupCount(filtered, "POSTO/GRAD.  CARGO", 12),
    [filtered],
  );

  const clearFilters = () => {
    setSearch("");
    setDivisao("__all");
    setPosto("__all");
    setGenero("__all");
    setTipo("__all");
    setFceFilter("__all");
    setFppFilter("__all");
    setCceFilter("__all");
    setDataInclusaoFiltro("__all");
    setDataApresentacaoFiltro("__all");
    setDataAniversarioFiltro("__all");
  };

  const anyFilter =
    search ||
    divisao !== "__all" ||
    posto !== "__all" ||
    genero !== "__all" ||
    tipo !== "__all" ||
    fceFilter !== "__all" ||
    fppFilter !== "__all" ||
    cceFilter !== "__all" ||
    dataInclusaoFiltro !== "__all" ||
    dataApresentacaoFiltro !== "__all" ||
    dataAniversarioFiltro !== "__all";

  if (activeNav === "ferias") {
    return (
      <>
        <FeriasView
          onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
          onNavigateHome={() => setActiveNav("home")}
          onNavigateFeriasCivis={() => setActiveNav("ferias_civis")}
          authUser={authUser}
        />
        <GoogleSheetsModal
          open={isSheetsModalOpen}
          onOpenChange={setIsSheetsModalOpen}
          currentData={efetivo}
          onUpdateDatabase={(newData) => setDbData(newData)}
        />
      </>
    );
  }

  if (activeNav === "ferias_civis") {
    return (
      <FeriasCivisView
        onNavigateHome={() => setActiveNav("home")}
        onNavigateFerias={() => setActiveNav("ferias")}
        authUser={authUser}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row antialiased overflow-x-hidden font-sans transition-colors duration-150 ${
        isLight ? "bg-[#f4f5f8] text-slate-900" : "bg-[#0f0f11] text-[#ececed]"
      }`}
    >
      {/* Sidebar - Navigation & Filters */}
      <aside
        className={`w-full lg:w-[280px] shrink-0 border-r p-6 flex flex-col gap-6 transition-colors duration-150 ${
          isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-[#ececed]/10"
        }`}
      >
        <div
          className={`header-brand flex flex-col gap-1 border-b pb-3 ${
            isLight ? "border-slate-200" : "border-[#ececed]/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <h1
              className={`font-syne font-extrabold text-2xl tracking-tight uppercase leading-none my-1 ${
                isLight ? "text-slate-900" : "text-[#ececed]"
              }`}
            >
              Efetivo CM
            </h1>
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                isLight ? "bg-blue-100 text-blue-800" : "bg-blue-500/20 text-blue-400"
              }`}
            >
              Geral
            </span>
          </div>
          <p
            className={`text-[10px] font-mono uppercase tracking-wider ${
              isLight ? "text-slate-500" : "text-[#ececed]/50"
            }`}
          >
            Casa Militar — PR
          </p>
        </div>

        <nav className="nav-section flex flex-col gap-1.5 my-1">
          <button
            type="button"
            onClick={() => setActiveNav("home")}
            className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium border transition-all w-full text-left cursor-pointer font-bold ${
              isLight
                ? "text-blue-700 bg-blue-50 border-blue-200 shadow-xs"
                : "text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20"
            }`}
          >
            <Home className={`w-4 h-4 ${isLight ? "text-blue-600" : "text-[#3b82f6]"}`} />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveNav("ferias")}
            className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium border border-transparent transition-all w-full text-left cursor-pointer ${
              isLight
                ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                : "text-[#ececed]/70 hover:text-[#ececed] hover:bg-[#ececed]/5"
            }`}
          >
            <CalendarDays className={`w-4 h-4 ${isLight ? "text-slate-500" : "text-[#ececed]/60"}`} />
            <span>Férias Militares</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveNav("ferias_civis")}
            className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium border border-transparent transition-all w-full text-left cursor-pointer ${
              isLight
                ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                : "text-[#ececed]/70 hover:text-[#ececed] hover:bg-[#ececed]/5"
            }`}
          >
            <Users className={`w-4 h-4 ${isLight ? "text-slate-500" : "text-[#ececed]/60"}`} />
            <span>Férias Servidores Civis</span>
          </button>

          {/* Theme Toggle Button */}
          <div className="pt-2">
            <ThemeToggle className="w-full" />
          </div>
        </nav>

        <div className="filter-stack flex flex-col gap-3">
          <span
            className={`section-tag flex items-center justify-between border-b pb-2 ${
              isLight ? "border-slate-200 text-slate-500" : "border-[#ececed]/10 text-[#ececed]/60"
            }`}
          >
            <span>Busca & Filtros</span>
            {anyFilter && (
              <button
                onClick={clearFilters}
                className="text-[#3b82f6] hover:underline text-[9px] font-mono cursor-pointer font-bold"
              >
                LIMPAR
              </button>
            )}
          </span>

          <div className="relative">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
                isLight ? "text-slate-400" : "text-[#ececed]/40"
              }`}
            />
            <input
              type="text"
              placeholder="RG, CPF, NOME..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-xs pl-8 pr-3 py-2 text-xs font-mono transition-colors focus:outline-none ${
                isLight
                  ? "bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white"
                  : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] placeholder:text-[#ececed]/40 focus:border-[#3b82f6]"
              }`}
            />
          </div>

          <select
            value={divisao}
            onChange={(e) => setDivisao(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">Divisão Operacional</option>
            {divisoes.map((d) => (
              <option key={d} value={d} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={posto}
            onChange={(e) => setPosto(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">Cargo/Posto/Graduação</option>
            {postos.map((p) => (
              <option key={p} value={p} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {p}
              </option>
            ))}
          </select>

          {/* Filtro FCE */}
          <select
            value={fceFilter}
            onChange={(e) => setFceFilter(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">FCE</option>
            <option value="__all_fce" className={isLight ? "bg-white text-slate-900 font-semibold" : "bg-[#161618] font-semibold"}>
              FCE TODAS
            </option>
            {fceList.map((f) => (
              <option key={f} value={f} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {f}
              </option>
            ))}
          </select>

          {/* Filtro FPP */}
          <select
            value={fppFilter}
            onChange={(e) => setFppFilter(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">FPP</option>
            <option value="__all_fpp" className={isLight ? "bg-white text-slate-900 font-semibold" : "bg-[#161618] font-semibold"}>
              FPP TODAS
            </option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <option key={`FPP-${num}`} value={`FPP-${num}`} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {`FPP-${num}`}
              </option>
            ))}
          </select>

          {/* Filtro CCE */}
          <select
            value={cceFilter}
            onChange={(e) => setCceFilter(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">CCE</option>
            <option value="__all_cce" className={isLight ? "bg-white text-slate-900 font-semibold" : "bg-[#161618] font-semibold"}>
              CCE-TODAS
            </option>
            {cceList.map((c) => (
              <option key={c} value={c} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">Tipo de Vínculo</option>
            {tipos.map((t) => (
              <option key={t} value={t} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={genero}
            onChange={(e) => setGenero(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">Gênero</option>
            <option value="Masc." className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Masc.
            </option>
            <option value="Fem." className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Fem.
            </option>
          </select>

          <select
            value={dataInclusaoFiltro}
            onChange={(e) => {
              setDataInclusaoFiltro(e.target.value);
              if (e.target.value !== "__all") {
                setDataApresentacaoFiltro("__all");
              }
            }}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${
              dataInclusaoFiltro === "__all"
                ? isLight
                  ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                  : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
                : isLight
                ? "bg-blue-50 border border-blue-300 text-blue-800 font-semibold focus:border-blue-600"
                : "bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Data de Inclusão - PM
            </option>
            <option value="antiga_novo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              📅 Inclusão PM: Mais Antiga para Mais Nova
            </option>
            <option value="novo_antiga" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              📅 Inclusão PM: Mais Nova para Mais Antiga
            </option>
          </select>

          <select
            value={dataApresentacaoFiltro}
            onChange={(e) => {
              setDataApresentacaoFiltro(e.target.value);
              if (e.target.value !== "__all") {
                setDataInclusaoFiltro("__all");
                setDataAniversarioFiltro("__all");
              }
            }}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${
              dataApresentacaoFiltro === "__all"
                ? isLight
                  ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                  : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
                : isLight
                ? "bg-blue-50 border border-blue-300 text-blue-800 font-semibold focus:border-blue-600"
                : "bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Data de Apresentação - CM
            </option>
            <option value="antiga_novo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              📅 Apresentação: Mais Antiga para Mais Nova
            </option>
            <option value="novo_antiga" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              📅 Apresentação: Mais Nova para Mais Antiga
            </option>
          </select>

          <select
            value={dataAniversarioFiltro}
            onChange={(e) => {
              setDataAniversarioFiltro(e.target.value);
              if (e.target.value !== "__all") {
                setDataInclusaoFiltro("__all");
                setDataApresentacaoFiltro("__all");
              }
            }}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${
              dataAniversarioFiltro === "__all"
                ? isLight
                  ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                  : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
                : isLight
                ? "bg-amber-50 border border-amber-300 text-amber-800 font-semibold focus:border-amber-600"
                : "bg-amber-500/10 border border-amber-500/30 text-amber-400 focus:border-amber-400"
            }`}
          >
            <option value="__all" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Data de Aniversário
            </option>
            <option value="proximos" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              🎂 Próximos Aniversariantes
            </option>
            <option value="mes_crescente" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              📅 Aniversário: Jan a Dez
            </option>
            <option value="novo_antigo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              👶 Mais Novos (Menor Idade)
            </option>
            <option value="antigo_novo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              👴 Mais Velhos (Maior Idade)
            </option>
          </select>

          <button
            onClick={() => {}}
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-xs py-2.5 rounded-xs transition-colors font-sans uppercase tracking-wider mt-2 cursor-pointer shadow-[0_2px_10px_rgba(59,130,246,0.3)]"
          >
            CONSULTA
          </button>
        </div>

        {/* Auto-Sync Status Info & Immediate Sync Button */}
        <div
          className={`mt-auto pt-3 border-t flex flex-col gap-2 select-none ${
            isLight ? "border-slate-200" : "border-[#ececed]/10"
          }`}
        >
          <div
            className={`flex items-center justify-between text-[10px] font-mono ${
              isLight ? "text-slate-500" : "text-[#ececed]/50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSyncingBackground ? "bg-amber-400 animate-ping" : "bg-emerald-500"
                }`}
              ></span>
              <span>Sincronização 10m</span>
            </span>
            <span className={`text-[9px] font-mono ${isLight ? "text-slate-400" : "text-[#ececed]/40"}`}>
              {lastSyncTime ? `Última: ${lastSyncTime}` : "Ativo"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => performAutoSync(true)}
            disabled={isSyncingBackground}
            className={`w-full font-semibold text-xs py-2 rounded-xs transition-colors font-sans uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 ${
              isLight
                ? "bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700"
                : "bg-[#3b82f6]/15 hover:bg-[#3b82f6]/25 border border-[#3b82f6]/40 text-[#3b82f6]"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBackground ? "animate-spin" : ""}`} />
            {isSyncingBackground ? "SINCRONIZANDO..." : "SINCRONIZAR AGORA"}
          </button>

          <button
            type="button"
            onClick={clearLocalCacheAndSync}
            disabled={isSyncingBackground}
            title="Limpa a cópia temporária do navegador e busca os dados mais recentes do Google Drive"
            className="w-full mt-1.5 text-[10px] py-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-300 underline text-center cursor-pointer transition-colors"
          >
            Limpar cópia salva & Forçar Drive
          </button>
        </div>
      </aside>

      {/* Workspace */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Stats Header */}
        <header
          className={`flex flex-col xl:flex-row border-b transition-colors ${
            isLight ? "bg-white border-slate-200" : "bg-[#0f0f11] border-[#ececed]/10"
          }`}
        >
          {/* EFETIVO TOTAL Block */}
          <div
            className={`p-4 border-r border-b xl:border-b-0 shrink-0 min-w-[180px] flex flex-col justify-center ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-[#131316] border-[#ececed]/10"
            }`}
          >
            <span
              className={`font-mono text-[10px] uppercase tracking-wider block font-bold ${
                isLight ? "text-slate-500" : "text-[#ececed]/50"
              }`}
            >
              Efetivo Total
            </span>
            <div
              className={`font-syne text-3xl font-extrabold my-0.5 tracking-tight ${
                isLight ? "text-blue-600" : "text-[#3b82f6]"
              }`}
            >
              {String(kpis.total).padStart(2, "0")}
            </div>
            <span
              className={`font-mono text-[9px] uppercase tracking-wider block ${
                isLight ? "text-slate-400" : "text-[#ececed]/40"
              }`}
            >
              Base: {efetivo.length}
            </span>
          </div>

          {/* Divisions 2-Row Grid */}
          <div className="flex-1 flex flex-col justify-between overflow-x-auto min-w-0">
            {/* Top Row: CHEFE, DOS, DSIPS, DCRI, DTA, DA */}
            <div
              className={`grid grid-cols-6 border-b flex-1 min-w-[550px] ${
                isLight ? "border-slate-200" : "border-[#ececed]/10"
              }`}
            >
              {["CHEFE", "DOS", "DSIPS", "DCRI", "DTA", "DA"].map((sigla) => {
                const count = getSiglaCount(sigla);
                const isActive = divisao === sigla;
                return (
                  <button
                    key={sigla}
                    type="button"
                    onClick={() => setDivisao(isActive ? "__all" : sigla)}
                    className={`p-3 border-r last:border-r-0 flex flex-col justify-center items-start text-left transition-colors cursor-pointer ${
                      isLight ? "border-slate-200" : "border-[#ececed]/10"
                    } ${
                      isActive
                        ? isLight
                          ? "bg-blue-50 border-b-2 border-b-blue-600"
                          : "bg-[#3b82f6]/10 border-b-2 border-b-[#3b82f6]"
                        : isLight
                        ? "hover:bg-slate-50"
                        : "hover:bg-[#18181c]"
                    }`}
                  >
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider font-bold block ${
                        isLight ? "text-slate-600" : "text-[#ececed]/60"
                      }`}
                    >
                      {sigla}
                    </span>
                    <div
                      className={`font-syne text-2xl font-extrabold my-0.5 tracking-tight ${
                        isLight ? "text-slate-900" : "text-[#ececed]"
                      }`}
                    >
                      {String(count).padStart(2, "0")}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Row: GAB, DOF, DIG, DTT, NICS, AT */}
            <div className="grid grid-cols-6 flex-1 min-w-[550px]">
              {["GAB", "DOF", "DIG", "DTT", "NICS", "AT"].map((sigla) => {
                const count = getSiglaCount(sigla);
                const isActive = divisao === sigla;
                return (
                  <button
                    key={sigla}
                    type="button"
                    onClick={() => setDivisao(isActive ? "__all" : sigla)}
                    className={`p-3 border-r last:border-r-0 flex flex-col justify-center items-start text-left transition-colors cursor-pointer ${
                      isLight ? "border-slate-200" : "border-[#ececed]/10"
                    } ${
                      isActive
                        ? isLight
                          ? "bg-blue-50 border-b-2 border-b-blue-600"
                          : "bg-[#3b82f6]/10 border-b-2 border-b-[#3b82f6]"
                        : isLight
                        ? "hover:bg-slate-50"
                        : "hover:bg-[#18181c]"
                    }`}
                  >
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider font-bold block ${
                        isLight ? "text-slate-600" : "text-[#ececed]/60"
                      }`}
                    >
                      {sigla}
                    </span>
                    <div
                      className={`font-syne text-2xl font-extrabold my-0.5 tracking-tight ${
                        isLight ? "text-slate-900" : "text-[#ececed]"
                      }`}
                    >
                      {String(count).padStart(2, "0")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Main Table Content */}
        <section className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
          <div
            className={`border-b pb-3 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
              isLight ? "border-slate-200 text-slate-800" : "border-[#ececed]/10 text-[#ececed]"
            }`}
          >
            <span>LISTA EFETIVO [{filtered.length}]</span>
            {anyFilter && (
              <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-[#ececed]/50"}`}>
                Filtros ativos ({filtered.length} de {efetivo.length})
              </span>
            )}
          </div>

          <div className="mt-2 flex-1">
            <TechnicalPersonTable
              rows={filtered}
              onOpen={setDetail}
              isLight={isLight}
              dataInclusaoFiltro={dataInclusaoFiltro}
              onToggleInclusaoSort={(sort) => {
                setDataInclusaoFiltro(sort);
                if (sort !== "__all") {
                  setDataApresentacaoFiltro("__all");
                  setDataAniversarioFiltro("__all");
                }
              }}
              dataApresentacaoFiltro={dataApresentacaoFiltro}
              onToggleApresentacaoSort={(sort) => {
                setDataApresentacaoFiltro(sort);
                if (sort !== "__all") {
                  setDataInclusaoFiltro("__all");
                  setDataAniversarioFiltro("__all");
                }
              }}
              dataAniversarioFiltro={dataAniversarioFiltro}
              onToggleAniversarioSort={(sort) => {
                setDataAniversarioFiltro(sort);
                if (sort !== "__all") {
                  setDataInclusaoFiltro("__all");
                  setDataApresentacaoFiltro("__all");
                }
              }}
            />
          </div>
        </section>

        {/* Status Footer */}
        <footer
          className={`border-t px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs ${
            isLight
              ? "bg-white border-slate-200 text-slate-500"
              : "bg-[#0f0f11] border-[#ececed]/10 text-[#ececed]/50"
          }`}
        >
          <div className={`text-[11px] ${isLight ? "text-slate-500" : "text-[#ececed]/40"}`}>
            Painel Geral do Efetivo — Casa Militar / PR
          </div>
          <button
            onClick={() => downloadCsv(filtered, `efetivo-${Date.now()}.csv`)}
            className={`border px-4 py-1.5 text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer rounded-xs uppercase flex items-center gap-2 ${
              isLight
                ? "border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white"
                : "border-[#3b82f6] bg-transparent text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOWNLOAD REPORT (.CSV)</span>
          </button>
        </footer>
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent
          className={`max-w-2xl max-h-[85vh] overflow-y-auto border p-6 ${
            isLight
              ? "bg-white border-slate-300 text-slate-900"
              : "bg-[#161618] border-[#ececed]/20 text-[#ececed]"
          }`}
        >
          <DialogHeader className={`border-b pb-3 ${isLight ? "border-slate-200" : "border-[#ececed]/10"}`}>
            <DialogTitle
              className={`font-syne text-lg font-bold ${
                isLight ? "text-slate-900" : "text-[#ececed]"
              }`}
            >
              {detail?.["NOME"] || detail?.["Nome"] || detail?.["nome"] || detail?.["NOME DE GUERRA"] || "Militar"}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans py-2">
              {Object.entries(detail)
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .map(([k, v]) => {
                  const upperK = k.toUpperCase();
                  const isApresentacao =
                    upperK.includes("APRESENTAÇÃO") ||
                    upperK.includes("APRESENTACAO");
                  const isInclusao =
                    upperK.includes("INCLUSÃO") ||
                    upperK.includes("INCLUSAO");
                  const isNascimento =
                    upperK.includes("NASCIMENTO") ||
                    upperK.includes("ANIVERSÁRIO") ||
                    upperK.includes("ANIVERSARIO");

                  let displayLabel = k;
                  if (isInclusao && !upperK.includes("PM")) {
                    displayLabel = `${k} - PM`;
                  }

                  let displayContent: React.ReactNode = String(v);
                  if (isApresentacao || isInclusao) {
                    const parsed = parseDateParts(v);
                    if (parsed.dateObj) {
                      const elapsed = getElapsedFromDate(parsed.dateObj);
                      displayContent = (
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-blue-600 dark:text-blue-400">
                            {elapsed.text}
                          </span>
                          <span className="text-[11px] font-mono opacity-80 mt-0.5">
                            Data: {parsed.formattedDate}
                          </span>
                        </div>
                      );
                    }
                  } else if (isNascimento) {
                    const parsed = parseDateParts(v);
                    if (parsed.dateObj) {
                      const dia = String(parsed.dateObj.getDate()).padStart(2, "0");
                      const mesNum = parsed.dateObj.getMonth();
                      const mesesExtenso = [
                        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                      ];
                      const mesExtenso = mesesExtenso[mesNum];
                      const hoje = new Date();
                      let idade = hoje.getFullYear() - parsed.dateObj.getFullYear();
                      const diffMes = hoje.getMonth() - mesNum;
                      if (diffMes < 0 || (diffMes === 0 && hoje.getDate() < parsed.dateObj.getDate())) {
                        idade--;
                      }
                      const isHoje =
                        hoje.getDate() === parsed.dateObj.getDate() &&
                        hoje.getMonth() === mesNum;

                      displayContent = (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-amber-600 dark:text-amber-400">
                              🎂 {dia} de {mesExtenso} ({idade} anos)
                            </span>
                            {isHoje && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                🎉 Hoje!
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono opacity-80 mt-0.5">
                            Data de Nascimento: {parsed.formattedDate}
                          </span>
                        </div>
                      );
                    }
                  }

                  return (
                    <div
                      key={k}
                      className={`border-b pb-2 ${
                        isLight ? "border-slate-100" : "border-[#ececed]/10"
                      }`}
                    >
                      <div
                        className={`font-mono text-[9px] uppercase tracking-widest ${
                          isLight ? "text-slate-500" : "text-[#ececed]/50"
                        }`}
                      >
                        {displayLabel}
                      </div>
                      <div
                        className={`break-words font-medium mt-0.5 ${
                          isLight ? "text-slate-800" : "text-[#ececed]"
                        }`}
                      >
                        {displayContent}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <GoogleSheetsModal
        open={isSheetsModalOpen}
        onOpenChange={setIsSheetsModalOpen}
        currentData={efetivo}
        onUpdateDatabase={(newData) => setDbData(newData)}
      />
    </div>
  );
}

function TechnicalPersonTable({
  rows = [],
  onOpen,
  extraCol,
  isLight = false,
  dataInclusaoFiltro = "__all",
  onToggleInclusaoSort,
  dataApresentacaoFiltro = "__all",
  onToggleApresentacaoSort,
  dataAniversarioFiltro = "__all",
  onToggleAniversarioSort,
}: {
  rows?: Row[];
  onOpen: (r: Row) => void;
  extraCol?: string;
  isLight?: boolean;
  dataInclusaoFiltro?: string;
  onToggleInclusaoSort?: (sort: string) => void;
  dataApresentacaoFiltro?: string;
  onToggleApresentacaoSort?: (sort: string) => void;
  dataAniversarioFiltro?: string;
  onToggleAniversarioSort?: (sort: string) => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const safeRows = rows || [];
  const total = safeRows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(page, pages - 1);
  const currentP = Math.max(0, p);
  const slice = safeRows.slice(currentP * pageSize, (currentP + 1) * pageSize);

  return (
    <div
      className={`border rounded-xs overflow-hidden ${
        isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-[#ececed]/10"
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr
              className={`border-b font-mono text-[10px] uppercase ${
                isLight
                  ? "bg-slate-100 border-slate-200 text-slate-600"
                  : "bg-[#161618] border-[#ececed]/10 text-[#ececed]/50"
              }`}
            >
              <th className="py-3 px-4">Nº</th>
              <th className="py-3 px-4">NOME</th>
              <th className="py-3 px-4">POSTO / GRADUAÇÃO</th>
              <th className="py-3 px-4">ID-META4</th>
              <th className="py-3 px-4">RG</th>
              <th className="py-3 px-4">CPF</th>
              <th className="py-3 px-4">DIVISÃO</th>
              <th className="py-3 px-4">DATA DE INCLUSÃO - PM</th>
              <th className="py-3 px-4">DATA DE APRESENTAÇÃO - CM</th>
              <th className="py-3 px-4">DATA DE ANIVERSÁRIO</th>
              {extraCol && <th className="py-3 px-4">{extraCol}</th>}
            </tr>
          </thead>
          <tbody
            className={`font-sans ${
              isLight ? "divide-y divide-slate-100" : "divide-y divide-[#ececed]/5"
            }`}
          >
            {slice.map((r, i) => {
              const rawId = r["Nº"] ?? r["N°"] ?? r["identificador"] ?? r["Identificador"] ?? r["IDENTIFICADOR"] ?? r["ID"] ?? (currentP * pageSize + i + 1);
              const idNum = parseInt(String(rawId), 10);
              const formattedId = !isNaN(idNum) ? String(idNum).padStart(2, "0") : String(rawId).padStart(2, "0");
              const nome = r["NOME"] || r["Nome"] || r["nome"] || r["NOME COMPLETO"] || r["Colaborador"] || "—";
              const cargo = r["POSTO/GRAD.  CARGO"] || r["POSTO/GRAD. CARGO"] || r["POSTO"] || r["Posto"] || r["CARGO"] || r["Cargo"] || "—";
              const idMeta4 = r["ID-META4"] || r["ID_META4"] || r["ID META4"] || r["META4"] || "—";
              const rg = r["RG"] || r["Rg"] || r["rg"] || "—";
              const cpf = r["CPF"] || r["Cpf"] || r["cpf"] || "—";
              const sigla = r["SIGLA DIVISÃO"] || r["DIVISÃO"] || r["Divisão"] || r["DIVISAO"] || "—";
              const rawInclusao =
                r["DATA DE INCLUSÃO - PM"] ||
                r["Data de Inclusão - PM"] ||
                r["DATA INCLUSÃO - PM"] ||
                r["DATA DE INCLUSÃO"] ||
                r["DATA DE INCLUSAO"] ||
                r["Data de Inclusão"] ||
                r["Data de inclusão"] ||
                r["DATA INCLUSÃO"] ||
                r["DATA_INCLUSAO"] ||
                "";

              const parsedInclusao = parseDateParts(rawInclusao);
              const elapsedInclusao = parsedInclusao.dateObj
                ? getElapsedFromDate(parsedInclusao.dateObj)
                : null;

              const rawApresentacao =
                r["DATA DE APRESENTAÇÃO - CM"] ||
                r["Data de Apresentação - CM"] ||
                r["DATA APRESENTAÇÃO - CM"] ||
                r["DATA APRESENTAÇÃO"] ||
                r["DATA DE APRESENTAÇÃO"] ||
                r["DATA APRESENTACAO"] ||
                r["DATA DE APRESENTACAO"] ||
                r["Data de Apresentação"] ||
                r["Data de apresentacao"] ||
                "";

              const parsedApresentacao = parseDateParts(rawApresentacao);
              const elapsedApresentacao = parsedApresentacao.dateObj
                ? getElapsedFromDate(parsedApresentacao.dateObj)
                : null;

              const rawNascimento =
                r["DATA DE NASCIMENTO"] ||
                r["Data de Nascimento"] ||
                r["DATA NASCIMENTO"] ||
                r["Data de nascimento"] ||
                r["NASCIMENTO"] ||
                r["Nascimento"] ||
                r["DATA_NASCIMENTO"] ||
                r["Dt Nascimento"] ||
                r["DT NASCIMENTO"] ||
                r["O"] ||
                "";

              const parsedNascimento = parseDateParts(rawNascimento);
              let anivDisplay: {
                diaMesExtenso: string;
                idade: number;
                isHoje: boolean;
              } | null = null;

              if (parsedNascimento.dateObj) {
                const dia = String(parsedNascimento.dateObj.getDate()).padStart(2, "0");
                const mesNum = parsedNascimento.dateObj.getMonth();
                const mesesExtenso = [
                  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                ];
                const mesExtenso = mesesExtenso[mesNum];
                const hoje = new Date();
                let idade = hoje.getFullYear() - parsedNascimento.dateObj.getFullYear();
                const diffMes = hoje.getMonth() - mesNum;
                if (diffMes < 0 || (diffMes === 0 && hoje.getDate() < parsedNascimento.dateObj.getDate())) {
                  idade--;
                }
                const isHoje =
                  hoje.getDate() === parsedNascimento.dateObj.getDate() &&
                  hoje.getMonth() === mesNum;

                anivDisplay = {
                  diaMesExtenso: `${dia} de ${mesExtenso}`,
                  idade,
                  isHoje,
                };
              }

              return (
                <tr
                  key={i}
                  onClick={() => onOpen(r)}
                  className={`cursor-pointer transition-colors ${
                    isLight ? "hover:bg-blue-50/40" : "hover:bg-[#ececed]/[0.03]"
                  }`}
                >
                  <td
                    className={`py-3.5 px-4 font-mono text-xs font-semibold ${
                      isLight ? "text-blue-600" : "text-[#3b82f6]"
                    }`}
                  >
                    {formattedId}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-bold uppercase ${
                      isLight ? "text-slate-900" : "text-[#ececed]"
                    }`}
                  >
                    {nome}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-medium ${
                      isLight ? "text-slate-700" : "text-[#ececed]/70"
                    }`}
                  >
                    {cargo}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-xs ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    {idMeta4}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-xs ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    {rg}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-xs ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    {cpf}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        isLight
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20"
                      }`}
                    >
                      {sigla}
                    </span>
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-xs ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    {elapsedInclusao ? (
                      <div
                        className="flex flex-col min-w-[170px]"
                        title={`Tempo na Polícia Militar: ${elapsedInclusao.text} • Data: ${parsedInclusao.formattedDate}`}
                      >
                        <span
                          className={`font-sans font-semibold text-xs leading-snug ${
                            isLight ? "text-slate-900" : "text-[#ececed]"
                          }`}
                        >
                          {elapsedInclusao.text}
                        </span>
                        <span
                          className={`text-[11px] font-mono mt-0.5 ${
                            isLight ? "text-blue-700 font-medium" : "text-blue-400 font-medium"
                          }`}
                        >
                          ({parsedInclusao.formattedDate})
                        </span>
                      </div>
                    ) : (
                      <span>{rawInclusao || "—"}</span>
                    )}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-xs ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    {elapsedApresentacao ? (
                      <div
                        className="flex flex-col min-w-[170px]"
                        title={`Tempo na Casa Militar: ${elapsedApresentacao.text} • Data: ${parsedApresentacao.formattedDate}`}
                      >
                        <span
                          className={`font-sans font-semibold text-xs leading-snug ${
                            isLight ? "text-slate-900" : "text-[#ececed]"
                          }`}
                        >
                          {elapsedApresentacao.text}
                        </span>
                        <span
                          className={`text-[11px] font-mono mt-0.5 ${
                            isLight ? "text-blue-700 font-medium" : "text-blue-400 font-medium"
                          }`}
                        >
                          ({parsedApresentacao.formattedDate})
                        </span>
                      </div>
                    ) : (
                      <span>{rawApresentacao || "—"}</span>
                    )}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-xs ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    {anivDisplay ? (
                      <div
                        className="flex flex-col min-w-[160px]"
                        title={`Aniversário: ${anivDisplay.diaMesExtenso} • Data de Nascimento: ${parsedNascimento.formattedDate} • Idade: ${anivDisplay.idade} anos`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-sans font-semibold text-xs leading-snug ${
                              anivDisplay.isHoje
                                ? isLight
                                  ? "text-emerald-700 font-bold"
                                  : "text-emerald-400 font-bold"
                                : isLight
                                ? "text-slate-900"
                                : "text-[#ececed]"
                            }`}
                          >
                            {anivDisplay.diaMesExtenso}
                          </span>
                          {anivDisplay.isHoje && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 whitespace-nowrap">
                              🎉 Hoje!
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[11px] font-mono mt-0.5 ${
                            isLight ? "text-slate-500 font-medium" : "text-[#ececed]/50"
                          }`}
                        >
                          Nasc: {parsedNascimento.formattedDate} {anivDisplay.idade > 0 ? `(${anivDisplay.idade} anos)` : ""}
                        </span>
                      </div>
                    ) : (
                      <span>{rawNascimento || "—"}</span>
                    )}
                  </td>
                  {extraCol && (
                    <td
                      className={`py-3.5 px-4 font-mono text-xs ${
                        isLight ? "text-blue-600" : "text-[#3b82f6]"
                      }`}
                    >
                      {r[extraCol] ?? "—"}
                    </td>
                  )}
                </tr>
              );
            })}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={extraCol ? 10 : 9}
                  className={`text-center py-12 font-mono text-xs uppercase ${
                    isLight ? "text-slate-400" : "text-[#ececed]/50"
                  }`}
                >
                  Nenhum registro encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className={`flex items-center justify-between p-3 border-t font-mono text-[11px] ${
          isLight
            ? "bg-slate-50 border-slate-200 text-slate-600"
            : "bg-[#0f0f11] border-[#ececed]/10 text-[#ececed]/50"
        }`}
      >
        <div>
          Pág: {p + 1} de {pages} ({total} Registros)
        </div>
        <div className="flex gap-4">
          <button
            disabled={p === 0}
            onClick={() => setPage(p - 1)}
            className="disabled:opacity-30 hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed font-mono text-xs text-blue-600 font-bold"
          >
            &lt; Anterior
          </button>
          <button
            disabled={p >= pages - 1}
            onClick={() => setPage(p + 1)}
            className="disabled:opacity-30 hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed font-mono text-xs text-blue-600 font-bold"
          >
            Próximo &gt;
          </button>
        </div>
      </div>
    </div>
  );
}


