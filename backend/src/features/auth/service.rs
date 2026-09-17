use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::http::{header, HeaderMap};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::features::customers::repository as customers_repository;

use super::repository::{self, UserResponse};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub token_type: String,
    pub exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: UserResponse,
}

#[derive(Debug)]
pub enum AuthError {
    InvalidCredentials,
    InvalidToken,
    Forbidden,
    Database(sqlx::Error),
    TokenCreation(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidCredentials => write!(f, "Invalid email or password"),
            Self::InvalidToken => write!(f, "Invalid or expired token"),
            Self::Forbidden => write!(f, "Forbidden"),
            Self::Database(e) => write!(f, "Database error: {}", e),
            Self::TokenCreation(e) => write!(f, "Token creation error: {}", e),
        }
    }
}

impl std::error::Error for AuthError {}

pub fn get_jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        "kwatapos_default_jwt_secret_dev_key_change_in_production".to_string()
    })
}

pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default().hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

pub fn verify_password(password: &str, password_hash: &str) -> bool {
    if let Ok(parsed_hash) = PasswordHash::new(password_hash) {
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok()
    } else {
        false
    }
}

pub fn generate_tokens(
    user_id: &Uuid,
    email: &str,
    role: &str,
) -> Result<(String, String), AuthError> {
    let now = chrono::Utc::now().timestamp() as usize;
    let secret = get_jwt_secret();
    let encoding_key = EncodingKey::from_secret(secret.as_bytes());

    // 15 minutes access token
    let access_claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        role: role.to_string(),
        token_type: "access".to_string(),
        exp: now + 15 * 60,
    };
    let access_token = encode(&Header::default(), &access_claims, &encoding_key)
        .map_err(|e| AuthError::TokenCreation(e.to_string()))?;

    // 7 days refresh token
    let refresh_claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        role: role.to_string(),
        token_type: "refresh".to_string(),
        exp: now + 7 * 24 * 3600,
    };
    let refresh_token = encode(&Header::default(), &refresh_claims, &encoding_key)
        .map_err(|e| AuthError::TokenCreation(e.to_string()))?;

    Ok((access_token, refresh_token))
}

pub fn generate_access_token(
    user_id: &Uuid,
    email: &str,
    role: &str,
) -> Result<String, AuthError> {
    let now = chrono::Utc::now().timestamp() as usize;
    let secret = get_jwt_secret();
    let encoding_key = EncodingKey::from_secret(secret.as_bytes());

    let access_claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        role: role.to_string(),
        token_type: "access".to_string(),
        exp: now + 15 * 60,
    };
    encode(&Header::default(), &access_claims, &encoding_key)
        .map_err(|e| AuthError::TokenCreation(e.to_string()))
}

pub fn verify_token(token: &str) -> Result<Claims, AuthError> {
    let secret = get_jwt_secret();
    let decoding_key = DecodingKey::from_secret(secret.as_bytes());
    let validation = Validation::default();

    decode::<Claims>(token, &decoding_key, &validation)
        .map(|data| data.claims)
        .map_err(|_| AuthError::InvalidToken)
}

pub fn verify_access_token(token: &str) -> Result<Claims, AuthError> {
    let claims = verify_token(token)?;
    if claims.token_type != "access" {
        return Err(AuthError::InvalidToken);
    }
    Ok(claims)
}

pub fn verify_refresh_token(token: &str) -> Result<Claims, AuthError> {
    let claims = verify_token(token)?;
    if claims.token_type != "refresh" {
        return Err(AuthError::InvalidToken);
    }
    Ok(claims)
}

pub fn claims_from_authorization_header(headers: &HeaderMap) -> Result<Claims, AuthError> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(AuthError::InvalidToken)?;
    let token = auth_header
        .strip_prefix("Bearer ")
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or(AuthError::InvalidToken)?;
    verify_access_token(token)
}

pub fn require_role(claims: &Claims, allowed: &[&str]) -> Result<(), AuthError> {
    if allowed.iter().any(|role| *role == claims.role) {
        Ok(())
    } else {
        Err(AuthError::Forbidden)
    }
}

async fn find_customer_auth_by_phone(
    pool: &PgPool,
    phone: &str,
) -> Result<Option<customers_repository::CustomerAuth>, sqlx::Error> {
    let mut customer = customers_repository::find_auth_by_phone(pool, phone).await?;
    if customer.is_none() && !phone.starts_with('+') {
        let with_plus = format!("+{phone}");
        customer = customers_repository::find_auth_by_phone(pool, &with_plus).await?;
    }
    Ok(customer)
}

pub async fn customer_login(
    pool: &PgPool,
    phone_number: &str,
    pin: &str,
) -> Result<LoginResponse, AuthError> {
    let phone = phone_number.trim();
    if phone.is_empty() || pin.trim().is_empty() {
        return Err(AuthError::InvalidCredentials);
    }

    let customer = find_customer_auth_by_phone(pool, phone)
        .await
        .map_err(AuthError::Database)?
        .ok_or(AuthError::InvalidCredentials)?;

    if !verify_password(pin.trim(), &customer.pin_hash) {
        return Err(AuthError::InvalidCredentials);
    }

    let (access_token, refresh_token) =
        generate_tokens(&customer.id, &customer.phone_number, "customer")?;

    Ok(LoginResponse {
        access_token,
        refresh_token,
        user: UserResponse {
            id: customer.id,
            email: customer.phone_number,
            role: "customer".to_string(),
        },
    })
}

pub async fn login(
    pool: &PgPool,
    email: &str,
    password: &str,
) -> Result<LoginResponse, AuthError> {
    let user = repository::find_user_by_email(pool, email)
        .await
        .map_err(AuthError::Database)?
        .ok_or(AuthError::InvalidCredentials)?;

    if !verify_password(password, &user.password_hash) {
        return Err(AuthError::InvalidCredentials);
    }

    let (access_token, refresh_token) = generate_tokens(&user.id, &user.email, &user.role)?;

    Ok(LoginResponse {
        access_token,
        refresh_token,
        user: user.into(),
    })
}

pub fn refresh_token(refresh_token_str: &str) -> Result<String, AuthError> {
    let claims = verify_refresh_token(refresh_token_str)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AuthError::InvalidToken)?;
    generate_access_token(&user_id, &claims.email, &claims.role)
}
