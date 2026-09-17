use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::core::middleware::RequirePermission;
use crate::AppState;

use super::{
    dto::{
        CreateAdminCustomerRequest, CreateProductRequest, CreateUserRequest,
        SetUserPermissionRequest, UpdateAdminCustomerRequest, UpdateProductRequest,
        UpdateRolePermissionsRequest, UpdateUserRequest, UpsertRoleRequest,
    },
    service::{self, AdminError},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/users", get(list_users).post(create_user))
        .route("/users/{id}", get(get_user).put(update_user).delete(delete_user))
        .route("/users/{id}/permissions", axum::routing::post(set_user_permission))
        .route(
            "/users/{id}/permissions/{permission}",
            axum::routing::delete(clear_user_permission),
        )
        .route("/roles", get(list_roles).post(create_role))
        .route("/roles/{name}", get(get_role).put(update_role).delete(delete_role))
        .route("/permissions", get(list_permissions))
        .route("/products", get(list_products).post(create_product))
        .route(
            "/products/{id}",
            axum::routing::put(update_product).delete(delete_product),
        )
        .route("/customers", get(list_customers).post(create_customer))
        .route(
            "/customers/{id}",
            axum::routing::put(update_customer).delete(delete_customer),
        )
}

fn unconfigured_db() -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "Database unconfigured"})),
    )
        .into_response()
}

fn admin_error(err: AdminError) -> Response {
    match err {
        AdminError::Auth(crate::features::auth::service::AuthError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Forbidden"})),
        )
            .into_response(),
        AdminError::Auth(_) => (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid or expired token"})),
        )
            .into_response(),
        AdminError::InvalidInput(msg) => {
            (StatusCode::BAD_REQUEST, Json(json!({"error": msg}))).into_response()
        }
        AdminError::NotFound(msg) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": msg}))).into_response()
        }
        AdminError::Conflict(msg) => {
            (StatusCode::CONFLICT, Json(json!({"error": msg}))).into_response()
        }
        AdminError::Database(e) => {
            eprintln!("Admin database error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}

fn pool(state: &AppState) -> Result<&sqlx::PgPool, Response> {
    state.pool.as_ref().ok_or_else(unconfigured_db)
}

async fn require(
    permission: &'static str,
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(), Response> {
    RequirePermission(permission)
        .enforce(state, headers)
        .await
        .map(|_| ())
}

pub async fn list_permissions(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(resp) = require("users.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::list_permissions(pool).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn list_users(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(resp) = require("users.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::list_users(pool).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn get_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    if let Err(resp) = require("users.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::get_user(pool, id).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn create_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateUserRequest>,
) -> Response {
    if let Err(resp) = require("users.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::create_user(pool, payload).await {
        Ok(data) => (StatusCode::CREATED, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn update_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUserRequest>,
) -> Response {
    if let Err(resp) = require("users.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::update_user(pool, id, payload).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn delete_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    if let Err(resp) = require("users.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::delete_user(pool, id).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn set_user_permission(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<SetUserPermissionRequest>,
) -> Response {
    if let Err(resp) = require("users.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::set_user_permission(pool, id, payload).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn clear_user_permission(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, permission)): Path<(Uuid, String)>,
) -> Response {
    if let Err(resp) = require("users.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::clear_user_permission(pool, id, &permission).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn list_roles(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(resp) = require("roles.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::list_roles(pool).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn get_role(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Response {
    if let Err(resp) = require("roles.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::list_roles(pool).await {
        Ok(roles) => {
            if let Some(role) = roles.into_iter().find(|r| r.name == name) {
                (StatusCode::OK, Json(role)).into_response()
            } else {
                admin_error(AdminError::NotFound(format!("Role '{name}' does not exist")))
            }
        }
        Err(e) => admin_error(e),
    }
}

pub async fn create_role(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpsertRoleRequest>,
) -> Response {
    if let Err(resp) = require("roles.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::create_role(pool, payload).await {
        Ok(data) => (StatusCode::CREATED, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn update_role(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(name): Path<String>,
    Json(payload): Json<UpdateRolePermissionsRequest>,
) -> Response {
    if let Err(resp) = require("roles.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::update_role(pool, &name, payload).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn delete_role(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Response {
    if let Err(resp) = require("roles.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::delete_role(pool, &name).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn list_products(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(resp) = require("catalog.read", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::list_products(pool).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn create_product(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateProductRequest>,
) -> Response {
    if let Err(resp) = require("catalog.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::create_product(pool, payload).await {
        Ok(data) => (StatusCode::CREATED, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn update_product(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProductRequest>,
) -> Response {
    if let Err(resp) = require("catalog.update", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::update_product(pool, id, payload).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn delete_product(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    if let Err(resp) = require("catalog.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::delete_product(pool, id).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn list_customers(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(resp) = require("customers.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::list_customers(pool).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn create_customer(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateAdminCustomerRequest>,
) -> Response {
    if let Err(resp) = require("customers.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::create_customer(pool, payload).await {
        Ok(data) => (StatusCode::CREATED, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn update_customer(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAdminCustomerRequest>,
) -> Response {
    if let Err(resp) = require("customers.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::update_customer(pool, id, payload).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => admin_error(e),
    }
}

pub async fn delete_customer(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    if let Err(resp) = require("customers.manage", &state, &headers).await {
        return resp;
    }
    let pool = match pool(&state) {
        Ok(p) => p,
        Err(r) => return r,
    };
    match service::delete_customer(pool, id).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => admin_error(e),
    }
}
