from pydantic import BaseModel


class CategoryCreate(BaseModel):
    nombre: str
    parent_id: str | None = None   # external_id, router decodes
    icono: str | None = None
    color: str | None = None


class CategoryOut(BaseModel):
    external_id: str
    nombre: str
    parent_id: str | None          # encoded external_id
    icono: str | None
    color: str | None
