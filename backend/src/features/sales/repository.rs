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

pub async fn update_order_total_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
    total_amount: Decimal,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE orders SET total_amount = $2, updated_at = NOW() WHERE id = $1",
    )
    .bind(order_id)
    .bind(total_amount)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

pub async fn settle_order_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
    payment_method: &str,
) -> Result<Order, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "UPDATE orders SET payment_method = $2, status = 'completed', updated_at = NOW() \
         WHERE id = $1 \
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

pub async fn get_order_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Order>, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "SELECT id, order_name, payment_method, total_amount, status, created_at, updated_at \
         FROM orders WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
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
