"""replace uuid pks with serial integers

Revision ID: 002
Revises: 001
Create Date: 2026-06-28

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    -- Drop all FK constraints first using dynamic SQL to handle any name Alembic assigned
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT tc.constraint_name, tc.table_name
                FROM information_schema.table_constraints tc
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name IN (
                  'household_members','categories','payment_methods','merchant_rules',
                  'import_batches','installment_plans','transactions',
                  'split_allocations','settlements'
                )
      LOOP
        EXECUTE 'ALTER TABLE ' || r.table_name || ' DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
      END LOOP;
    END $$;

    -- Add new_id SERIAL to each table (auto-assigns unique integers)
    ALTER TABLE users ADD COLUMN new_id SERIAL;
    ALTER TABLE households ADD COLUMN new_id SERIAL;
    ALTER TABLE categories ADD COLUMN new_id SERIAL;
    ALTER TABLE household_members ADD COLUMN new_id SERIAL;
    ALTER TABLE payment_methods ADD COLUMN new_id SERIAL;
    ALTER TABLE merchant_rules ADD COLUMN new_id SERIAL;
    ALTER TABLE import_batches ADD COLUMN new_id SERIAL;
    ALTER TABLE installment_plans ADD COLUMN new_id SERIAL;
    ALTER TABLE transactions ADD COLUMN new_id SERIAL;
    ALTER TABLE split_allocations ADD COLUMN new_id SERIAL;
    ALTER TABLE settlements ADD COLUMN new_id SERIAL;

    -- Add new integer FK columns
    ALTER TABLE household_members ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE household_members ADD COLUMN user_id_new INTEGER;
    ALTER TABLE categories ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE categories ADD COLUMN parent_id_new INTEGER;
    ALTER TABLE payment_methods ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE payment_methods ADD COLUMN owner_uid_new INTEGER;
    ALTER TABLE merchant_rules ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE merchant_rules ADD COLUMN cat_id_new INTEGER;
    ALTER TABLE import_batches ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE import_batches ADD COLUMN pm_id_new INTEGER;
    ALTER TABLE installment_plans ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN ib_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN pm_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN payer_uid_new INTEGER;
    ALTER TABLE transactions ADD COLUMN cat_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN ip_id_new INTEGER;
    ALTER TABLE split_allocations ADD COLUMN tx_id_new INTEGER;
    ALTER TABLE split_allocations ADD COLUMN user_id_new INTEGER;
    ALTER TABLE settlements ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE settlements ADD COLUMN deudor_uid_new INTEGER;
    ALTER TABLE settlements ADD COLUMN acreedor_uid_new INTEGER;

    -- Backfill FK mappings
    UPDATE household_members hm SET hh_id_new = h.new_id FROM households h WHERE hm.household_id = h.id;
    UPDATE household_members hm SET user_id_new = u.new_id FROM users u WHERE hm.user_id = u.id;
    UPDATE categories c SET hh_id_new = h.new_id FROM households h WHERE c.household_id = h.id;
    UPDATE categories c SET parent_id_new = p.new_id FROM categories p WHERE c.parent_id = p.id;
    UPDATE payment_methods pm SET hh_id_new = h.new_id FROM households h WHERE pm.household_id = h.id;
    UPDATE payment_methods pm SET owner_uid_new = u.new_id FROM users u WHERE pm.owner_user_id = u.id;
    UPDATE merchant_rules mr SET hh_id_new = h.new_id FROM households h WHERE mr.household_id = h.id;
    UPDATE merchant_rules mr SET cat_id_new = c.new_id FROM categories c WHERE mr.category_id = c.id;
    UPDATE import_batches ib SET hh_id_new = h.new_id FROM households h WHERE ib.household_id = h.id;
    UPDATE import_batches ib SET pm_id_new = p.new_id FROM payment_methods p WHERE ib.payment_method_id = p.id;
    UPDATE installment_plans ip SET hh_id_new = h.new_id FROM households h WHERE ip.household_id = h.id;
    UPDATE transactions t SET hh_id_new = h.new_id FROM households h WHERE t.household_id = h.id;
    UPDATE transactions t SET ib_id_new = ib.new_id FROM import_batches ib WHERE t.import_batch_id = ib.id;
    UPDATE transactions t SET pm_id_new = p.new_id FROM payment_methods p WHERE t.payment_method_id = p.id;
    UPDATE transactions t SET payer_uid_new = u.new_id FROM users u WHERE t.payer_user_id = u.id;
    UPDATE transactions t SET cat_id_new = c.new_id FROM categories c WHERE t.category_id = c.id;
    UPDATE transactions t SET ip_id_new = ip.new_id FROM installment_plans ip WHERE t.installment_plan_id = ip.id;
    UPDATE split_allocations sa SET tx_id_new = t.new_id FROM transactions t WHERE sa.transaction_id = t.id;
    UPDATE split_allocations sa SET user_id_new = u.new_id FROM users u WHERE sa.user_id = u.id;
    UPDATE settlements s SET hh_id_new = h.new_id FROM households h WHERE s.household_id = h.id;
    UPDATE settlements s SET deudor_uid_new = u.new_id FROM users u WHERE s.deudor_user_id = u.id;
    UPDATE settlements s SET acreedor_uid_new = u.new_id FROM users u WHERE s.acreedor_user_id = u.id;

    -- Drop old PK columns and rename new ones
    ALTER TABLE users DROP CONSTRAINT users_pkey;
    ALTER TABLE users DROP COLUMN id;
    ALTER TABLE users RENAME COLUMN new_id TO id;
    ALTER TABLE users ADD PRIMARY KEY (id);

    ALTER TABLE households DROP CONSTRAINT households_pkey;
    ALTER TABLE households DROP COLUMN id;
    ALTER TABLE households RENAME COLUMN new_id TO id;
    ALTER TABLE households ADD PRIMARY KEY (id);

    ALTER TABLE categories DROP CONSTRAINT categories_pkey;
    ALTER TABLE categories DROP COLUMN id;
    ALTER TABLE categories RENAME COLUMN new_id TO id;
    ALTER TABLE categories ADD PRIMARY KEY (id);
    ALTER TABLE categories DROP COLUMN household_id;
    ALTER TABLE categories DROP COLUMN parent_id;
    ALTER TABLE categories RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE categories RENAME COLUMN parent_id_new TO parent_id;
    ALTER TABLE categories ALTER COLUMN household_id SET NOT NULL;

    ALTER TABLE household_members DROP CONSTRAINT household_members_pkey;
    ALTER TABLE household_members DROP COLUMN id;
    ALTER TABLE household_members RENAME COLUMN new_id TO id;
    ALTER TABLE household_members ADD PRIMARY KEY (id);
    ALTER TABLE household_members DROP COLUMN household_id;
    ALTER TABLE household_members DROP COLUMN user_id;
    ALTER TABLE household_members RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE household_members RENAME COLUMN user_id_new TO user_id;
    ALTER TABLE household_members ALTER COLUMN household_id SET NOT NULL;

    ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_pkey;
    ALTER TABLE payment_methods DROP COLUMN id;
    ALTER TABLE payment_methods RENAME COLUMN new_id TO id;
    ALTER TABLE payment_methods ADD PRIMARY KEY (id);
    ALTER TABLE payment_methods DROP COLUMN household_id;
    ALTER TABLE payment_methods DROP COLUMN owner_user_id;
    ALTER TABLE payment_methods RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE payment_methods RENAME COLUMN owner_uid_new TO owner_user_id;
    ALTER TABLE payment_methods ALTER COLUMN household_id SET NOT NULL;

    ALTER TABLE merchant_rules DROP CONSTRAINT merchant_rules_pkey;
    ALTER TABLE merchant_rules DROP COLUMN id;
    ALTER TABLE merchant_rules RENAME COLUMN new_id TO id;
    ALTER TABLE merchant_rules ADD PRIMARY KEY (id);
    ALTER TABLE merchant_rules DROP COLUMN household_id;
    ALTER TABLE merchant_rules DROP COLUMN category_id;
    ALTER TABLE merchant_rules RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE merchant_rules RENAME COLUMN cat_id_new TO category_id;
    ALTER TABLE merchant_rules ALTER COLUMN household_id SET NOT NULL;
    ALTER TABLE merchant_rules ALTER COLUMN category_id SET NOT NULL;

    ALTER TABLE import_batches DROP CONSTRAINT import_batches_pkey;
    ALTER TABLE import_batches DROP COLUMN id;
    ALTER TABLE import_batches RENAME COLUMN new_id TO id;
    ALTER TABLE import_batches ADD PRIMARY KEY (id);
    ALTER TABLE import_batches DROP COLUMN household_id;
    ALTER TABLE import_batches DROP COLUMN payment_method_id;
    ALTER TABLE import_batches RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE import_batches RENAME COLUMN pm_id_new TO payment_method_id;
    ALTER TABLE import_batches ALTER COLUMN household_id SET NOT NULL;
    ALTER TABLE import_batches ALTER COLUMN payment_method_id SET NOT NULL;

    ALTER TABLE installment_plans DROP CONSTRAINT installment_plans_pkey;
    ALTER TABLE installment_plans DROP COLUMN id;
    ALTER TABLE installment_plans RENAME COLUMN new_id TO id;
    ALTER TABLE installment_plans ADD PRIMARY KEY (id);
    ALTER TABLE installment_plans DROP COLUMN household_id;
    ALTER TABLE installment_plans RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE installment_plans ALTER COLUMN household_id SET NOT NULL;

    ALTER TABLE transactions DROP CONSTRAINT transactions_pkey;
    ALTER TABLE transactions DROP COLUMN id;
    ALTER TABLE transactions RENAME COLUMN new_id TO id;
    ALTER TABLE transactions ADD PRIMARY KEY (id);
    ALTER TABLE transactions DROP COLUMN household_id;
    ALTER TABLE transactions DROP COLUMN import_batch_id;
    ALTER TABLE transactions DROP COLUMN payment_method_id;
    ALTER TABLE transactions DROP COLUMN payer_user_id;
    ALTER TABLE transactions DROP COLUMN category_id;
    ALTER TABLE transactions DROP COLUMN installment_plan_id;
    ALTER TABLE transactions RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE transactions RENAME COLUMN ib_id_new TO import_batch_id;
    ALTER TABLE transactions RENAME COLUMN pm_id_new TO payment_method_id;
    ALTER TABLE transactions RENAME COLUMN payer_uid_new TO payer_user_id;
    ALTER TABLE transactions RENAME COLUMN cat_id_new TO category_id;
    ALTER TABLE transactions RENAME COLUMN ip_id_new TO installment_plan_id;
    ALTER TABLE transactions ALTER COLUMN household_id SET NOT NULL;
    ALTER TABLE transactions ALTER COLUMN payment_method_id SET NOT NULL;
    ALTER TABLE transactions ALTER COLUMN payer_user_id SET NOT NULL;

    ALTER TABLE split_allocations DROP CONSTRAINT split_allocations_pkey;
    ALTER TABLE split_allocations DROP COLUMN id;
    ALTER TABLE split_allocations RENAME COLUMN new_id TO id;
    ALTER TABLE split_allocations ADD PRIMARY KEY (id);
    ALTER TABLE split_allocations DROP COLUMN transaction_id;
    ALTER TABLE split_allocations DROP COLUMN user_id;
    ALTER TABLE split_allocations RENAME COLUMN tx_id_new TO transaction_id;
    ALTER TABLE split_allocations RENAME COLUMN user_id_new TO user_id;
    ALTER TABLE split_allocations ALTER COLUMN transaction_id SET NOT NULL;
    ALTER TABLE split_allocations ALTER COLUMN user_id SET NOT NULL;

    ALTER TABLE settlements DROP CONSTRAINT settlements_pkey;
    ALTER TABLE settlements DROP COLUMN id;
    ALTER TABLE settlements RENAME COLUMN new_id TO id;
    ALTER TABLE settlements ADD PRIMARY KEY (id);
    ALTER TABLE settlements DROP COLUMN household_id;
    ALTER TABLE settlements DROP COLUMN deudor_user_id;
    ALTER TABLE settlements DROP COLUMN acreedor_user_id;
    ALTER TABLE settlements RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE settlements RENAME COLUMN deudor_uid_new TO deudor_user_id;
    ALTER TABLE settlements RENAME COLUMN acreedor_uid_new TO acreedor_user_id;
    ALTER TABLE settlements ALTER COLUMN household_id SET NOT NULL;
    ALTER TABLE settlements ALTER COLUMN deudor_user_id SET NOT NULL;
    ALTER TABLE settlements ALTER COLUMN acreedor_user_id SET NOT NULL;

    -- Restore FK constraints with explicit names
    ALTER TABLE household_members ADD CONSTRAINT hm_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE household_members ADD CONSTRAINT hm_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
    ALTER TABLE categories ADD CONSTRAINT cat_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE categories ADD CONSTRAINT cat_parent_fk FOREIGN KEY (parent_id) REFERENCES categories(id);
    ALTER TABLE payment_methods ADD CONSTRAINT pm_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE payment_methods ADD CONSTRAINT pm_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id);
    ALTER TABLE merchant_rules ADD CONSTRAINT mr_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE merchant_rules ADD CONSTRAINT mr_cat_fk FOREIGN KEY (category_id) REFERENCES categories(id);
    ALTER TABLE import_batches ADD CONSTRAINT ib_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE import_batches ADD CONSTRAINT ib_pm_fk FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id);
    ALTER TABLE installment_plans ADD CONSTRAINT ip_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_ib_fk FOREIGN KEY (import_batch_id) REFERENCES import_batches(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_pm_fk FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_payer_fk FOREIGN KEY (payer_user_id) REFERENCES users(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_cat_fk FOREIGN KEY (category_id) REFERENCES categories(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_ip_fk FOREIGN KEY (installment_plan_id) REFERENCES installment_plans(id);
    ALTER TABLE split_allocations ADD CONSTRAINT sa_tx_fk FOREIGN KEY (transaction_id) REFERENCES transactions(id);
    ALTER TABLE split_allocations ADD CONSTRAINT sa_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
    ALTER TABLE settlements ADD CONSTRAINT set_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE settlements ADD CONSTRAINT set_deudor_fk FOREIGN KEY (deudor_user_id) REFERENCES users(id);
    ALTER TABLE settlements ADD CONSTRAINT set_acreedor_fk FOREIGN KEY (acreedor_user_id) REFERENCES users(id);
    """)


def downgrade() -> None:
    raise NotImplementedError("UUID->SERIAL migration is not reversible")
