from datetime import date as date_type
from pydantic import BaseModel
from typing import Optional
from schemas.duplicates import TxSnippet


class InstallmentIn(BaseModel):
    descripcion: str
    monto_total: int
    cuota_actual: int
    cuotas_totales: int
    valor_cuota_mensual: int


class PreviewItemOut(BaseModel):
    fecha_operacion: date_type
    descripcion_raw: str
    descripcion_norm: str
    lugar: Optional[str]
    monto: int
    tipo_movimiento: str
    es_interno: bool
    es_hogar: bool
    incluido: bool
    category_id: Optional[str]    # encoded external_id
    installment: Optional[InstallmentIn]
    hash_dedupe: str
    es_duplicado_posible: bool
    fuzzy_matches: list[TxSnippet] = []


class ImportPreviewOut(BaseModel):
    batch_id: str                 # encoded external_id
    cuadre_ok: bool
    advertencia: Optional[str]
    items: list[PreviewItemOut]


class ConfirmItemIn(BaseModel):
    fecha_operacion: date_type
    descripcion_raw: str
    descripcion_norm: str
    lugar: Optional[str] = None
    monto: int
    tipo_movimiento: str
    es_interno: bool
    es_hogar: bool
    incluido: bool
    category_id: Optional[str] = None   # external_id, router decodes
    installment: Optional[InstallmentIn] = None


class ImportConfirmIn(BaseModel):
    payer_user_id: str            # external_id, router decodes
    items: list[ConfirmItemIn]


class ImportConfirmOut(BaseModel):
    transactions_created: int
    duplicates_skipped: int
    excluded_skipped: int
