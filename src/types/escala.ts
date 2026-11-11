export type TurnoPresetId =
  | "12x36_dia"
  | "12x36_noite"
  | "24x72"
  | "expediente"
  | "turno_a"
  | "turno_b"
  | "turno_c"
  | "plantao_especial"
  | "custom";

export interface TurnoPreset {
  id: TurnoPresetId;
  label: string;
  horario: string;
  descricao: string;
}

export interface EscalaItem {
  id: string;
  militarRg?: string;
  postoGrad: string;
  nomeGuerra: string;
  nomeCompleto: string;
  funcao: string;
  turno: string;
  dataInicio: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  dataFim: string; // YYYY-MM-DD
  horaFim: string; // HH:mm
  setor: string;
  observacoes?: string;
}

export interface Escala {
  id: string;
  titulo: string;
  unidade: string; // Casa Militar do Paraná
  dataCriacao: string;
  dataEscala: string; // YYYY-MM-DD ou período formatado
  dataFimEscala?: string;
  turnoPadrao?: string;
  setorGeral?: string;
  observacoesGerais?: string;
  status: "ativa" | "rascunho" | "concluida";
  itens: EscalaItem[];
}
