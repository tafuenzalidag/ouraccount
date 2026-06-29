from datetime import date
from pydantic import BaseModel
from typing import Literal


class TxSnippet(BaseModel):
    external_id: str
    fecha_operacion: date
    descripcion_raw: str
    monto: int
    origen: Literal["manual", "importado"]
    payment_method_alias: str


class DuplicatePairOut(BaseModel):
    tx_manual: TxSnippet
    tx_importado: TxSnippet


class DismissDuplicateIn(BaseModel):
    tx_external_id_a: str
    tx_external_id_b: str
