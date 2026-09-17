use axum::{routing::get, Router, response::Json};
use serde_json::{Value, json};

pub fn app() -> Router {
    Router::new().route("/api/health", get(health_check))
}

async fn health_check() -> Json<Value> {
    Json(json!({ "status": "ok", "message": "System Online" }))
}
