use axum::{extract::State, routing::get, response::Json, Router};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

pub mod features;

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
