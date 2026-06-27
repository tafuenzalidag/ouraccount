from datetime import date as date_type
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    fecha_operacion: date_type
    descripcion_raw: str
    monto: int
    payment_method_id: str
    es_hogar: bool = True
    category_id: str | None = None
    split_override: float | None = None
    lugar: str | None = None


class TransactionOut(BaseModel):
    id: str
    fecha_operacion: date_type
    descripcion_raw: str
    descripcion_norm: str
    monto: int
    es_hogar: bool
    tipo_movimiento: str
    category_id: str | None
    payer_user_id: str

    model_config = {"from_attributes": True}
