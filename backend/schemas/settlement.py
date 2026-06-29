from datetime import date
from pydantic import BaseModel


class SettlementOut(BaseModel):
    external_id: str
    deudor_user_id: str             # encoded external_id
    acreedor_user_id: str           # encoded external_id
    monto: int
    estado: str
    periodo_desde: date
    periodo_hasta: date
    pagado_en: date | None


class SettlementPeriodOut(BaseModel):
    settlement: SettlementOut | None
    pagado: dict[str, int]
    debido: dict[str, int]
    balance: dict[str, int]
