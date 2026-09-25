-- Migration: Add expires_at to servers table
-- Hostinger VPS (and other providers) expose an expiration / billing-cycle end date.
-- This nullable timestamp records when the server subscription expires.

ALTER TABLE servers ADD COLUMN IF NOT EXISTS expires_at timestamptz;
