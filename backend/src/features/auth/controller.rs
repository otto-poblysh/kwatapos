use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;

use super::{
    repository::{self, UserResponse},
    service::{self, AuthError},
};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct CustomerLoginRequest {
    pub phone_number: String,
    pub pin: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub access_token: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login_handler))
        .route("/customer", post(customer_login_handler))
        .route("/refresh", post(refresh_handler))
        .route("/me", get(me_handler))
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Response {
    let pool = match &state.pool {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database unconfigured"})),
            )
                .into_response();
        }
    };

    match service::login(pool, &payload.email, &payload.password).await {
        Ok(login_response) => (StatusCode::OK, Json(login_response)).into_response(),
        Err(AuthError::InvalidCredentials) => (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid email or password"})),
        )
            .into_response(),
        Err(e) => {
            eprintln!("Internal auth error during login: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}

pub async fn customer_login_handler(
    State(state): State<AppState>,
    Json(payload): Json<CustomerLoginRequest>,
) -> Response {
    let pool = match &state.pool {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database unconfigured"})),
            )
                .into_response();
        }
    };

    match service::customer_login(pool, &payload.phone_number, &payload.pin).await {
        Ok(login_response) => (StatusCode::OK, Json(login_response)).into_response(),
        Err(AuthError::InvalidCredentials) => (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid phone number or PIN"})),
        )
            .into_response(),
        Err(e) => {
            eprintln!("Internal auth error during customer login: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}

pub async fn refresh_handler(Json(payload): Json<RefreshRequest>) -> Response {
    match service::refresh_token(&payload.refresh_token) {
        Ok(access_token) => {
            (StatusCode::OK, Json(RefreshResponse { access_token })).into_response()
        }
        Err(e) => {
            eprintln!("Refresh token error: {e}");
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid or expired refresh token"})),
            )
                .into_response()
        }
    }
}

pub async fn me_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    let auth_header = match headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Missing authorization header"})),
            )
                .into_response();
        }
    };

    let token = if let Some(stripped) = auth_header.strip_prefix("Bearer ") {
        stripped.trim()
    } else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid authorization scheme"})),
        )
            .into_response();
    };

    let claims = match service::verify_access_token(token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid or expired token"})),
            )
                .into_response();
        }
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid user ID in token"})),
            )
                .into_response();
        }
    };

    if let Some(ref pool) = state.pool {
        match repository::find_user_by_id(pool, user_id).await {
            Ok(Some(user)) => (StatusCode::OK, Json(UserResponse::from(user))).into_response(),
            Ok(None) => (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "User no longer exists"})),
            )
                .into_response(),
            Err(e) => {
                eprintln!("Internal database error during me_handler: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Internal server error"})),
                )
                    .into_response()
            }
        }
    } else {
        (
            StatusCode::OK,
            Json(UserResponse {
                id: user_id,
                email: claims.email,
                role: claims.role,
            }),
        )
            .into_response()
    }
}
