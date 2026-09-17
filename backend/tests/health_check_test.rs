use axum::{body::Body, http::{Request, StatusCode}};
use tower::ServiceExt;
use serde_json::Value;

// We will test the router directly without spinning up a TCP listener
#[tokio::test]
async fn test_health_check_returns_200_and_json() {
    let app = backend::app(); // 'app' function doesn't exist yet!

    let response = app
        .oneshot(Request::builder().uri("/api/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = http_body_util::BodyExt::collect(response.into_body()).await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["status"], "ok");
    assert_eq!(json["message"], "System Online");
}
