-- ============================================================
-- Migration: Align cloud schema for mobile app companion
-- Date: 2026-05-26
-- Purpose: Add missing columns to cloud tables so the desktop
--          sync service can push ALL local data to the cloud,
--          enabling the mobile app to read complete records.
-- ============================================================

-- 1. cloud_tariffs: missing billing_months and amount_is_total
ALTER TABLE cloud_tariffs ADD COLUMN IF NOT EXISTS billing_months INTEGER DEFAULT 1;
ALTER TABLE cloud_tariffs ADD COLUMN IF NOT EXISTS amount_is_total INTEGER DEFAULT 0;

-- 2. cloud_payments: missing payment_method and payment_group_id
ALTER TABLE cloud_payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Efectivo';
ALTER TABLE cloud_payments ADD COLUMN IF NOT EXISTS payment_group_id TEXT;

-- 3. cloud_exercises: missing category and equipment columns (present in local schema)
ALTER TABLE cloud_exercises ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE cloud_exercises ADD COLUMN IF NOT EXISTS equipment TEXT;
