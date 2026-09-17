use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateCustomerRequest {
    pub name: String,
    pub phone_number: String,
    pub pin: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CustomerQuery {
    pub phone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CustomerResponse {
    pub id: Uuid,
    pub name: String,
    pub phone_number: String,
    pub created_at: DateTime<Utc>,
}

impl From<super::repository::Customer> for CustomerResponse {
    fn from(c: super::repository::Customer) -> Self {
        Self {
            id: c.id,
            name: c.name,
            phone_number: c.phone_number,
            created_at: c.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CreditHistoryItem {
    pub id: Uuid,
    pub order_id: Uuid,
    pub amount: rust_decimal::Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

impl From<super::repository::Credit> for CreditHistoryItem {
    fn from(c: super::repository::Credit) -> Self {
        Self {
            id: c.id,
            order_id: c.order_id,
            amount: c.amount,
            status: c.status,
            created_at: c.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CustomerPortalResponse {
    pub id: Uuid,
    pub name: String,
    pub phone_number: String,
    pub outstanding_balance: rust_decimal::Decimal,
    pub credits: Vec<CreditHistoryItem>,
}
