from datetime import date as date_type
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    fecha_operacion: date_type
    descripcion_raw: str
    monto: int
    payment_method_id: str   # external_id, router decodes
    es_hogar: bool = True
    category_id: str | None = None   # external_id, router decodes
    split_override: float | None = Field(None, ge=0.0, le=1.0)
    lugar: str | None = None


class TransactionOut(BaseModel):
    external_id: str
    fecha_operacion: date_type
    descripcion_raw: str
    descripcion_norm: str
    monto: int
    es_hogar: bool
    tipo_movimiento: str
    category_id: str | None        # encoded external_id
    payer_user_id: str             # encoded external_id
    payment_method_id: str         # encoded external_id
