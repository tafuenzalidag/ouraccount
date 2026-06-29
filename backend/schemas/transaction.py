from datetime import date as date_type
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    fecha_operacion: date_type
    descripcion_raw: str
    monto: int
    payment_method_id: int
    es_hogar: bool = True
    category_id: int | None = None
    split_override: float | None = Field(None, ge=0.0, le=1.0)
    lugar: str | None = None


class TransactionOut(BaseModel):
    id: int
    fecha_operacion: date_type
    descripcion_raw: str
    descripcion_norm: str
    monto: int
    es_hogar: bool
    tipo_movimiento: str
    category_id: int | None
    payer_user_id: int

    model_config = {"from_attributes": True}
