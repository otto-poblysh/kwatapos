use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct Order {
    pub id: Uuid,
    pub payment_method: String,
    pub total_amount: f64,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct OrderItem {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Uuid,
    pub quantity: i32,
    pub unit_price: f64,
    pub created_at: DateTime<Utc>,
}

pub async fn create_order_tx<'a>(
    tx: &mut Transaction<'a, Postgres>,
    payment_method: &str,
    total_amount: f64,
    status: &str,
) -> Result<Order, sqlx::Error> {
    sqlx::query_as::<_, Order>(
        "INSERT INTO orders (payment_method, total_amount, status) \
         VALUES ($1, $2, $3) \
         RETURNING id, payment_method, total_amount, status, created_at",
    )
    .bind(payment_method)
    .bind(total_amount)
    .bind(status)
    .fetch_one(&mut **tx)
    .await
}

pub async fn create_order_item_tx<'a>(
    tx: &mut Transaction<'a, Postgres>,
    order_id: Uuid,
    product_id: Uuid,
    quantity: i32,
    unit_price: f64,
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
        "SELECT id, payment_method, total_amount, status, created_at FROM orders WHERE id = $1",
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
