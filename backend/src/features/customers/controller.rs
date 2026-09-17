use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde_json::json;

use crate::AppState;

use super::{
    dto::{CreateCustomerRequest, CustomerQuery},
    service::{self, CustomerError},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(search_customers_handler).post(create_customer_handler))
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
        Err(CustomerError::InvalidInput(msg)) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": msg})),
        )
            .into_response(),
        Err(CustomerError::PhoneAlreadyExists(phone)) => (
            StatusCode::CONFLICT,
            Json(json!({"error": format!("Customer with phone {phone} already exists")})),
        )
            .into_response(),
        Err(CustomerError::Database(e)) => {
            eprintln!("Database error creating customer: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}
