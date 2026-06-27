from datetime import date
from pydantic import BaseModel


class SettlementOut(BaseModel):
    id: str
    deudor_user_id: str
    acreedor_user_id: str
    monto: int
    estado: str
    periodo_desde: date
    periodo_hasta: date
    pagado_en: date | None

    model_config = {"from_attributes": True}


class SettlementPeriodOut(BaseModel):
    settlement: SettlementOut | None
    pagado: dict[str, int]
    debido: dict[str, int]
    balance: dict[str, int]
