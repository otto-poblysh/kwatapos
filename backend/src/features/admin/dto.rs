use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PermissionResponse {
    pub id: Uuid,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserSummary {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserPermissionEntry {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub source: String,
    pub is_effective: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserDetailResponse {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub permissions: Vec<UserPermissionEntry>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub password: String,
    pub role: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateUserRequest {
    pub email: Option<String>,
    pub password: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetUserPermissionRequest {
    pub permission: String,
    pub is_granted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RoleResponse {
    pub name: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertRoleRequest {
    pub name: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateRolePermissionsRequest {
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, FromRow)]
pub struct AdminProductResponse {
    pub id: Uuid,
    pub name: String,
    pub price: Decimal,
    pub category: String,
    pub stock_quantity: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProductRequest {
    pub name: String,
    pub price: Decimal,
    pub category: String,
    pub stock_quantity: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProductRequest {
    pub name: Option<String>,
    pub price: Option<Decimal>,
    pub category: Option<String>,
    pub stock_quantity: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, FromRow)]
pub struct AdminCustomerResponse {
    pub id: Uuid,
    pub name: String,
    pub phone_number: String,
    pub outstanding_balance: Decimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateAdminCustomerRequest {
    pub name: String,
    pub phone_number: String,
    pub pin: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateAdminCustomerRequest {
    pub name: Option<String>,
    pub phone_number: Option<String>,
    pub pin: Option<String>,
}
