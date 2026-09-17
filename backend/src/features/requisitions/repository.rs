use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct Requisition {
    pub id: Uuid,
    pub token: Uuid,
    pub title: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct RequisitionItem {
    pub id: Uuid,
    pub requisition_id: Uuid,
    pub product_id: Uuid,
    pub quantity: i32,
    pub expected_price: Decimal,
    pub confirmed_price: Option<Decimal>,
    pub received_quantity: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct RequisitionItemDetail {
    pub id: Uuid,
    pub requisition_id: Uuid,
    pub product_id: Uuid,
    pub product_name: String,
    pub quantity: i32,
    pub expected_price: Decimal,
    pub confirmed_price: Option<Decimal>,
    pub received_quantity: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RequisitionWithItems {
    pub requisition: Requisition,
    pub items: Vec<RequisitionItemDetail>,
}

pub async fn create_requisition_tx(
    tx: &mut Transaction<'_, Postgres>,
    title: &str,
) -> Result<Requisition, sqlx::Error> {
    sqlx::query_as::<_, Requisition>(
        "INSERT INTO requisitions (title, status, updated_at) \
         VALUES ($1, 'draft', NOW()) \
         RETURNING id, token, title, status, created_at, updated_at",
    )
    .bind(title)
    .fetch_one(&mut **tx)
    .await
}

pub async fn add_requisition_item_tx(
    tx: &mut Transaction<'_, Postgres>,
    requisition_id: Uuid,
    product_id: Uuid,
    quantity: i32,
    expected_price: Decimal,
) -> Result<RequisitionItem, sqlx::Error> {
    sqlx::query_as::<_, RequisitionItem>(
        "INSERT INTO requisition_items (requisition_id, product_id, quantity, expected_price) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, requisition_id, product_id, quantity, expected_price, confirmed_price, received_quantity, created_at",
    )
    .bind(requisition_id)
    .bind(product_id)
    .bind(quantity)
    .bind(expected_price)
    .fetch_one(&mut **tx)
    .await
}

pub async fn get_requisitions(pool: &PgPool) -> Result<Vec<Requisition>, sqlx::Error> {
    sqlx::query_as::<_, Requisition>(
        "SELECT id, token, title, status, created_at, updated_at \
         FROM requisitions ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_requisition_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Requisition>, sqlx::Error> {
    sqlx::query_as::<_, Requisition>(
        "SELECT id, token, title, status, created_at, updated_at \
         FROM requisitions WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_requisition_by_id_tx(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> Result<Option<Requisition>, sqlx::Error> {
    sqlx::query_as::<_, Requisition>(
        "SELECT id, token, title, status, created_at, updated_at \
         FROM requisitions WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
}

pub async fn get_requisition_by_token(pool: &PgPool, token: Uuid) -> Result<Option<Requisition>, sqlx::Error> {
    sqlx::query_as::<_, Requisition>(
        "SELECT id, token, title, status, created_at, updated_at \
         FROM requisitions WHERE token = $1",
    )
    .bind(token)
    .fetch_optional(pool)
    .await
}

pub async fn get_requisition_items(
    pool: &PgPool,
    requisition_id: Uuid,
) -> Result<Vec<RequisitionItemDetail>, sqlx::Error> {
    sqlx::query_as::<_, RequisitionItemDetail>(
        "SELECT ri.id, ri.requisition_id, ri.product_id, p.name AS product_name, \
         ri.quantity, ri.expected_price, ri.confirmed_price, ri.received_quantity, ri.created_at \
         FROM requisition_items ri \
         JOIN products p ON ri.product_id = p.id \
         WHERE ri.requisition_id = $1 \
         ORDER BY ri.created_at ASC",
    )
    .bind(requisition_id)
    .fetch_all(pool)
    .await
}

pub async fn get_requisition_items_tx(
    tx: &mut Transaction<'_, Postgres>,
    requisition_id: Uuid,
) -> Result<Vec<RequisitionItemDetail>, sqlx::Error> {
    sqlx::query_as::<_, RequisitionItemDetail>(
        "SELECT ri.id, ri.requisition_id, ri.product_id, p.name AS product_name, \
         ri.quantity, ri.expected_price, ri.confirmed_price, ri.received_quantity, ri.created_at \
         FROM requisition_items ri \
         JOIN products p ON ri.product_id = p.id \
         WHERE ri.requisition_id = $1 \
         ORDER BY ri.created_at ASC",
    )
    .bind(requisition_id)
    .fetch_all(&mut **tx)
    .await
}

pub async fn update_requisition_status_tx(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    status: &str,
) -> Result<Requisition, sqlx::Error> {
    sqlx::query_as::<_, Requisition>(
        "UPDATE requisitions \
         SET status = $2, updated_at = NOW() \
         WHERE id = $1 \
         RETURNING id, token, title, status, created_at, updated_at",
    )
    .bind(id)
    .bind(status)
    .fetch_one(&mut **tx)
    .await
}

pub async fn update_item_confirmed_price_tx(
    tx: &mut Transaction<'_, Postgres>,
    item_id: Uuid,
    confirmed_price: Decimal,
) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        "UPDATE requisition_items \
         SET confirmed_price = $2 \
         WHERE id = $1",
    )
    .bind(item_id)
    .bind(confirmed_price)
    .execute(&mut **tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    Ok(())
}

pub async fn update_item_received_quantity_tx(
    tx: &mut Transaction<'_, Postgres>,
    item_id: Uuid,
    received_quantity: i32,
) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        "UPDATE requisition_items \
         SET received_quantity = $2 \
         WHERE id = $1",
    )
    .bind(item_id)
    .bind(received_quantity)
    .execute(&mut **tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    Ok(())
}

pub async fn increment_inventory_tx(
    tx: &mut Transaction<'_, Postgres>,
    product_id: Uuid,
    delta: i32,
) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO inventory (product_id, quantity, updated_at) \
         VALUES ($1, $2, NOW()) \
         ON CONFLICT (product_id) \
         DO UPDATE SET quantity = inventory.quantity + $2, updated_at = NOW()",
    )
    .bind(product_id)
    .bind(delta)
    .execute(&mut **tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    Ok(())
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct RequisitionSummary {
    pub id: Uuid,
    pub token: Uuid,
    pub title: String,
    pub status: String,
    pub item_count: i64,
    pub total_estimated_cost: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub async fn get_requisition_summaries(
    pool: &PgPool,
) -> Result<Vec<RequisitionSummary>, sqlx::Error> {
    sqlx::query_as::<_, RequisitionSummary>(
        "SELECT \
             r.id, \
             r.token, \
             r.title, \
             r.status, \
             COALESCE(COUNT(ri.id), 0)::BIGINT AS item_count, \
             COALESCE(SUM(ri.quantity * ri.expected_price), 0)::NUMERIC AS total_estimated_cost, \
             r.created_at, \
             r.updated_at \
         FROM requisitions r \
         LEFT JOIN requisition_items ri ON ri.requisition_id = r.id \
         GROUP BY r.id \
         ORDER BY r.created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_requisition_by_token_tx(
    tx: &mut Transaction<'_, Postgres>,
    token: Uuid,
) -> Result<Option<Requisition>, sqlx::Error> {
    sqlx::query_as::<_, Requisition>(
        "SELECT id, token, title, status, created_at, updated_at \
         FROM requisitions WHERE token = $1",
    )
    .bind(token)
    .fetch_optional(&mut **tx)
    .await
}

