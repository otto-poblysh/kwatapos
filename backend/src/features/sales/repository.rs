use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct Order {
    pub id: Uuid,
    pub order_name: Option<String>,
    pub payment_method: Option<String>,
    pub total_amount: Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct OrderItem {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Uuid,
    pub quantity: i32,
    pub unit_price: Decimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct OrderItemWithProduct {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Uuid,
    pub product_name: String,
    pub quantity: i32,
    pub unit_price: Decimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct OrderWithItemCount {
    pub id: Uuid,
    pub order_name: Option<String>,
    pub payment_method: Option<String>,
    pub total_amount: Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub items_count: i64,
}

pub async fn create_order_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_name: Option<&str>,
    payment_method: Option<&str>,
    total_amount: Decimal,
    status: &str,
) -> Result<Order, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "INSERT INTO orders (order_name, payment_method, total_amount, status, updated_at) \
         VALUES ($1, $2, $3, $4, NOW()) \
         RETURNING id, order_name, payment_method, total_amount, status, created_at, updated_at",
    )
    .bind(order_name)
    .bind(payment_method)
    .bind(total_amount)
    .bind(status)
    .fetch_one(&mut **tx)
    .await
}

pub async fn create_open_order(
    pool: &PgPool,
    order_name: Option<&str>,
) -> Result<Order, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "INSERT INTO orders (order_name, payment_method, total_amount, status, updated_at) \
         VALUES ($1, NULL, 0.00, 'open', NOW()) \
         RETURNING id, order_name, payment_method, total_amount, status, created_at, updated_at",
    )
    .bind(order_name)
    .fetch_one(pool)
    .await
}

pub async fn create_open_order_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_name: Option<&str>,
) -> Result<Order, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "INSERT INTO orders (order_name, payment_method, total_amount, status, updated_at) \
         VALUES ($1, NULL, 0.00, 'open', NOW()) \
         RETURNING id, order_name, payment_method, total_amount, status, created_at, updated_at",
    )
    .bind(order_name)
    .fetch_one(&mut **tx)
    .await
}

pub async fn get_open_orders(pool: &PgPool) -> Result<Vec<Order>, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "SELECT id, order_name, payment_method, total_amount, status, created_at, updated_at \
         FROM orders WHERE status = 'open' ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_open_orders_with_count(
    pool: &PgPool,
) -> Result<Vec<OrderWithItemCount>, sqlx::Error> {
    sqlx::query_as::<_, OrderWithItemCount>(
        "SELECT o.id, o.order_name, o.payment_method, o.total_amount, o.status, o.created_at, o.updated_at, \
         COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0)::BIGINT AS items_count \
         FROM orders o \
         WHERE o.status = 'open' \
         ORDER BY o.updated_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn update_order_total_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
    total_amount: Decimal,
) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        "UPDATE orders SET total_amount = $2, updated_at = NOW() WHERE id = $1",
    )
    .bind(order_id)
    .bind(total_amount)
    .execute(&mut **tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    Ok(())
}

pub async fn settle_order_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
    payment_method: &str,
) -> Result<Order, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "UPDATE orders SET payment_method = $2, status = 'completed', updated_at = NOW() \
         WHERE id = $1 AND status = 'open' \
         RETURNING id, order_name, payment_method, total_amount, status, created_at, updated_at",
    )
    .bind(order_id)
    .bind(payment_method)
    .fetch_one(&mut **tx)
    .await
}

pub async fn create_order_item_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
    product_id: Uuid,
    quantity: i32,
    unit_price: Decimal,
) -> Result<OrderItem, sqlx::Error> {
    sqlx::query_as::<_, OrderItem>(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, order_id, product_id, quantity, unit_price, created_at",
    )
    .bind(order_id)
    .bind(product_id)
    .bind(quantity)
    .bind(unit_price)
    .fetch_one(&mut **tx)
    .await
}

pub async fn delete_order_items_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query("DELETE FROM order_items WHERE order_id = $1")
        .bind(order_id)
        .execute(&mut **tx)
        .await?;
    Ok(result.rows_affected())
}

pub async fn get_order_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Order>, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "SELECT id, order_name, payment_method, total_amount, status, created_at, updated_at \
         FROM orders WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_order_by_id_tx(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> Result<Option<Order>, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "SELECT id, order_name, payment_method, total_amount, status, created_at, updated_at \
         FROM orders WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
}

pub async fn get_order_items_by_order_id(
    pool: &PgPool,
    order_id: Uuid,
) -> Result<Vec<OrderItem>, sqlx::Error> {
    sqlx::query_as::<_, OrderItem>(
        "SELECT id, order_id, product_id, quantity, unit_price, created_at \
         FROM order_items WHERE order_id = $1 ORDER BY created_at ASC",
    )
    .bind(order_id)
    .fetch_all(pool)
    .await
}

pub async fn get_order_items_with_product(
    pool: &PgPool,
    order_id: Uuid,
) -> Result<Vec<OrderItemWithProduct>, sqlx::Error> {
    sqlx::query_as::<_, OrderItemWithProduct>(
        "SELECT oi.id, oi.order_id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price, oi.created_at \
         FROM order_items oi \
         JOIN products p ON oi.product_id = p.id \
         WHERE oi.order_id = $1 \
         ORDER BY oi.created_at ASC",
    )
    .bind(order_id)
    .fetch_all(pool)
    .await
}

pub async fn get_order_items_with_product_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
) -> Result<Vec<OrderItemWithProduct>, sqlx::Error> {
    sqlx::query_as::<_, OrderItemWithProduct>(
        "SELECT oi.id, oi.order_id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price, oi.created_at \
         FROM order_items oi \
         JOIN products p ON oi.product_id = p.id \
         WHERE oi.order_id = $1 \
         ORDER BY oi.created_at ASC",
    )
    .bind(order_id)
    .fetch_all(&mut **tx)
    .await
}
