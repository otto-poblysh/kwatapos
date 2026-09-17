use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;

use super::{
    dto::{CreateExpenseRequest, UploadReceiptRequest},
    service::{self, ExpenseError},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_expenses_handler).post(create_expense_handler))
        .route("/{id}/approve", post(approve_expense_handler))
        .route("/{id}/receipt", post(upload_receipt_handler))
}

fn expense_error_response(err: ExpenseError) -> Response {
    match err {
        ExpenseError::ValidationError(msg) => {
            (StatusCode::BAD_REQUEST, Json(json!({ "error": msg }))).into_response()
        }
        ExpenseError::NotFound(msg) => {
            (StatusCode::NOT_FOUND, Json(json!({ "error": msg }))).into_response()
        }
        ExpenseError::Database(e) => {
            eprintln!("Expenses database error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Internal server error" })),
            )
                .into_response()
        }
    }
}

pub async fn create_expense_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateExpenseRequest>,
) -> Response {
    let pool = match &state.pool {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Database unconfigured" })),
            )
                .into_response();
        }
    };

    match service::create_expense(pool, payload).await {
        Ok(res) => (StatusCode::CREATED, Json(res)).into_response(),
        Err(e) => expense_error_response(e),
    }
}

pub async fn list_expenses_handler(State(state): State<AppState>) -> Response {
    let pool = match &state.pool {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Database unconfigured" })),
            )
                .into_response();
        }
    };

    match service::get_all_expenses(pool).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => expense_error_response(e),
    }
}

pub async fn approve_expense_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Response {
    let pool = match &state.pool {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Database unconfigured" })),
            )
                .into_response();
        }
    };

    match service::approve_expense(pool, id).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => expense_error_response(e),
    }
}

pub async fn upload_receipt_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UploadReceiptRequest>,
) -> Response {
    let pool = match &state.pool {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Database unconfigured" })),
            )
                .into_response();
        }
    };

    match service::upload_receipt(pool, id, payload).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => expense_error_response(e),
    }
}
