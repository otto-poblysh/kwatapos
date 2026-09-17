use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::features::auth::service::{self as auth_service, AuthError};
use crate::AppState;

use super::{
    dto::{CreateCustomerRequest, CustomerQuery},
    service::{self, CustomerError},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(search_customers_handler).post(create_customer_handler))
}

pub fn portal_router() -> Router<AppState> {
    Router::new().route("/me", get(customer_me_handler))
}

fn unconfigured_db() -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "Database unconfigured"})),
    )
        .into_response()
}

fn customer_error_response(err: CustomerError) -> Response {
    match err {
        CustomerError::InvalidInput(msg) => {
            (StatusCode::BAD_REQUEST, Json(json!({"error": msg}))).into_response()
        }
        CustomerError::PhoneAlreadyExists(phone) => (
            StatusCode::CONFLICT,
            Json(json!({"error": format!("Customer with phone {phone} already exists")})),
        )
            .into_response(),
        CustomerError::NotFound(msg) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": msg}))).into_response()
        }
        CustomerError::Database(e) => {
            eprintln!("Customers database error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}

pub async fn search_customers_handler(
    State(state): State<AppState>,
    Query(query): Query<CustomerQuery>,
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

    match service::search_customer_by_phone(pool, query.phone.as_deref()).await {
        Ok(customer) => (StatusCode::OK, Json(customer)).into_response(),
        Err(e) => {
            eprintln!("Error searching customer: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}

pub async fn create_customer_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateCustomerRequest>,
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

    match service::create_customer(pool, payload).await {
        Ok(customer) => (StatusCode::CREATED, Json(customer)).into_response(),
        Err(e) => customer_error_response(e),
    }
}

pub async fn customer_me_handler(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let claims = match auth_service::claims_from_authorization_header(&headers) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid or expired token"})),
            )
                .into_response();
        }
    };

    if let Err(AuthError::Forbidden) = auth_service::require_role(&claims, &["customer"]) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Customer access required"})),
        )
            .into_response();
    }

    let customer_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid customer ID in token"})),
            )
                .into_response();
        }
    };

    let pool = match &state.pool {
        Some(p) => p,
        None => return unconfigured_db(),
    };

    match service::get_portal_profile(pool, customer_id).await {
        Ok(profile) => (StatusCode::OK, Json(profile)).into_response(),
        Err(e) => customer_error_response(e),
    }
}
