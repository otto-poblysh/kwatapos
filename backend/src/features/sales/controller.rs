use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use serde_json::json;

use crate::AppState;

use super::{
    dto::CreateCashOrderRequest,
    service::{self, SalesError},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/products", get(get_products_handler))
        .route("/orders/cash", post(create_cash_order_handler))
}

pub async fn get_products_handler(State(state): State<AppState>) -> Response {
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

    match service::get_products(pool).await {
        Ok(products) => (StatusCode::OK, Json(products)).into_response(),
        Err(e) => {
            eprintln!("Error fetching products: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}

pub async fn create_cash_order_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateCashOrderRequest>,
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

    match service::create_cash_order(pool, payload).await {
        Ok(order) => (StatusCode::CREATED, Json(order)).into_response(),
        Err(SalesError::EmptyItems) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Order must contain at least one item"})),
        )
            .into_response(),
        Err(SalesError::InvalidQuantity(msg)) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": msg})),
        )
            .into_response(),
        Err(SalesError::ProductNotFound(id)) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Product not found: {id}")})),
        )
            .into_response(),
        Err(SalesError::InsufficientStock(id)) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Insufficient stock for product {id}")})),
        )
            .into_response(),
        Err(SalesError::Database(e)) => {
            eprintln!("Database error during order creation: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}
