use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use crate::features::inventory::repository::{
    decrement_inventory_tx, get_all_products_with_inventory, get_product_by_id_tx,
    ProductWithInventory,
};

use super::{
    dto::{
        CreateCashOrderRequest, OrderDetailResponse, OrderItemDetailResponse, OrderItemResponse,
        OrderResponse, OrderSummaryResponse, SettleOrderRequest, UpdateOrderItemsRequest,
    },
    repository,
};

#[derive(Debug)]
pub enum SalesError {
    EmptyItems,
    InvalidQuantity(String),
    ProductNotFound(Uuid),
    InsufficientStock(Uuid),
    OrderNotFound(Uuid),
    OrderNotOpen(Uuid),
    EmptyTab(Uuid),
    InvalidPaymentMethod(String),
    CustomerIdRequired,
    CustomerNotFound(Uuid),
    Database(sqlx::Error),
}

impl std::fmt::Display for SalesError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyItems => write!(f, "Order must contain at least one item"),
            Self::InvalidQuantity(msg) => write!(f, "Invalid quantity: {}", msg),
            Self::ProductNotFound(id) => write!(f, "Product not found: {}", id),
            Self::InsufficientStock(id) => write!(f, "Insufficient stock for product {}", id),
            Self::OrderNotFound(id) => write!(f, "Order not found: {}", id),
            Self::OrderNotOpen(id) => write!(f, "Order {} is not open", id),
            Self::EmptyTab(id) => write!(f, "Cannot settle empty tab {}", id),
            Self::InvalidPaymentMethod(msg) => write!(f, "{}", msg),
            Self::CustomerIdRequired => write!(f, "customer_id is required for credit payments"),
            Self::CustomerNotFound(id) => write!(f, "Customer not found: {}", id),
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

    // Sort items by product_id to ensure deterministic lock acquisition and prevent deadlocks
    let mut items = payload.items;
    items.sort_by_key(|item| item.product_id);

    let mut tx = pool.begin().await.map_err(SalesError::Database)?;

    let mut total_amount = Decimal::ZERO;
    let mut resolved_items: Vec<(Uuid, i32, Decimal)> = Vec::with_capacity(items.len());

    for item in &items {
        let product = get_product_by_id_tx(&mut tx, item.product_id)
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

        let unit_price = product.price;
        total_amount += unit_price * Decimal::from(item.quantity);
        resolved_items.push((item.product_id, item.quantity, unit_price));
    }

    let order =
        repository::create_order_tx(&mut tx, None, Some("cash"), total_amount, "completed")
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
        payment_method: order.payment_method.unwrap_or_else(|| "cash".to_string()),
        status: order.status,
        total_amount: order.total_amount,
        items: item_responses,
        created_at: order.created_at,
    })
}

fn rescale_2(mut d: Decimal) -> Decimal {
    d.rescale(2);
    d
}

pub async fn create_open_order(
    pool: &PgPool,
    order_name: Option<String>,
) -> Result<OrderDetailResponse, SalesError> {
    let trimmed_name = order_name.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let order = repository::create_open_order(pool, trimmed_name)
        .await
        .map_err(SalesError::Database)?;

    Ok(OrderDetailResponse {
        id: order.id,
        order_name: order.order_name,
        payment_method: order.payment_method,
        total_amount: rescale_2(order.total_amount),
        status: order.status,
        items: Vec::new(),
        created_at: order.created_at,
        updated_at: order.updated_at,
    })
}

pub async fn get_open_orders(pool: &PgPool) -> Result<Vec<OrderSummaryResponse>, SalesError> {
    let orders = repository::get_open_orders_with_count(pool)
        .await
        .map_err(SalesError::Database)?;

    Ok(orders
        .into_iter()
        .map(|o| OrderSummaryResponse {
            id: o.id,
            order_name: o.order_name,
            payment_method: o.payment_method,
            total_amount: rescale_2(o.total_amount),
            status: o.status,
            items_count: o.items_count,
            created_at: o.created_at,
            updated_at: o.updated_at,
        })
        .collect())
}

pub async fn get_order_details(pool: &PgPool, id: Uuid) -> Result<OrderDetailResponse, SalesError> {
    let order = repository::get_order_by_id(pool, id)
        .await
        .map_err(SalesError::Database)?
        .ok_or(SalesError::OrderNotFound(id))?;

    let items = repository::get_order_items_with_product(pool, id)
        .await
        .map_err(SalesError::Database)?;

    let item_responses = items
        .into_iter()
        .map(|item| OrderItemDetailResponse {
            id: item.id,
            order_id: item.order_id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: rescale_2(item.unit_price),
            subtotal: rescale_2(item.unit_price * Decimal::from(item.quantity)),
            created_at: item.created_at,
        })
        .collect();

    Ok(OrderDetailResponse {
        id: order.id,
        order_name: order.order_name,
        payment_method: order.payment_method,
        total_amount: rescale_2(order.total_amount),
        status: order.status,
        items: item_responses,
        created_at: order.created_at,
        updated_at: order.updated_at,
    })
}

pub async fn update_order_items(
    pool: &PgPool,
    order_id: Uuid,
    payload: UpdateOrderItemsRequest,
) -> Result<OrderDetailResponse, SalesError> {
    for item in &payload.items {
        if item.quantity <= 0 {
            return Err(SalesError::InvalidQuantity(
                "Quantity must be greater than zero".into(),
            ));
        }
    }

    let mut tx = pool.begin().await.map_err(SalesError::Database)?;

    let order = repository::get_order_by_id_tx(&mut tx, order_id)
        .await
        .map_err(SalesError::Database)?
        .ok_or(SalesError::OrderNotFound(order_id))?;

    if order.status != "open" {
        return Err(SalesError::OrderNotOpen(order_id));
    }

    repository::delete_order_items_tx(&mut tx, order_id)
        .await
        .map_err(SalesError::Database)?;

    let mut total_amount = Decimal::ZERO;

    for item in &payload.items {
        let product = get_product_by_id_tx(&mut tx, item.product_id)
            .await
            .map_err(SalesError::Database)?
            .ok_or(SalesError::ProductNotFound(item.product_id))?;

        let unit_price = product.price;
        total_amount += unit_price * Decimal::from(item.quantity);

        repository::create_order_item_tx(
            &mut tx,
            order_id,
            item.product_id,
            item.quantity,
            unit_price,
        )
        .await
        .map_err(SalesError::Database)?;
    }

    repository::update_order_total_tx(&mut tx, order_id, total_amount)
        .await
        .map_err(SalesError::Database)?;

    let items = repository::get_order_items_with_product_tx(&mut tx, order_id)
        .await
        .map_err(SalesError::Database)?;

    let updated_order = repository::get_order_by_id_tx(&mut tx, order_id)
        .await
        .map_err(SalesError::Database)?
        .ok_or(SalesError::OrderNotFound(order_id))?;

    tx.commit().await.map_err(SalesError::Database)?;

    let item_responses = items
        .into_iter()
        .map(|item| OrderItemDetailResponse {
            id: item.id,
            order_id: item.order_id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: rescale_2(item.unit_price),
            subtotal: rescale_2(item.unit_price * Decimal::from(item.quantity)),
            created_at: item.created_at,
        })
        .collect();

    Ok(OrderDetailResponse {
        id: updated_order.id,
        order_name: updated_order.order_name,
        payment_method: updated_order.payment_method,
        total_amount: rescale_2(updated_order.total_amount),
        status: updated_order.status,
        items: item_responses,
        created_at: updated_order.created_at,
        updated_at: updated_order.updated_at,
    })
}

pub async fn settle_order(
    pool: &PgPool,
    order_id: Uuid,
    payload: SettleOrderRequest,
) -> Result<OrderDetailResponse, SalesError> {
    let payment_method = payload.payment_method.trim().to_lowercase();
    if !["cash", "card", "transfer", "credit"].contains(&payment_method.as_str()) {
        return Err(SalesError::InvalidPaymentMethod(format!(
            "Invalid payment method: '{}'. Allowed methods: cash, card, transfer, credit",
            payload.payment_method
        )));
    }

    let customer_id = if payment_method == "credit" {
        let cid = payload.customer_id.ok_or(SalesError::CustomerIdRequired)?;
        Some(cid)
    } else {
        payload.customer_id
    };

    let mut tx = pool.begin().await.map_err(SalesError::Database)?;

    let order = repository::get_order_by_id_tx(&mut tx, order_id)
        .await
        .map_err(SalesError::Database)?
        .ok_or(SalesError::OrderNotFound(order_id))?;

    if order.status != "open" {
        return Err(SalesError::OrderNotOpen(order_id));
    }

    if let Some(cid) = customer_id {
        if payment_method == "credit" {
            let customer = crate::features::customers::repository::find_by_id_tx(&mut tx, cid)
                .await
                .map_err(SalesError::Database)?;
            if customer.is_none() {
                return Err(SalesError::CustomerNotFound(cid));
            }
        }
    }

    let items = repository::get_order_items_with_product_tx(&mut tx, order_id)
        .await
        .map_err(SalesError::Database)?;

    if items.is_empty() {
        return Err(SalesError::EmptyTab(order_id));
    }

    // Sort items by product_id to ensure deterministic lock acquisition and prevent deadlocks
    let mut items_sorted = items.clone();
    items_sorted.sort_by_key(|item| item.product_id);

    for item in &items_sorted {
        match decrement_inventory_tx(&mut tx, item.product_id, item.quantity).await {
            Ok(_) => {}
            Err(sqlx::Error::RowNotFound) => {
                return Err(SalesError::InsufficientStock(item.product_id));
            }
            Err(e) => return Err(SalesError::Database(e)),
        }
    }

    if payment_method == "credit" {
        let cid = customer_id.unwrap();
        crate::features::customers::repository::create_credit_tx(
            &mut tx,
            cid,
            order_id,
            order.total_amount,
            "unpaid",
        )
        .await
        .map_err(SalesError::Database)?;
    }

    let settled_order = repository::settle_order_tx(&mut tx, order_id, &payment_method)
        .await
        .map_err(SalesError::Database)?;

    tx.commit().await.map_err(SalesError::Database)?;

    let item_responses = items
        .into_iter()
        .map(|item| OrderItemDetailResponse {
            id: item.id,
            order_id: item.order_id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: rescale_2(item.unit_price),
            subtotal: rescale_2(item.unit_price * Decimal::from(item.quantity)),
            created_at: item.created_at,
        })
        .collect();

    Ok(OrderDetailResponse {
        id: settled_order.id,
        order_name: settled_order.order_name,
        payment_method: settled_order.payment_method,
        total_amount: rescale_2(settled_order.total_amount),
        status: settled_order.status,
        items: item_responses,
        created_at: settled_order.created_at,
        updated_at: settled_order.updated_at,
    })
}

