use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct DirectExpense {
    pub id: Uuid,
    pub requested_by: Option<Uuid>,
    pub category: String,
    pub amount: Decimal,
    pub status: String,
    pub receipt_image_url: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub async fn create_expense(
    pool: &PgPool,
    requested_by: Option<Uuid>,
    category: &str,
    amount: Decimal,
    notes: Option<&str>,
) -> Result<DirectExpense, sqlx::Error> {
    sqlx::query_as::<_, DirectExpense>(
        "INSERT INTO direct_expenses (requested_by, category, amount, notes, status, updated_at) \
         VALUES ($1, $2, $3, $4, 'requested', NOW()) \
         RETURNING id, requested_by, category, amount, status, receipt_image_url, notes, created_at, updated_at",
    )
    .bind(requested_by)
    .bind(category)
    .bind(amount)
    .bind(notes)
    .fetch_one(pool)
    .await
}

pub async fn create_expense_tx(
    tx: &mut Transaction<'_, Postgres>,
    requested_by: Option<Uuid>,
    category: &str,
    amount: Decimal,
    notes: Option<&str>,
) -> Result<DirectExpense, sqlx::Error> {
    sqlx::query_as::<_, DirectExpense>(
        "INSERT INTO direct_expenses (requested_by, category, amount, notes, status, updated_at) \
         VALUES ($1, $2, $3, $4, 'requested', NOW()) \
         RETURNING id, requested_by, category, amount, status, receipt_image_url, notes, created_at, updated_at",
    )
    .bind(requested_by)
    .bind(category)
    .bind(amount)
    .bind(notes)
    .fetch_one(&mut **tx)
    .await
}

pub async fn get_all_expenses(pool: &PgPool) -> Result<Vec<DirectExpense>, sqlx::Error> {
    sqlx::query_as::<_, DirectExpense>(
        "SELECT id, requested_by, category, amount, status, receipt_image_url, notes, created_at, updated_at \
         FROM direct_expenses ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_expense_by_id(pool: &PgPool, id: Uuid) -> Result<Option<DirectExpense>, sqlx::Error> {
    sqlx::query_as::<_, DirectExpense>(
        "SELECT id, requested_by, category, amount, status, receipt_image_url, notes, created_at, updated_at \
         FROM direct_expenses WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn update_expense_status(
    pool: &PgPool,
    id: Uuid,
    status: &str,
) -> Result<DirectExpense, sqlx::Error> {
    sqlx::query_as::<_, DirectExpense>(
        "UPDATE direct_expenses \
         SET status = $2, updated_at = NOW() \
         WHERE id = $1 \
         RETURNING id, requested_by, category, amount, status, receipt_image_url, notes, created_at, updated_at",
    )
    .bind(id)
    .bind(status)
    .fetch_one(pool)
    .await
}

pub async fn attach_receipt(
    pool: &PgPool,
    id: Uuid,
    receipt_image_url: &str,
) -> Result<DirectExpense, sqlx::Error> {
    sqlx::query_as::<_, DirectExpense>(
        "UPDATE direct_expenses \
         SET receipt_image_url = $2, updated_at = NOW() \
         WHERE id = $1 \
         RETURNING id, requested_by, category, amount, status, receipt_image_url, notes, created_at, updated_at",
    )
    .bind(id)
    .bind(receipt_image_url)
    .fetch_one(pool)
    .await
}

pub async fn attach_receipt_and_update_status(
    pool: &PgPool,
    id: Uuid,
    receipt_image_url: &str,
    status: &str,
) -> Result<Option<DirectExpense>, sqlx::Error> {
    sqlx::query_as::<_, DirectExpense>(
        "UPDATE direct_expenses \
         SET receipt_image_url = $2, status = $3, updated_at = NOW() \
         WHERE id = $1 \
         RETURNING id, requested_by, category, amount, status, receipt_image_url, notes, created_at, updated_at",
    )
    .bind(id)
    .bind(receipt_image_url)
    .bind(status)
    .fetch_optional(pool)
    .await
}

