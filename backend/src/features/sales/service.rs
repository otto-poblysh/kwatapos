use sqlx::PgPool;
use uuid::Uuid;

use crate::features::inventory::repository::{
    decrement_inventory_tx, get_all_products_with_inventory, Product, ProductWithInventory,
};

use super::{
    dto::{CreateCashOrderRequest, OrderItemResponse, OrderResponse},
    repository,
};

#[derive(Debug)]
pub enum SalesError {
    EmptyItems,
    InvalidQuantity(String),
    ProductNotFound(Uuid),
    InsufficientStock(Uuid),
    Database(sqlx::Error),
}

impl std::fmt::Display for SalesError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyItems => write!(f, "Order must contain at least one item"),
            Self::InvalidQuantity(msg) => write!(f, "Invalid quantity: {}", msg),
            Self::ProductNotFound(id) => write!(f, "Product not found: {}", id),
            Self::InsufficientStock(id) => write!(f, "Insufficient stock for product {}", id),
            Self::Database(e) => write!(f, "Database error: {}", e),
        }
    }
}

impl std::error::Error for SalesError {}

pub async fn get_products(pool: &PgPool) -> Result<Vec<ProductWithInventory>, SalesError> {
    get_all_products_with_inventory(pool)
        .await
        .map_err(SalesError::Database)
}

pub async fn create_cash_order(
    pool: &PgPool,
    payload: CreateCashOrderRequest,
) -> Result<OrderResponse, SalesError> {
    if payload.items.is_empty() {
        return Err(SalesError::EmptyItems);
    }

    for item in &payload.items {
        if item.quantity <= 0 {
            return Err(SalesError::InvalidQuantity(
                "Quantity must be greater than zero".into(),
            ));
        }
    }

    let mut tx = pool.begin().await.map_err(SalesError::Database)?;

    let mut total_amount: f64 = 0.0;
    let mut resolved_items: Vec<(Uuid, i32, f64)> = Vec::with_capacity(payload.items.len());

    for item in &payload.items {
        let product = sqlx::query_as::<_, Product>(
            "SELECT id, name, price, category, created_at FROM products WHERE id = $1",
        )
        .bind(item.product_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(SalesError::Database)?
        .ok_or(SalesError::ProductNotFound(item.product_id))?;

        match decrement_inventory_tx(&mut tx, item.product_id, item.quantity).await {
            Ok(_) => {}
            Err(sqlx::Error::RowNotFound) => {
                return Err(SalesError::InsufficientStock(item.product_id));
            }
            Err(e) => return Err(SalesError::Database(e)),
        }

        total_amount += product.price * (item.quantity as f64);
        resolved_items.push((item.product_id, item.quantity, product.price));
    }

    let order = repository::create_order_tx(&mut tx, "cash", total_amount, "completed")
        .await
        .map_err(SalesError::Database)?;

    let mut item_responses = Vec::with_capacity(resolved_items.len());
    for (product_id, quantity, unit_price) in resolved_items {
        let order_item = repository::create_order_item_tx(
            &mut tx,
            order.id,
            product_id,
            quantity,
            unit_price,
        )
        .await
        .map_err(SalesError::Database)?;

        item_responses.push(OrderItemResponse {
            id: order_item.id,
            order_id: order_item.order_id,
            product_id: order_item.product_id,
            quantity: order_item.quantity,
            unit_price: order_item.unit_price,
        });
    }

    tx.commit().await.map_err(SalesError::Database)?;

    Ok(OrderResponse {
        id: order.id,
        payment_method: order.payment_method,
        status: order.status,
        total_amount: order.total_amount,
        items: item_responses,
        created_at: order.created_at,
    })
}
