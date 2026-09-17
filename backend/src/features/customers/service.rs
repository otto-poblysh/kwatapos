use sqlx::PgPool;
use uuid::Uuid;

use crate::features::auth::service::hash_password;

use super::{
    dto::{CreateCustomerRequest, CustomerPortalResponse, CustomerResponse, CreditHistoryItem},
    repository,
};

#[derive(Debug)]
pub enum CustomerError {
    InvalidInput(String),
    PhoneAlreadyExists(String),
    NotFound(String),
    Database(sqlx::Error),
}

impl std::fmt::Display for CustomerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            Self::PhoneAlreadyExists(phone) => {
                write!(f, "Customer with phone {} already exists", phone)
            }
            Self::NotFound(msg) => write!(f, "{msg}"),
            Self::Database(e) => write!(f, "Database error: {}", e),
        }
    }
}

impl std::error::Error for CustomerError {}

pub async fn search_customer_by_phone(
    pool: &PgPool,
    phone: Option<&str>,
) -> Result<Option<CustomerResponse>, CustomerError> {
    let phone_str = match phone {
        Some(p) if !p.trim().is_empty() => p.trim(),
        _ => return Ok(None),
    };

    let mut customer = repository::find_by_phone(pool, phone_str)
        .await
        .map_err(CustomerError::Database)?;

    if customer.is_none() && !phone_str.starts_with('+') {
        let with_plus = format!("+{}", phone_str);
        customer = repository::find_by_phone(pool, &with_plus)
            .await
            .map_err(CustomerError::Database)?;
    }

    Ok(customer.map(CustomerResponse::from))
}

pub async fn create_customer(
    pool: &PgPool,
    payload: CreateCustomerRequest,
) -> Result<CustomerResponse, CustomerError> {
    let name = payload.name.trim();
    let phone = payload.phone_number.trim();

    if name.is_empty() {
        return Err(CustomerError::InvalidInput(
            "Name cannot be empty".to_string(),
        ));
    }
    if phone.is_empty() {
        return Err(CustomerError::InvalidInput(
            "Phone number cannot be empty".to_string(),
        ));
    }

    let pin = payload.pin.trim();
    if pin.len() != 4 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err(CustomerError::InvalidInput(
            "PIN must be exactly 4 digits".to_string(),
        ));
    }

    let pin_hash = hash_password(pin).map_err(|e| {
        CustomerError::InvalidInput(format!("Failed to hash PIN: {e}"))
    })?;

    match repository::create_customer(pool, name, phone, &pin_hash).await {
        Ok(c) => Ok(CustomerResponse::from(c)),
        Err(sqlx::Error::Database(dbe)) if dbe.code().as_deref() == Some("23505") => {
            Err(CustomerError::PhoneAlreadyExists(phone.to_string()))
        }
        Err(e) => Err(CustomerError::Database(e)),
    }
}

pub async fn get_portal_profile(
    pool: &PgPool,
    customer_id: Uuid,
) -> Result<CustomerPortalResponse, CustomerError> {
    let customer = repository::find_by_id(pool, customer_id)
        .await
        .map_err(CustomerError::Database)?
        .ok_or_else(|| CustomerError::NotFound("Customer no longer exists".to_string()))?;

    let credits = repository::get_credits_by_customer(pool, customer_id)
        .await
        .map_err(CustomerError::Database)?;

    let outstanding_balance = repository::get_outstanding_balance(pool, customer_id)
        .await
        .map_err(CustomerError::Database)?;

    Ok(CustomerPortalResponse {
        id: customer.id,
        name: customer.name,
        phone_number: customer.phone_number,
        outstanding_balance,
        credits: credits.into_iter().map(CreditHistoryItem::from).collect(),
    })
}
