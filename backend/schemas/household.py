from pydantic import BaseModel


class HouseholdCreate(BaseModel):
    nombre: str
    ratio_a: float  # 0.57 — ratio del creador
    nombre_display_a: str | None = None


class HouseholdOut(BaseModel):
    external_id: str
    nombre: str
    moneda: str


class InviteOut(BaseModel):
    code: str


class JoinRequest(BaseModel):
    code: str
