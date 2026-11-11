import { Escala, TurnoPreset } from "@/types/escala";

export const TURNO_PRESETS: TurnoPreset[] = [
  {
    id: "12x36_dia",
    label: "12x36 Diurno (06:00 - 18:00)",
    horario: "06:00 - 18:00",
    descricao: "Escala operacional de 12 horas diurnas",
  },
  {
    id: "12x36_noite",
    label: "12x36 Noturno (18:00 - 06:00)",
    horario: "18:00 - 06:00",
    descricao: "Escala operacional de 12 horas noturnas",
  },
  {
    id: "24x72",
    label: "24x72 (07:00 - 07:00)",
    horario: "07:00 - 07:00",
    descricao: "Plantão contínuo de 24 horas por 72 horas de folga",
  },
  {
    id: "expediente",
    label: "Expediente Administrativo (08:30 - 18:00)",
    horario: "08:30 - 18:00",
    descricao: "Jornada administrativa com intervalo de almoço",
  },
  {
    id: "turno_a",
    label: "Turno A (Manhã: 06:00 - 14:00)",
    horario: "06:00 - 14:00",
    descricao: "Primeiro turno diário",
  },
  {
    id: "turno_b",
    label: "Turno B (Tarde: 14:00 - 22:00)",
    horario: "14:00 - 22:00",
    descricao: "Segundo turno diário",
  },
  {
    id: "turno_c",
    label: "Turno C (Noite: 22:00 - 06:00)",
    horario: "22:00 - 06:00",
    descricao: "Terceiro turno / plantão noturno",
  },
  {
    id: "plantao_especial",
    label: "Plantão Especial / Evento Governamental",
    horario: "Horário sob demanda",
    descricao: "Missões governamentais e solenidades oficiais",
  },
  {
    id: "custom",
    label: "Personalizado (definir horários)",
    horario: "Horário customizado",
    descricao: "Defina manualmente a data e horários de entrada e saída",
  },
];

export const SETORES_PADRAO = [
  "Guarda do Palácio Iguaçu",
  "Permanência / Recepção Principal",
  "Segurança Presidencial / Governamental",
  "Escolta e Transporte Oficial",
  "Sala de Operações / Comunicações (COBOM/NICS)",
  "Oficial de Dia / Supervisão",
  "Apoio Operacional / Reserva",
  "Residência Oficial",
];

export const FUNCOES_PADRAO = [
  "Oficial de Dia",
  "Supervisor de Serviço",
  "Comandante da Guarda",
  "Sentinela Portão Principal",
  "Sentinela Portão Anexo",
  "Permanente",
  "Motorista de Escolta",
  "Operador de Rádio e Câmeras",
  "Segurança Aproximada",
  "Membro da Guarda",
];

const STORAGE_KEY = "cm_escalas_v1";
const ACTIVE_ESCALA_ID_KEY = "cm_active_escala_id";

// Escala inicial de exemplo padrão da Casa Militar
function getInitialSampleEscala(): Escala {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  const amanhaStr = amanha.toISOString().split("T")[0];

  return {
    id: "escala-padrao-001",
    titulo: "Escala Ordinária - Palácio Iguaçu",
    unidade: "Casa Militar da Governadoria",
    dataCriacao: new Date().toISOString(),
    dataEscala: hojeStr,
    dataFimEscala: amanhaStr,
    turnoPadrao: "12x36 Diurno (06:00 - 18:00)",
    setorGeral: "Palácio Iguaçu - Sede",
    observacoesGerais: "Uniformes 3º RUPM. Todos os militares deverão apresentar-se com 15 minutos de antecedência da assunção do serviço para conferência de material bélico.",
    status: "ativa",
    itens: [
      {
        id: "item-1",
        militarRg: "FICT-00003",
        postoGrad: "ASP",
        nomeGuerra: "QUEIROZ",
        nomeCompleto: "DANIEL FREITAS QUEIROZ",
        funcao: "Oficial de Dia",
        turno: "24x72 (07:00 - 07:00)",
        dataInicio: hojeStr,
        horaInicio: "07:00",
        dataFim: amanhaStr,
        horaFim: "07:00",
        setor: "Oficial de Dia / Supervisão",
        observacoes: "Porte de pistola institucional e rádio HT faixa governamental",
      },
      {
        id: "item-2",
        militarRg: "FICT-00004",
        postoGrad: "2º SGT",
        nomeGuerra: "PEIXOTO",
        nomeCompleto: "MATEUS SOUZA PEIXOTO",
        funcao: "Comandante da Guarda",
        turno: "12x36 Diurno (06:00 - 18:00)",
        dataInicio: hojeStr,
        horaInicio: "06:00",
        dataFim: hojeStr,
        horaFim: "18:00",
        setor: "Guarda do Palácio Iguaçu",
        observacoes: "Conferência e cautela da chave dos postos avançados",
      },
      {
        id: "item-3",
        militarRg: "FICT-00006",
        postoGrad: "CABO",
        nomeGuerra: "PINHEIRO",
        nomeCompleto: "LUCAS SILVEIRA PINHEIRO",
        funcao: "Sentinela Portão Principal",
        turno: "12x36 Diurno (06:00 - 18:00)",
        dataInicio: hojeStr,
        horaInicio: "06:00",
        dataFim: hojeStr,
        horaFim: "18:00",
        setor: "Guarda do Palácio Iguaçu",
        observacoes: "Controle de tráfego de viaturas oficiais e autoridades",
      },
      {
        id: "item-4",
        militarRg: "FICT-00008",
        postoGrad: "SOLDADO",
        nomeGuerra: "ALMEIDA",
        nomeCompleto: "PEDRO HENRIQUE ALMEIDA",
        funcao: "Permanente",
        turno: "12x36 Diurno (06:00 - 18:00)",
        dataInicio: hojeStr,
        horaInicio: "06:00",
        dataFim: hojeStr,
        horaFim: "18:00",
        setor: "Permanência / Recepção Principal",
        observacoes: "Crachá de visitantes e cadastro biométrico",
      },
      {
        id: "item-5",
        militarRg: "FICT-00009",
        postoGrad: "SOLDADO",
        nomeGuerra: "BARBOSA",
        nomeCompleto: "GABRIEL NUNES BARBOSA",
        funcao: "Motorista de Escolta",
        turno: "12x36 Noturno (18:00 - 06:00)",
        dataInicio: hojeStr,
        horaInicio: "18:00",
        dataFim: amanhaStr,
        horaFim: "06:00",
        setor: "Escolta e Transporte Oficial",
        observacoes: "Viatura Toyota SW4 Blindada - prefixo V-01",
      },
      {
        id: "item-6",
        militarRg: "FICT-00010",
        postoGrad: "1º SGT",
        nomeGuerra: "FARIAS",
        nomeCompleto: "JULIO CESAR FARIAS",
        funcao: "Operador de Rádio e Câmeras",
        turno: "12x36 Noturno (18:00 - 06:00)",
        dataInicio: hojeStr,
        horaInicio: "18:00",
        dataFim: amanhaStr,
        horaFim: "06:00",
        setor: "Sala de Operações / Comunicações (COBOM/NICS)",
        observacoes: "Monitoramento perimetral do Palácio Iguaçu",
      },
    ],
  };
}

export function loadAllEscalas(): Escala[] {
  if (typeof window === "undefined") return [getInitialSampleEscala()];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = [getInitialSampleEscala()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    const initial = [getInitialSampleEscala()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  } catch (err) {
    console.error("Erro ao carregar escalas do localStorage:", err);
    return [getInitialSampleEscala()];
  }
}

export function saveAllEscalas(escalas: Escala[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(escalas));
  } catch (err) {
    console.error("Erro ao salvar escalas no localStorage:", err);
  }
}

export function getActiveEscalaId(): string {
  if (typeof window === "undefined") return "escala-padrao-001";
  return localStorage.getItem(ACTIVE_ESCALA_ID_KEY) || "escala-padrao-001";
}

export function setActiveEscalaId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_ESCALA_ID_KEY, id);
}
