from pydantic import BaseModel


class HouseholdCreate(BaseModel):
    nombre: str
    ratio_a: float  # 0.57 — ratio del creador
    nombre_display_a: str | None = None
    nombre_display_b: str | None = None


class HouseholdOut(BaseModel):
    id: str
    nombre: str
    moneda: str

    model_config = {"from_attributes": True}


class InviteOut(BaseModel):
    code: str
    expires_in_hours: int = 48


class JoinRequest(BaseModel):
    code: str
