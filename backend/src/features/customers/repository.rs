use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct Customer {
    pub id: Uuid,
    pub name: String,
    pub phone_number: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct Credit {
    pub id: Uuid,
    pub customer_id: Uuid,
    pub order_id: Uuid,
    pub amount: Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

pub async fn find_by_phone(pool: &PgPool, phone: &str) -> Result<Option<Customer>, sqlx::Error> {
    let clean_phone = phone.trim();
    sqlx::query_as::<_, Customer>(
        "SELECT id, name, phone_number, created_at FROM customers WHERE phone_number = $1",
    )
    .bind(clean_phone)
    .fetch_optional(pool)
    .await
}

#[derive(Debug, Clone, FromRow)]
pub struct CustomerAuth {
    pub id: Uuid,
    pub name: String,
    pub phone_number: String,
    pub pin_hash: String,
    pub created_at: DateTime<Utc>,
}

pub async fn create_customer(
    pool: &PgPool,
    name: &str,
    phone: &str,
    pin_hash: &str,
) -> Result<Customer, sqlx::Error> {
    let clean_name = name.trim();
    let clean_phone = phone.trim();
    sqlx::query_as::<_, Customer>(
        "INSERT INTO customers (name, phone_number, pin_hash) \
         VALUES ($1, $2, $3) \
         RETURNING id, name, phone_number, created_at",
    )
    .bind(clean_name)
    .bind(clean_phone)
    .bind(pin_hash)
    .fetch_one(pool)
    .await
}

pub async fn find_auth_by_phone(
    pool: &PgPool,
    phone: &str,
) -> Result<Option<CustomerAuth>, sqlx::Error> {
    let clean_phone = phone.trim();
    sqlx::query_as::<_, CustomerAuth>(
        "SELECT id, name, phone_number, pin_hash, created_at \
         FROM customers WHERE phone_number = $1",
    )
    .bind(clean_phone)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Customer>, sqlx::Error> {
    sqlx::query_as::<_, Customer>(
        "SELECT id, name, phone_number, created_at FROM customers WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_id_tx(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> Result<Option<Customer>, sqlx::Error> {
    sqlx::query_as::<_, Customer>(
        "SELECT id, name, phone_number, created_at FROM customers WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
}

pub async fn create_credit_tx(
    tx: &mut Transaction<'_, Postgres>,
    customer_id: Uuid,
    order_id: Uuid,
    amount: Decimal,
    status: &str,
) -> Result<Credit, sqlx::Error> {
    sqlx::query_as::<_, Credit>(
        "INSERT INTO credits (customer_id, order_id, amount, status) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, customer_id, order_id, amount, status, created_at",
    )
    .bind(customer_id)
    .bind(order_id)
    .bind(amount)
    .bind(status)
    .fetch_one(&mut **tx)
    .await
}

pub async fn get_credits_by_customer(
    pool: &PgPool,
    customer_id: Uuid,
) -> Result<Vec<Credit>, sqlx::Error> {
    sqlx::query_as::<_, Credit>(
        "SELECT id, customer_id, order_id, amount, status, created_at \
         FROM credits WHERE customer_id = $1 ORDER BY created_at DESC",
    )
    .bind(customer_id)
    .fetch_all(pool)
    .await
}

pub async fn get_outstanding_balance(
    pool: &PgPool,
    customer_id: Uuid,
) -> Result<Decimal, sqlx::Error> {
    sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM credits \
         WHERE customer_id = $1 AND status = 'unpaid'",
    )
    .bind(customer_id)
    .fetch_one(pool)
    .await
}
