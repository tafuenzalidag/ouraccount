from sqlalchemy.orm import Session
from models import Category

SEED = [
    ("Alimentación", [("Supermercado", "🛒"), ("Delivery", "🛵"), ("Restaurantes", "🍽️")]),
    ("Hogar", [("Muebles y Deco", "🛋️"), ("Ferretería", "🔧"), ("Limpieza", "🧹")]),
    ("Transporte", []),
    ("Entretención", []),
    ("Servicios básicos", [("Luz", "💡"), ("Agua", "💧"), ("Gas", "🔥")]),
    ("Telecom", []),
    ("Salud", []),
    ("Mascotas", []),
    ("Comisiones/Impuestos", []),
    ("Otros", []),
]


def seed_categories(household_id: str, db: Session) -> None:
    for nombre_padre, hijos in SEED:
        padre = Category(household_id=household_id, nombre=nombre_padre)
        db.add(padre)
        db.flush()
        for nombre_hijo, icono in hijos:
            db.add(Category(
                household_id=household_id,
                parent_id=padre.id,
                nombre=nombre_hijo,
                icono=icono,
            ))
    db.commit()
