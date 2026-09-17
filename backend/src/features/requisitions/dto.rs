use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::repository::RequisitionItemDetail;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateRequisitionItemRequest {
    pub product_id: Uuid,
    pub quantity: i32,
    pub expected_price: Decimal,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct CreateRequisitionRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub items: Vec<CreateRequisitionItemRequest>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DeliverRequisitionItemRequest {
    pub item_id: Uuid,
    pub received_quantity: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct DeliverRequisitionRequest {
    #[serde(default)]
    pub items: Vec<DeliverRequisitionItemRequest>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConfirmVendorItemRequest {
    pub item_id: Uuid,
    pub confirmed_price: Decimal,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ConfirmVendorRequest {
    #[serde(default)]
    pub items: Vec<ConfirmVendorItemRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RequisitionDetailResponse {
    pub id: Uuid,
    pub token: Uuid,
    pub title: String,
    pub status: String,
    pub items: Vec<RequisitionItemDetail>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RequisitionSummaryResponse {
    pub id: Uuid,
    pub token: Uuid,
    pub title: String,
    pub status: String,
    #[serde(alias = "items_count")]
    pub item_count: i64,
    #[serde(alias = "total_amount")]
    pub total_estimated_cost: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShareRequisitionResponse {
    pub id: Uuid,
    pub token: Uuid,
    pub status: String,
    pub share_url: String,
}
