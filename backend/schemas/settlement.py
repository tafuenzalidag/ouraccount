from datetime import date
from pydantic import BaseModel


class SettlementOut(BaseModel):
    id: int
    deudor_user_id: int
    acreedor_user_id: int
    monto: int
    estado: str
    periodo_desde: date
    periodo_hasta: date
    pagado_en: date | None

    model_config = {"from_attributes": True}


class SettlementPeriodOut(BaseModel):
    settlement: SettlementOut | None
    pagado: dict[int, int]
    debido: dict[int, int]
    balance: dict[int, int]
