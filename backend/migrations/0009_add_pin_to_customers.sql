-- Customer portal PIN. Existing customers receive the hashed default PIN 0000.
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) NOT NULL
    DEFAULT '$argon2id$v=19$m=19456,t=2,p=1$a3dhdGFwb3NfcGluX3NhbHQ$C1iR4xIOhM/4wrDqoaYXyBm46ATY5UMuwpxXOlOZLlo';

ALTER TABLE customers
    ALTER COLUMN pin_hash DROP DEFAULT;
