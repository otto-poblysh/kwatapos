use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde_json::json;

use crate::features::auth::service::{self as auth_service, AuthError};
use crate::AppState;

use super::service::{self, ReportError};

pub fn router() -> Router<AppState> {
    Router::new().route("/daily", get(daily_report_handler))
}

pub async fn daily_report_handler(State(state): State<AppState>, headers: HeaderMap) -> Response {
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

    if let Err(AuthError::Forbidden) = auth_service::require_role(&claims, &["admin"]) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Admin access required"})),
        )
            .into_response();
    }

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

    match service::get_daily_report(pool).await {
        Ok(report) => (StatusCode::OK, Json(report)).into_response(),
        Err(ReportError::Database(e)) => {
            eprintln!("Daily report database error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}
