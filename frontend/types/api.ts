export interface UserOut {
  id: string;
  email: string;
  username: string;
  nombre: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface HouseholdOut {
  id: string;
  nombre: string;
  moneda: string;
}

export interface TransactionOut {
  id: string;
  fecha_operacion: string;
  descripcion_raw: string;
  descripcion_norm: string;
  monto: number;
  es_hogar: boolean;
  tipo_movimiento: string;
  category_id: string | null;
  payer_user_id: string;
}

export interface SettlementOut {
  id: string;
  deudor_user_id: string;
  acreedor_user_id: string;
  monto: number;
  estado: string;
  periodo_desde: string;
  periodo_hasta: string;
  pagado_en: string | null;
}

export interface SettlementPeriodOut {
  settlement: SettlementOut | null;
  pagado: Record<string, number>;
  debido: Record<string, number>;
  balance: Record<string, number>;
}
