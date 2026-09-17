use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post, put},
    Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;

use super::{
    dto::{
        CreateCashOrderRequest, CreateOpenOrderRequest, SettleOrderRequest, UpdateOrderItemsRequest,
    },
    service::{self, SalesError},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/products", get(get_products_handler))
        .route(
            "/orders",
            get(get_open_orders_handler).post(create_open_order_handler),
        )
        .route("/orders/{id}", get(get_order_details_handler))
        .route("/orders/{id}/items", put(update_order_items_handler))
        .route("/orders/{id}/settle", post(settle_order_handler))
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

pub async fn get_open_orders_handler(State(state): State<AppState>) -> Response {
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

    match service::get_open_orders(pool).await {
        Ok(orders) => (StatusCode::OK, Json(orders)).into_response(),
        Err(e) => sales_error_response(e),
    }
}

pub async fn create_open_order_handler(
    State(state): State<AppState>,
    payload: Option<Json<CreateOpenOrderRequest>>,
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

    let order_name = payload.and_then(|Json(req)| req.order_name);
    match service::create_open_order(pool, order_name).await {
        Ok(order) => (StatusCode::CREATED, Json(order)).into_response(),
        Err(e) => sales_error_response(e),
    }
}

pub async fn get_order_details_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
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

    match service::get_order_details(pool, id).await {
        Ok(order) => (StatusCode::OK, Json(order)).into_response(),
        Err(e) => sales_error_response(e),
    }
}

pub async fn update_order_items_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateOrderItemsRequest>,
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

    match service::update_order_items(pool, id, payload).await {
        Ok(order) => (StatusCode::OK, Json(order)).into_response(),
        Err(e) => sales_error_response(e),
    }
}

pub async fn settle_order_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SettleOrderRequest>,
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

    match service::settle_order(pool, id, payload).await {
        Ok(order) => (StatusCode::OK, Json(order)).into_response(),
        Err(e) => sales_error_response(e),
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
        Err(e) => sales_error_response(e),
    }
}

fn sales_error_response(e: SalesError) -> Response {
    match e {
        SalesError::EmptyItems => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Order must contain at least one item"})),
        )
            .into_response(),
        SalesError::InvalidQuantity(msg) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": msg})),
        )
            .into_response(),
        SalesError::ProductNotFound(id) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Product not found: {id}")})),
        )
            .into_response(),
        SalesError::InsufficientStock(id) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Insufficient stock for product {id}")})),
        )
            .into_response(),
        SalesError::OrderNotFound(id) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": format!("Order not found: {id}")})),
        )
            .into_response(),
        SalesError::OrderNotOpen(id) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Order {id} is not open")})),
        )
            .into_response(),
        SalesError::EmptyTab(id) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Cannot settle empty tab {id}")})),
        )
            .into_response(),
        SalesError::InvalidPaymentMethod(msg) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": msg})),
        )
            .into_response(),
        SalesError::CustomerIdRequired => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "customer_id is required for credit payments"})),
        )
            .into_response(),
        SalesError::CustomerNotFound(id) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Customer not found: {id}")})),
        )
            .into_response(),
        SalesError::Database(e) => {
            eprintln!("Database error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}
