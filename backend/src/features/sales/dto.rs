use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateOrderItemRequest {
    pub product_id: Uuid,
    pub quantity: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateCashOrderRequest {
    pub items: Vec<CreateOrderItemRequest>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct CreateOpenOrderRequest {
    #[serde(default)]
    pub order_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpdateOrderItemsRequest {
    pub items: Vec<CreateOrderItemRequest>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SettleOrderRequest {
    pub payment_method: String,
    #[serde(default)]
    pub customer_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OrderItemResponse {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Uuid,
    pub quantity: i32,
    pub unit_price: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OrderItemDetailResponse {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Uuid,
    pub product_name: String,
    pub quantity: i32,
    pub unit_price: Decimal,
    pub subtotal: Decimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OrderDetailResponse {
    pub id: Uuid,
    pub order_name: Option<String>,
    pub payment_method: Option<String>,
    pub total_amount: Decimal,
    pub status: String,
    pub items: Vec<OrderItemDetailResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OrderSummaryResponse {
    pub id: Uuid,
    pub order_name: Option<String>,
    pub payment_method: Option<String>,
    pub total_amount: Decimal,
    pub status: String,
    pub items_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OrderResponse {
    pub id: Uuid,
    pub payment_method: String,
    pub status: String,
    pub total_amount: Decimal,
    pub items: Vec<OrderItemResponse>,
    pub created_at: DateTime<Utc>,
}
