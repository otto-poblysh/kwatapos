use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

async fn test_app() -> axum::Router {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://kwata_admin:kwata_password@127.0.0.1:5432/kwatapos".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");

    backend::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    backend::app_with_state(backend::AppState { pool: Some(pool) })
}

#[tokio::test]
async fn test_hash_generation() {
    let admin_hash = backend::features::auth::service::hash_password("admin123").unwrap();
    let manager_hash = backend::features::auth::service::hash_password("manager123").unwrap();
    let sales_hash = backend::features::auth::service::hash_password("sales123").unwrap();
    assert!(backend::features::auth::service::verify_password("admin123", &admin_hash));
    assert!(backend::features::auth::service::verify_password("manager123", &manager_hash));
    assert!(backend::features::auth::service::verify_password("sales123", &sales_hash));

    // Dynamic salt generates different hashes for the same password
    let hash1 = backend::features::auth::service::hash_password("same_password").unwrap();
    let hash2 = backend::features::auth::service::hash_password("same_password").unwrap();
    assert_ne!(hash1, hash2);
    assert!(backend::features::auth::service::verify_password("same_password", &hash1));
    assert!(backend::features::auth::service::verify_password("same_password", &hash2));
}

#[tokio::test]
async fn test_login_success() {
    let app = test_app().await;
    let payload = json!({
        "email": "admin@kwatapos.com",
        "password": "admin123"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json.get("access_token").is_some());
    assert!(json.get("refresh_token").is_some());
    assert_eq!(json["user"]["role"], "admin");
    assert_eq!(json["user"]["email"], "admin@kwatapos.com");
    // Ensure password_hash is never leaked in the user object
    assert!(json["user"].get("password_hash").is_none());
}

#[tokio::test]
async fn test_login_manager_success() {
    let app = test_app().await;
    let payload = json!({
        "email": "manager@kwatapos.com",
        "password": "manager123"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["user"]["role"], "manager");
    assert_eq!(json["user"]["email"], "manager@kwatapos.com");
}

#[tokio::test]
async fn test_login_sales_success() {
    let app = test_app().await;
    let payload = json!({
        "email": "sales@kwatapos.com",
        "password": "sales123"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["user"]["role"], "sales");
    assert_eq!(json["user"]["email"], "sales@kwatapos.com");
}

#[tokio::test]
async fn test_login_invalid_password() {
    let app = test_app().await;
    let payload = json!({
        "email": "admin@kwatapos.com",
        "password": "wrongpassword"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_login_user_not_found() {
    let app = test_app().await;
    let payload = json!({
        "email": "nonexistent@kwatapos.com",
        "password": "somepassword"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_me_authenticated() {
    let app = test_app().await;
    let login_payload = json!({
        "email": "admin@kwatapos.com",
        "password": "admin123"
    });

    let login_res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = login_res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    let access_token = json["access_token"].as_str().expect("access_token missing");

    let app2 = test_app().await;
    let me_res = app2
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/auth/me")
                .header(header::AUTHORIZATION, format!("Bearer {}", access_token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(me_res.status(), StatusCode::OK);

    let me_body = me_res.into_body().collect().await.unwrap().to_bytes();
    let me_json: Value = serde_json::from_slice(&me_body).unwrap();

    assert_eq!(me_json["email"], "admin@kwatapos.com");
    assert_eq!(me_json["role"], "admin");
    assert!(me_json.get("id").is_some());
    // Ensure password_hash is not present
    assert!(me_json.get("password_hash").is_none());
}

#[tokio::test]
async fn test_me_unauthorized() {
    let app = test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/auth/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_refresh_token() {
    let app = test_app().await;
    let login_payload = json!({
        "email": "admin@kwatapos.com",
        "password": "admin123"
    });

    let login_res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = login_res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    let refresh_token = json["refresh_token"].as_str().expect("refresh_token missing");

    let app2 = test_app().await;
    let refresh_payload = json!({
        "refresh_token": refresh_token
    });

    let refresh_res = app2
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/refresh")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&refresh_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(refresh_res.status(), StatusCode::OK);

    let refresh_body = refresh_res.into_body().collect().await.unwrap().to_bytes();
    let refresh_json: Value = serde_json::from_slice(&refresh_body).unwrap();

    assert!(refresh_json.get("access_token").is_some());
    let new_access_token = refresh_json["access_token"].as_str().unwrap();
    assert!(!new_access_token.is_empty());

    // Verify that the new access token can be used at /api/auth/me
    let app3 = test_app().await;
    let me_res = app3
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/auth/me")
                .header(header::AUTHORIZATION, format!("Bearer {}", new_access_token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(me_res.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_refresh_invalid_token() {
    let app = test_app().await;
    let refresh_payload = json!({
        "refresh_token": "invalid.jwt.token"
    });

    let refresh_res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/refresh")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&refresh_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(refresh_res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_me_with_refresh_token_rejected() {
    let app = test_app().await;
    let login_payload = json!({
        "email": "admin@kwatapos.com",
        "password": "admin123"
    });

    let login_res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = login_res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    let refresh_token = json["refresh_token"].as_str().unwrap();

    // Using a refresh_token as Bearer token to /me should be rejected
    let app2 = test_app().await;
    let me_res = app2
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/auth/me")
                .header(header::AUTHORIZATION, format!("Bearer {}", refresh_token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(me_res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_refresh_with_access_token_rejected() {
    let app = test_app().await;
    let login_payload = json!({
        "email": "admin@kwatapos.com",
        "password": "admin123"
    });

    let login_res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = login_res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    let access_token = json["access_token"].as_str().unwrap();

    // Using an access_token at /refresh should be rejected
    let app2 = test_app().await;
    let refresh_payload = json!({
        "refresh_token": access_token
    });

    let refresh_res = app2
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/refresh")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&refresh_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(refresh_res.status(), StatusCode::UNAUTHORIZED);
}

