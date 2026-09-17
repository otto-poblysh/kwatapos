use sqlx::PgPool;

use super::{
    dto::{CreateCustomerRequest, CustomerResponse},
    repository,
};

#[derive(Debug)]
pub enum CustomerError {
    InvalidInput(String),
    PhoneAlreadyExists(String),
    Database(sqlx::Error),
}

impl std::fmt::Display for CustomerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            Self::PhoneAlreadyExists(phone) => {
                write!(f, "Customer with phone {} already exists", phone)
            }
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

    match repository::create_customer(pool, name, phone).await {
        Ok(c) => Ok(CustomerResponse::from(c)),
        Err(sqlx::Error::Database(dbe)) if dbe.code().as_deref() == Some("23505") => {
            Err(CustomerError::PhoneAlreadyExists(phone.to_string()))
        }
        Err(e) => Err(CustomerError::Database(e)),
    }
}
