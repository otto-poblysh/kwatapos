use axum::{
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
};
use serde_json::json;
use uuid::Uuid;

use crate::features::admin::service as admin_service;
use crate::features::auth::service::{self as auth_service, AuthError};
use crate::AppState;

/// Named permission required to proceed.
///
/// Apply as a handler guard:
/// `RequirePermission("users.manage").enforce(&state, &headers).await`
#[derive(Clone, Copy, Debug)]
pub struct RequirePermission(pub &'static str);

impl RequirePermission {
    pub async fn enforce(
        self,
        state: &AppState,
        headers: &HeaderMap,
    ) -> Result<auth_service::Claims, Response> {
        let claims = match auth_service::claims_from_authorization_header(headers) {
            Ok(c) => c,
            Err(_) => {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(json!({"error": "Invalid or expired token"})),
                )
                    .into_response());
            }
        };

        let user_id = match Uuid::parse_str(&claims.sub) {
            Ok(id) => id,
            Err(_) => {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(json!({"error": "Invalid user ID in token"})),
                )
                    .into_response());
            }
        };

        let Some(pool) = state.pool.as_ref() else {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database unconfigured"})),
            )
                .into_response());
        };

        match admin_service::require_permission(pool, user_id, self.0).await {
            Ok(()) => Ok(claims),
            Err(AuthError::Forbidden) => Err((
                StatusCode::FORBIDDEN,
                Json(json!({"error": format!("Missing permission: {}", self.0)})),
            )
                .into_response()),
            Err(AuthError::InvalidToken | AuthError::InvalidCredentials) => Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid or expired token"})),
            )
                .into_response()),
            Err(e) => {
                eprintln!("Permission check error: {e}");
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Internal server error"})),
                )
                    .into_response())
            }
        }
    }
}
