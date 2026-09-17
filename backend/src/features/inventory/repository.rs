use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct Product {
    pub id: Uuid,
    pub name: String,
    pub price: f64,
    pub category: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq, Eq)]
pub struct Inventory {
    pub product_id: Uuid,
    pub quantity: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, PartialEq)]
pub struct ProductWithInventory {
    pub id: Uuid,
    pub name: String,
    pub price: f64,
    pub category: String,
    pub created_at: DateTime<Utc>,
    pub quantity: i32,
}

pub async fn get_all_products(pool: &PgPool) -> Result<Vec<Product>, sqlx::Error> {
    sqlx::query_as::<_, Product>(
        "SELECT id, name, price, category, created_at FROM products ORDER BY name ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_product_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Product>, sqlx::Error> {
    sqlx::query_as::<_, Product>(
        "SELECT id, name, price, category, created_at FROM products WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_inventory(pool: &PgPool, product_id: Uuid) -> Result<Option<Inventory>, sqlx::Error> {
    sqlx::query_as::<_, Inventory>(
        "SELECT product_id, quantity, updated_at FROM inventory WHERE product_id = $1",
    )
    .bind(product_id)
    .fetch_optional(pool)
    .await
}

pub async fn get_all_products_with_inventory(
    pool: &PgPool,
) -> Result<Vec<ProductWithInventory>, sqlx::Error> {
    sqlx::query_as::<_, ProductWithInventory>(
        "SELECT p.id, p.name, p.price, p.category, p.created_at, COALESCE(i.quantity, 0) as quantity \
         FROM products p \
         LEFT JOIN inventory i ON p.id = i.product_id \
         ORDER BY p.name ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn decrement_inventory(
    pool: &PgPool,
    product_id: Uuid,
    quantity: i32,
) -> Result<Inventory, sqlx::Error> {
    sqlx::query_as::<_, Inventory>(
        "UPDATE inventory \
         SET quantity = quantity - $1, updated_at = NOW() \
         WHERE product_id = $2 \
         RETURNING product_id, quantity, updated_at",
    )
    .bind(quantity)
    .bind(product_id)
    .fetch_one(pool)
    .await
}

pub async fn decrement_inventory_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Postgres>,
    product_id: Uuid,
    quantity: i32,
) -> Result<Inventory, sqlx::Error> {
    sqlx::query_as::<_, Inventory>(
        "UPDATE inventory \
         SET quantity = quantity - $1, updated_at = NOW() \
         WHERE product_id = $2 \
         RETURNING product_id, quantity, updated_at",
    )
    .bind(quantity)
    .bind(product_id)
    .fetch_one(&mut **tx)
    .await
}

pub async fn create_product(
    pool: &PgPool,
    name: &str,
    price: f64,
    category: &str,
) -> Result<Product, sqlx::Error> {
    sqlx::query_as::<_, Product>(
        "INSERT INTO products (name, price, category) \
         VALUES ($1, $2, $3) \
         RETURNING id, name, price, category, created_at",
    )
    .bind(name)
    .bind(price)
    .bind(category)
    .fetch_one(pool)
    .await
}

pub async fn set_inventory(
    pool: &PgPool,
    product_id: Uuid,
    quantity: i32,
) -> Result<Inventory, sqlx::Error> {
    sqlx::query_as::<_, Inventory>(
        "INSERT INTO inventory (product_id, quantity) \
         VALUES ($1, $2) \
         ON CONFLICT (product_id) \
         DO UPDATE SET quantity = $2, updated_at = NOW() \
         RETURNING product_id, quantity, updated_at",
    )
    .bind(product_id)
    .bind(quantity)
    .fetch_one(pool)
    .await
}
