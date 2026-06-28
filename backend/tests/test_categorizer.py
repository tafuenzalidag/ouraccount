from services.categorizer import _match_seed, SEED_RULES


def test_jumbo_is_supermercado():
    cat_name, es_hogar = _match_seed("JUMBO ALTO LAS CONDES")
    assert cat_name == "Supermercados"
    assert es_hogar is True


def test_lider_is_supermercado():
    cat_name, es_hogar = _match_seed("LIDER EXPRESS")
    assert cat_name == "Supermercados"
    assert es_hogar is True


def test_pedidosya_is_delivery():
    cat_name, es_hogar = _match_seed("PEDIDOSYA")
    assert cat_name == "Delivery"
    assert es_hogar is True


def test_sodimac_is_hogar():
    cat_name, es_hogar = _match_seed("SODIMAC HOMECENTER")
    assert cat_name == "Hogar/Muebles"
    assert es_hogar is True


def test_enel_is_servicios():
    cat_name, es_hogar = _match_seed("ENEL")
    assert cat_name == "Servicios básicos"
    assert es_hogar is True


def test_unknown_merchant_returns_otros():
    cat_name, es_hogar = _match_seed("COMERCIO DESCONOCIDO XYZ")
    assert cat_name == "Otros"
    assert es_hogar is True


def test_seed_rules_is_list_of_tuples():
    for pattern, category, _ in SEED_RULES:
        assert isinstance(pattern, str)
        assert isinstance(category, str)
