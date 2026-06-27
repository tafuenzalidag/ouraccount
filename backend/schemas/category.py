from pydantic import BaseModel


class CategoryCreate(BaseModel):
    nombre: str
    parent_id: str | None = None
    icono: str | None = None
    color: str | None = None


class CategoryOut(BaseModel):
    id: str
    nombre: str
    parent_id: str | None
    icono: str | None
    color: str | None

    model_config = {"from_attributes": True}
