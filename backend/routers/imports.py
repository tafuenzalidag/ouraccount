from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db
from models import (
    User, HouseholdMember, PaymentMethod, ImportBatch,
    Transaction, InstallmentPlan,
)
from schemas.imports import (
    ImportPreviewOut, PreviewItemOut,
    ImportConfirmIn, ImportConfirmOut,
    InstallmentIn,
)
from services.auth import get_current_user
from services.id_codec import encode, decode
from services.pdf_parser import parse_pdf_bytes
from services.categorizer import apply_category
from services.split import compute_split
from services.text_utils import dedupe_hash

router = APIRouter(prefix="/api", tags=["imports"])


def _assert_member(hh_int: int, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


@router.post("/households/{household_id}/imports", response_model=ImportPreviewOut)
async def upload_pdf(
    household_id: str,
    file: UploadFile = File(...),
    payment_method_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _, pm_int = decode(payment_method_id)
    _assert_member(hh_int, current_user, db)

    pm = db.query(PaymentMethod).filter(
        PaymentMethod.id == pm_int,
        PaymentMethod.household_id == hh_int,
    ).first()
    if not pm:
        raise HTTPException(status_code=400, detail="Medio de pago inválido")

    pdf_bytes = await file.read()
    result = parse_pdf_bytes(pdf_bytes)

    batch = ImportBatch(
        household_id=hh_int,
        payment_method_id=pm_int,
        archivo_origen="pdf",
        periodo_desde=result.meta.periodo_desde,
        periodo_hasta=result.meta.periodo_hasta,
        total_facturado_declarado=result.meta.total_facturado_declarado,
        estado="preview",
    )
    db.add(batch)
    db.commit()

    # Gather existing hashes for duplicate detection
    existing_hashes: set[str] = {
        row[0]
        for row in db.query(Transaction.hash_dedupe)
        .filter(
            Transaction.household_id == hh_int,
            Transaction.deleted_at.is_(None),
        )
        .all()
    }

    preview_items: list[PreviewItemOut] = []
    for item in result.items:
        cat_id, es_hogar_default = apply_category(item.descripcion_norm, hh_int, db)
        es_hogar = item.es_hogar if item.es_interno else es_hogar_default
        installment_out = None
        if item.installment:
            installment_out = InstallmentIn(
                descripcion=item.installment.descripcion,
                monto_total=item.installment.monto_total,
                cuota_actual=item.installment.cuota_actual,
                cuotas_totales=item.installment.cuotas_totales,
                valor_cuota_mensual=item.installment.valor_cuota_mensual,
            )
        preview_items.append(
            PreviewItemOut(
                fecha_operacion=item.fecha_operacion,
                descripcion_raw=item.descripcion_raw,
                descripcion_norm=item.descripcion_norm,
                lugar=item.lugar,
                monto=item.monto,
                tipo_movimiento=item.tipo_movimiento,
                es_interno=item.es_interno,
                es_hogar=es_hogar,
                incluido=item.incluido,
                category_id=encode("cat_", cat_id) if cat_id else None,
                installment=installment_out,
                hash_dedupe=item.hash_dedupe,
                es_duplicado_posible=item.hash_dedupe in existing_hashes,
            )
        )

    return ImportPreviewOut(
        batch_id=encode("ib_", batch.id),
        cuadre_ok=result.cuadre_ok,
        advertencia=result.advertencia,
        items=preview_items,
    )


@router.post("/imports/{batch_id}/confirm", response_model=ImportConfirmOut)
def confirm_import(
    batch_id: str,
    req: ImportConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, batch_int = decode(batch_id)
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_int).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch no encontrado")

    _assert_member(batch.household_id, current_user, db)

    if batch.estado != "preview":
        raise HTTPException(status_code=409, detail="Este batch ya fue confirmado")

    members = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == batch.household_id,
        HouseholdMember.user_id.isnot(None),
    ).all()

    _, payer_int = decode(req.payer_user_id)
    member_ids = {m.user_id for m in members}
    if payer_int not in member_ids:
        raise HTTPException(status_code=400, detail="payer_user_id no es miembro del hogar")

    existing_hashes: set[str] = {
        row[0]
        for row in db.query(Transaction.hash_dedupe)
        .filter(
            Transaction.household_id == batch.household_id,
            Transaction.deleted_at.is_(None),
        )
        .all()
    }

    created = 0
    skipped_dup = 0
    skipped_excl = 0

    for item in req.items:
        if not item.incluido:
            skipped_excl += 1
            continue

        hash_d = dedupe_hash(item.fecha_operacion, item.monto, item.descripcion_norm)

        if hash_d in existing_hashes:
            skipped_dup += 1
            continue

        installment_plan_id = None
        if item.installment:
            plan = InstallmentPlan(
                household_id=batch.household_id,
                descripcion=item.installment.descripcion,
                monto_total=item.installment.monto_total,
                cuota_actual=item.installment.cuota_actual,
                cuotas_totales=item.installment.cuotas_totales,
                valor_cuota_mensual=item.installment.valor_cuota_mensual,
                tasa=0.0,
            )
            db.add(plan)
            db.flush()
            installment_plan_id = plan.id

        cat_int = None
        if item.category_id:
            _, cat_int = decode(item.category_id)

        tx = Transaction(
            household_id=batch.household_id,
            import_batch_id=batch.id,
            payment_method_id=batch.payment_method_id,
            payer_user_id=payer_int,
            category_id=cat_int,
            installment_plan_id=installment_plan_id,
            fecha_operacion=item.fecha_operacion,
            descripcion_raw=item.descripcion_raw,
            descripcion_norm=item.descripcion_norm,
            lugar=item.lugar,
            monto=item.monto,
            tipo_movimiento=item.tipo_movimiento,
            es_hogar=item.es_hogar,
            es_interno=item.es_interno,
            split_override=None,
            hash_dedupe=hash_d,
        )
        db.add(tx)
        db.flush()

        compute_split(tx, members, db)

        existing_hashes.add(hash_d)
        created += 1

    batch.estado = "confirmado"
    db.commit()

    return ImportConfirmOut(
        transactions_created=created,
        duplicates_skipped=skipped_dup,
        excluded_skipped=skipped_excl,
    )
