from pydantic import BaseModel


class PaymentMethodCreate(BaseModel):
    tipo: str  # cuenta_corriente | tarjeta_credito
    alias: str
    ultimos_digitos: str | None = None
    es_compartido: bool = True
    banco: str | None = None
    owner_user_id: int | None = None  # None = compartido


class PaymentMethodOut(BaseModel):
    id: int
    tipo: str
    alias: str
    ultimos_digitos: str | None
    es_compartido: bool
    banco: str | None
    owner_user_id: int | None

    model_config = {"from_attributes": True}
