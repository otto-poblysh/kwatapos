use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateExpenseRequest {
    pub category: String,
    pub amount: Decimal,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub requested_by: Option<Uuid>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct UploadReceiptRequest {
    pub receipt_image_url: String,
}
