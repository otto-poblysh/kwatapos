use axum::{extract::State, routing::get, response::Json, Router};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

pub mod core;
pub mod features;

/// Homebrew `postgresql@17` on 5432, shared with Poblysh as user `akamaotto`.
pub const DEFAULT_DATABASE_URL: &str = "postgres://akamaotto@127.0.0.1:5432/kwatapos";

/// Kwata HTTP range is 3011–3020; Poblysh uses 3000–3010.
pub const BACKEND_PORT: u16 = 3014;

pub fn database_url() -> String {
    dotenvy::dotenv().ok();
    std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string())
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}

#[derive(Clone, Default)]
pub struct AppState {
    pub pool: Option<PgPool>,
}

#[derive(OpenApi)]
#[openapi(
    paths(health_check),
    tags(
        (name = "health", description = "System Health and Connectivity")
    )
)]
pub struct ApiDoc;

pub fn app() -> Router {
    app_with_state(AppState::default())
}

pub fn app_with_state(state: AppState) -> Router {
    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/api/health", get(health_check))
        .nest("/api/auth", features::auth::controller::router())
        .nest("/api/customers", features::customers::controller::router())
        .nest("/api/customer", features::customers::controller::portal_router())
        .nest("/api/reports", features::reports::controller::router())
        .nest("/api/requisitions", features::requisitions::controller::router())
        .nest("/api/public/requisition", features::requisitions::controller::public_router())
        .nest("/api/expenses", features::expenses::controller::router())
        .nest("/api/admin", features::admin::controller::router())
        .nest("/api", features::sales::controller::router())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

#[utoipa::path(
    get,
    path = "/api/health",
    responses(
        (status = 200, description = "System and Database health status")
    )
)]
pub async fn health_check(State(state): State<AppState>) -> Json<Value> {
    let (db_status, db_sample) = if let Some(ref pool) = state.pool {
        match sqlx::query_scalar::<_, String>("SELECT 'Hello World from Kwata POS Database!'").fetch_one(pool).await {
            Ok(val) => ("connected", Some(val)),
            Err(e) => ("error connecting", Some(e.to_string())),
        }
    } else {
        ("unconfigured", None)
    };

    Json(json!({
        "status": "ok",
        "message": "System Online",
        "database": db_status,
        "sample_data": db_sample
    }))
}
