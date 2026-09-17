use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use crate::features::auth::service::{hash_password, AuthError};
use crate::features::customers::service as customers_service;

use super::{
    dto::{
        AdminCustomerResponse, AdminProductResponse, CreateAdminCustomerRequest, CreateProductRequest,
        CreateUserRequest, PermissionResponse, RoleResponse, SetUserPermissionRequest,
        UpdateAdminCustomerRequest, UpdateProductRequest, UpdateRolePermissionsRequest,
        UpdateUserRequest, UpsertRoleRequest, UserDetailResponse, UserSummary,
    },
    repository,
};

const SYSTEM_ROLES: &[&str] = &["admin", "manager", "sales"];

#[derive(Debug)]
pub enum AdminError {
    Auth(AuthError),
    InvalidInput(String),
    NotFound(String),
    Conflict(String),
    Database(sqlx::Error),
}

impl std::fmt::Display for AdminError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Auth(e) => write!(f, "{e}"),
            Self::InvalidInput(msg) | Self::NotFound(msg) | Self::Conflict(msg) => {
                write!(f, "{msg}")
            }
            Self::Database(e) => write!(f, "Database error: {e}"),
        }
    }
}

impl std::error::Error for AdminError {}

impl From<sqlx::Error> for AdminError {
    fn from(value: sqlx::Error) -> Self {
        if let sqlx::Error::Database(dbe) = &value {
            if dbe.code().as_deref() == Some("23505") {
                return Self::Conflict("Record already exists".to_string());
            }
            if dbe.code().as_deref() == Some("23503") {
                return Self::Conflict("Record is still referenced by other data".to_string());
            }
        }
        if matches!(value, sqlx::Error::Protocol(_)) {
            return Self::InvalidInput(value.to_string());
        }
        Self::Database(value)
    }
}

pub async fn require_permission(
    pool: &PgPool,
    user_id: Uuid,
    permission: &str,
) -> Result<(), AuthError> {
    match repository::user_has_permission(pool, user_id, permission).await {
        Ok(true) => Ok(()),
        Ok(false) => Err(AuthError::Forbidden),
        Err(e) => Err(AuthError::Database(e)),
    }
}

pub async fn list_permissions(pool: &PgPool) -> Result<Vec<PermissionResponse>, AdminError> {
    Ok(repository::list_permissions(pool).await?)
}

pub async fn list_users(pool: &PgPool) -> Result<Vec<UserSummary>, AdminError> {
    Ok(repository::list_users(pool).await?)
}

pub async fn get_user(pool: &PgPool, id: Uuid) -> Result<UserDetailResponse, AdminError> {
    repository::user_detail(pool, id)
        .await?
        .ok_or_else(|| AdminError::NotFound("User not found".to_string()))
}

pub async fn create_user(pool: &PgPool, payload: CreateUserRequest) -> Result<UserSummary, AdminError> {
    let email = payload.email.trim().to_lowercase();
    let password = payload.password.trim();
    let role = payload.role.trim();
    if email.is_empty() || !email.contains('@') {
        return Err(AdminError::InvalidInput("A valid email is required".into()));
    }
    if password.len() < 8 {
        return Err(AdminError::InvalidInput(
            "Password must be at least 8 characters".into(),
        ));
    }
    if role.is_empty() {
        return Err(AdminError::InvalidInput("Role is required".into()));
    }
    if !repository::role_exists(pool, role).await? {
        return Err(AdminError::NotFound(format!("Role '{role}' does not exist")));
    }
    let password_hash = hash_password(password)
        .map_err(|e| AdminError::InvalidInput(format!("Failed to hash password: {e}")))?;
    Ok(repository::create_user(pool, &email, &password_hash, role).await?)
}

pub async fn update_user(
    pool: &PgPool,
    id: Uuid,
    payload: UpdateUserRequest,
) -> Result<UserSummary, AdminError> {
    let current = repository::find_user(pool, id)
        .await?
        .ok_or_else(|| AdminError::NotFound("User not found".to_string()))?;
    let email = payload
        .email
        .as_deref()
        .map(|e| e.trim().to_lowercase())
        .filter(|e| !e.is_empty())
        .unwrap_or(current.email.clone());
    if !email.contains('@') {
        return Err(AdminError::InvalidInput("A valid email is required".into()));
    }
    let role = payload
        .role
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .unwrap_or(&current.role);
    if !repository::role_exists(pool, role).await? {
        return Err(AdminError::NotFound(format!("Role '{role}' does not exist")));
    }
    if current.role == "admin" && role != "admin" {
        let admins = repository::count_admins(pool).await?;
        if admins <= 1 {
            return Err(AdminError::Conflict(
                "Cannot remove the last admin user".into(),
            ));
        }
    }
    let password_hash = match payload.password.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        Some(password) if password.len() < 8 => {
            return Err(AdminError::InvalidInput(
                "Password must be at least 8 characters".into(),
            ));
        }
        Some(password) => Some(
            hash_password(password)
                .map_err(|e| AdminError::InvalidInput(format!("Failed to hash password: {e}")))?,
        ),
        None => None,
    };
    repository::update_user(pool, id, &email, password_hash.as_deref(), role)
        .await?
        .ok_or_else(|| AdminError::NotFound("User not found".to_string()))
}

pub async fn delete_user(pool: &PgPool, id: Uuid) -> Result<(), AdminError> {
    let current = repository::find_user(pool, id)
        .await?
        .ok_or_else(|| AdminError::NotFound("User not found".to_string()))?;
    if current.role == "admin" {
        let admins = repository::count_admins(pool).await?;
        if admins <= 1 {
            return Err(AdminError::Conflict(
                "Cannot delete the last admin user".into(),
            ));
        }
    }
    if !repository::delete_user(pool, id).await? {
        return Err(AdminError::NotFound("User not found".to_string()));
    }
    Ok(())
}

pub async fn set_user_permission(
    pool: &PgPool,
    user_id: Uuid,
    payload: SetUserPermissionRequest,
) -> Result<UserDetailResponse, AdminError> {
    let permission = payload.permission.trim();
    if permission.is_empty() {
        return Err(AdminError::InvalidInput("Permission is required".into()));
    }
    if repository::find_user(pool, user_id).await?.is_none() {
        return Err(AdminError::NotFound("User not found".to_string()));
    }
    repository::set_user_permission(pool, user_id, permission, payload.is_granted)
        .await?
        .ok_or_else(|| AdminError::NotFound("Permission not found".to_string()))?;
    get_user(pool, user_id).await
}

pub async fn clear_user_permission(
    pool: &PgPool,
    user_id: Uuid,
    permission: &str,
) -> Result<UserDetailResponse, AdminError> {
    if repository::find_user(pool, user_id).await?.is_none() {
        return Err(AdminError::NotFound("User not found".to_string()));
    }
    repository::clear_user_permission(pool, user_id, permission.trim()).await?;
    get_user(pool, user_id).await
}

pub async fn list_roles(pool: &PgPool) -> Result<Vec<RoleResponse>, AdminError> {
    Ok(repository::list_roles(pool).await?)
}

pub async fn create_role(pool: &PgPool, payload: UpsertRoleRequest) -> Result<RoleResponse, AdminError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AdminError::InvalidInput("Role name is required".into()));
    }
    if repository::role_exists(pool, name).await? {
        return Err(AdminError::Conflict(format!("Role '{name}' already exists")));
    }
    let mut tx = pool.begin().await?;
    repository::create_role_tx(&mut tx, name).await?;
    repository::replace_role_permissions_tx(&mut tx, name, &payload.permissions).await?;
    tx.commit().await?;
    repository::load_role(pool, name)
        .await?
        .ok_or_else(|| AdminError::NotFound("Role not found after create".into()))
}

pub async fn update_role(
    pool: &PgPool,
    name: &str,
    payload: UpdateRolePermissionsRequest,
) -> Result<RoleResponse, AdminError> {
    let name = name.trim();
    if !repository::role_exists(pool, name).await? {
        return Err(AdminError::NotFound(format!("Role '{name}' does not exist")));
    }
    let mut tx = pool.begin().await?;
    repository::replace_role_permissions_tx(&mut tx, name, &payload.permissions).await?;
    tx.commit().await?;
    repository::load_role(pool, name)
        .await?
        .ok_or_else(|| AdminError::NotFound("Role not found".into()))
}

pub async fn delete_role(pool: &PgPool, name: &str) -> Result<(), AdminError> {
    let name = name.trim();
    if SYSTEM_ROLES.contains(&name) {
        return Err(AdminError::Conflict(
            "Cannot delete a built-in system role".into(),
        ));
    }
    if repository::delete_role(pool, name).await? == 0 {
        return Err(AdminError::NotFound(format!("Role '{name}' does not exist")));
    }
    Ok(())
}

pub async fn list_products(pool: &PgPool) -> Result<Vec<AdminProductResponse>, AdminError> {
    Ok(repository::list_admin_products(pool).await?)
}

pub async fn create_product(
    pool: &PgPool,
    payload: CreateProductRequest,
) -> Result<AdminProductResponse, AdminError> {
    let name = payload.name.trim();
    let category = payload.category.trim();
    if name.is_empty() {
        return Err(AdminError::InvalidInput("Product name is required".into()));
    }
    if category.is_empty() {
        return Err(AdminError::InvalidInput("Category is required".into()));
    }
    if payload.price < Decimal::ZERO {
        return Err(AdminError::InvalidInput("Price cannot be negative".into()));
    }
    if payload.stock_quantity < 0 {
        return Err(AdminError::InvalidInput(
            "Stock quantity cannot be negative".into(),
        ));
    }
    Ok(repository::create_admin_product(pool, name, payload.price, category, payload.stock_quantity).await?)
}

pub async fn update_product(
    pool: &PgPool,
    id: Uuid,
    payload: UpdateProductRequest,
) -> Result<AdminProductResponse, AdminError> {
    let current = repository::get_admin_product(pool, id)
        .await?
        .ok_or_else(|| AdminError::NotFound("Product not found".to_string()))?;
    let name = payload
        .name
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty())
        .unwrap_or(&current.name);
    let category = payload
        .category
        .as_deref()
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .unwrap_or(&current.category);
    let price = payload.price.unwrap_or(current.price);
    let stock_quantity = payload.stock_quantity.unwrap_or(current.stock_quantity);
    if price < Decimal::ZERO {
        return Err(AdminError::InvalidInput("Price cannot be negative".into()));
    }
    if stock_quantity < 0 {
        return Err(AdminError::InvalidInput(
            "Stock quantity cannot be negative".into(),
        ));
    }
    repository::update_admin_product(pool, id, name, price, category, stock_quantity)
        .await?
        .ok_or_else(|| AdminError::NotFound("Product not found".to_string()))
}

pub async fn delete_product(pool: &PgPool, id: Uuid) -> Result<(), AdminError> {
    if repository::delete_admin_product(pool, id).await? == 0 {
        return Err(AdminError::NotFound("Product not found".to_string()));
    }
    Ok(())
}

pub async fn list_customers(pool: &PgPool) -> Result<Vec<AdminCustomerResponse>, AdminError> {
    Ok(repository::list_admin_customers(pool).await?)
}

pub async fn create_customer(
    pool: &PgPool,
    payload: CreateAdminCustomerRequest,
) -> Result<AdminCustomerResponse, AdminError> {
    let created = customers_service::create_customer(
        pool,
        crate::features::customers::dto::CreateCustomerRequest {
            name: payload.name,
            phone_number: payload.phone_number,
            pin: payload.pin,
        },
    )
    .await
    .map_err(map_customer_error)?;
    repository::get_admin_customer(pool, created.id)
        .await?
        .ok_or_else(|| AdminError::NotFound("Customer not found after create".into()))
}

pub async fn update_customer(
    pool: &PgPool,
    id: Uuid,
    payload: UpdateAdminCustomerRequest,
) -> Result<AdminCustomerResponse, AdminError> {
    let current = repository::get_admin_customer(pool, id)
        .await?
        .ok_or_else(|| AdminError::NotFound("Customer not found".to_string()))?;
    let name = payload
        .name
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty())
        .unwrap_or(&current.name);
    let phone = payload
        .phone_number
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .unwrap_or(&current.phone_number);
    let pin_hash = match payload.pin.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        Some(pin) if pin.len() != 4 || !pin.chars().all(|c| c.is_ascii_digit()) => {
            return Err(AdminError::InvalidInput(
                "PIN must be exactly 4 digits".into(),
            ));
        }
        Some(pin) => Some(
            hash_password(pin)
                .map_err(|e| AdminError::InvalidInput(format!("Failed to hash PIN: {e}")))?,
        ),
        None => None,
    };
    repository::update_admin_customer(pool, id, name, phone, pin_hash.as_deref())
        .await?
        .ok_or_else(|| AdminError::NotFound("Customer not found".to_string()))
}

pub async fn delete_customer(pool: &PgPool, id: Uuid) -> Result<(), AdminError> {
    if repository::delete_admin_customer(pool, id).await? == 0 {
        return Err(AdminError::NotFound("Customer not found".to_string()));
    }
    Ok(())
}

fn map_customer_error(err: customers_service::CustomerError) -> AdminError {
    match err {
        customers_service::CustomerError::InvalidInput(msg) => AdminError::InvalidInput(msg),
        customers_service::CustomerError::PhoneAlreadyExists(phone) => {
            AdminError::Conflict(format!("Customer with phone {phone} already exists"))
        }
        customers_service::CustomerError::NotFound(msg) => AdminError::NotFound(msg),
        customers_service::CustomerError::Database(e) => AdminError::Database(e),
    }
}
