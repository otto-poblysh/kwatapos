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
    dto::{ConfirmVendorRequest, CreateRequisitionRequest, DeliverRequisitionRequest},
    service::{self, RequisitionError},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_requisitions_handler).post(create_requisition_handler))
        .route("/{id}", get(get_requisition_handler))
        .route("/{id}/share", post(share_requisition_handler))
        .route("/{id}/deliver", post(deliver_requisition_handler))
        .route("/{id}/pay", post(pay_requisition_handler))
}

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route(
            "/{token}",
            get(get_public_requisition_handler).post(confirm_public_requisition_handler),
        )
}

fn requisition_error_response(err: RequisitionError) -> Response {
    match err {
        RequisitionError::ValidationError(msg) => {
            (StatusCode::BAD_REQUEST, Json(json!({ "error": msg }))).into_response()
        }
        RequisitionError::NotFound(msg) => {
            (StatusCode::NOT_FOUND, Json(json!({ "error": msg }))).into_response()
        }
        RequisitionError::InvalidStatus(msg) => {
            (StatusCode::BAD_REQUEST, Json(json!({ "error": msg }))).into_response()
        }
        RequisitionError::Database(e) => {
            eprintln!("Requisitions database error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Internal server error" })),
            )
                .into_response()
        }
    }
}

pub async fn create_requisition_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateRequisitionRequest>,
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

    match service::create_requisition(pool, payload).await {
        Ok(res) => (StatusCode::CREATED, Json(res)).into_response(),
        Err(e) => requisition_error_response(e),
    }
}

pub async fn list_requisitions_handler(State(state): State<AppState>) -> Response {
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

    match service::get_requisitions(pool).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => requisition_error_response(e),
    }
}

pub async fn get_requisition_handler(
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

    match service::get_requisition_by_id(pool, id).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => requisition_error_response(e),
    }
}

pub async fn share_requisition_handler(
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

    match service::share_requisition(pool, id).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => requisition_error_response(e),
    }
}

pub async fn deliver_requisition_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<DeliverRequisitionRequest>,
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

    match service::deliver_requisition(pool, id, payload).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => requisition_error_response(e),
    }
}

pub async fn pay_requisition_handler(
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

    match service::pay_requisition(pool, id).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => requisition_error_response(e),
    }
}

pub async fn get_public_requisition_handler(
    State(state): State<AppState>,
    Path(token): Path<Uuid>,
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

    match service::get_public_requisition(pool, token).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => requisition_error_response(e),
    }
}

pub async fn confirm_public_requisition_handler(
    State(state): State<AppState>,
    Path(token): Path<Uuid>,
    Json(payload): Json<ConfirmVendorRequest>,
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

    match service::confirm_public_requisition(pool, token, payload).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => requisition_error_response(e),
    }
}
