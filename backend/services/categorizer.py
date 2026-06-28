from sqlalchemy.orm import Session
from models import MerchantRule, Category

# (patron_substring, nombre_categoria, es_hogar_default)
SEED_RULES: list[tuple[str, str, bool]] = [
    ("JUMBO", "Supermercados", True),
    ("LIDER", "Supermercados", True),
    ("UNIMARC", "Supermercados", True),
    ("TOTTUS", "Supermercados", True),
    ("SANTA ISABEL", "Supermercados", True),
    ("SODIMAC", "Hogar/Muebles", True),
    ("EASY", "Hogar/Muebles", True),
    ("PEDIDOSYA", "Delivery", True),
    ("UBER EATS", "Delivery", True),
    ("RAPPI", "Delivery", True),
    ("ENEL", "Servicios básicos", True),
    ("AGUAS ANDINAS", "Servicios básicos", True),
    ("METROGAS", "Servicios básicos", True),
    ("ENTEL", "Telecom", True),
    ("MOVISTAR", "Telecom", True),
    ("WOM", "Telecom", True),
    ("CLARO", "Telecom", True),
    ("CINEMARK", "Entretención", True),
    ("CINEPLANET", "Entretención", True),
    ("NETFLIX", "Entretención", False),
    ("SPOTIFY", "Entretención", False),
    ("AMAZON", "Entretención", False),
    ("FARMACIA", "Salud", True),
    ("CRUZ VERDE", "Salud", True),
    ("SALCOBRAND", "Salud", True),
    ("AHUMADA", "Salud", True),
    ("IMPTO", "Comisiones/Impuestos", True),
    ("COMISION", "Comisiones/Impuestos", True),
    ("UBER", "Transporte", True),
    ("CABIFY", "Transporte", True),
    ("BIPO", "Transporte", True),
    ("MACONLINE", "Hogar/Muebles", True),
    ("RIPLEY", "Ropa/Calzado", False),
    ("FALABELLA", "Ropa/Calzado", False),
    ("PARIS", "Ropa/Calzado", False),
    ("ZARA", "Ropa/Calzado", False),
]


def _match_seed(desc_norm: str) -> tuple[str, bool]:
    desc_upper = desc_norm.upper()
    for pattern, category, es_hogar in SEED_RULES:
        if pattern.upper() in desc_upper:
            return category, es_hogar
    return "Otros", True


def apply_category(
    desc_norm: str,
    household_id: str,
    db: Session,
) -> tuple[str | None, bool]:
    """
    Returns (category_id, es_hogar_default).
    Priority: MerchantRule (learned) > SEED_RULES > ("Otros" category, True).
    """
    # 1. Check learned rules for this household
    desc_upper = desc_norm.upper()
    rules = db.query(MerchantRule).filter(
        MerchantRule.household_id == household_id
    ).all()
    for rule in rules:
        if rule.patron.upper() in desc_upper:
            return rule.category_id, rule.es_hogar_default

    # 2. Match against seed rules by category name
    cat_name, es_hogar = _match_seed(desc_norm)
    category = db.query(Category).filter(
        Category.household_id == household_id,
        Category.nombre == cat_name,
    ).first()
    if category:
        return category.id, es_hogar

    # 3. Fallback to "Otros"
    otros = db.query(Category).filter(
        Category.household_id == household_id,
        Category.nombre == "Otros",
    ).first()
    return (otros.id if otros else None), True
