use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;
use uuid::Uuid;

async fn test_app_and_pool() -> (axum::Router, sqlx::PgPool) {
    let db_url = backend::database_url();
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");
    backend::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");
    let app = backend::app_with_state(backend::AppState {
        pool: Some(pool.clone()),
    });
    (app, pool)
}

async fn login(app: axum::Router, email: &str, password: &str) -> (StatusCode, Value) {
    let payload = json!({ "email": email, "password": password });
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
    let status = response.status();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
    (status, json)
}

async fn admin_token() -> String {
    let (app, _) = test_app_and_pool().await;
    let (status, json) = login(app, "admin@kwatapos.com", "admin123").await;
    assert_eq!(status, StatusCode::OK);
    json["access_token"].as_str().unwrap().to_string()
}

async fn sales_token() -> String {
    let (app, _) = test_app_and_pool().await;
    let (status, json) = login(app, "sales@kwatapos.com", "sales123").await;
    assert_eq!(status, StatusCode::OK);
    json["access_token"].as_str().unwrap().to_string()
}

async fn send(
    method: &str,
    uri: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let (app, _) = test_app_and_pool().await;
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(token) = token {
        builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }
    if body.is_some() {
        builder = builder.header(header::CONTENT_TYPE, "application/json");
    }
    let request_body = body
        .map(|v| Body::from(serde_json::to_vec(&v).unwrap()))
        .unwrap_or_else(Body::empty);
    let response = app.oneshot(builder.body(request_body).unwrap()).await.unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    };
    (status, json)
}

#[tokio::test]
async fn test_admin_users_require_auth_and_permission() {
    let (status, _) = send("GET", "/api/admin/users", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let sales = sales_token().await;
    let (status, json) = send("GET", "/api/admin/users", Some(&sales), None).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "body={json}");
}

#[tokio::test]
async fn test_admin_can_list_users_roles_and_permissions() {
    let token = admin_token().await;
    let (status, users) = send("GET", "/api/admin/users", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(users.as_array().unwrap().iter().any(|u| u["email"] == "admin@kwatapos.com"));

    let (status, roles) = send("GET", "/api/admin/roles", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    let names: Vec<&str> = roles
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["name"].as_str().unwrap())
        .collect();
    assert!(names.contains(&"admin"));
    assert!(names.contains(&"sales"));

    let (status, perms) = send("GET", "/api/admin/permissions", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    let perm_names: Vec<&str> = perms
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["name"].as_str().unwrap())
        .collect();
    assert!(perm_names.contains(&"users.manage"));
    assert!(perm_names.contains(&"catalog.update"));
}

#[tokio::test]
async fn test_granular_permission_override_allows_catalog_update() {
    let admin = admin_token().await;
    let suffix = Uuid::new_v4().simple().to_string();
    let role_name = format!("Weekend Staff {suffix}");
    let email = format!("usera-{suffix}@kwatapos.test");

    let (status, role) = send(
        "POST",
        "/api/admin/roles",
        Some(&admin),
        Some(json!({
            "name": role_name,
            "permissions": ["pos.sale", "catalog.read"]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "body={role}");
    assert_eq!(role["name"], role_name);

    let (status, user) = send(
        "POST",
        "/api/admin/users",
        Some(&admin),
        Some(json!({
            "email": email,
            "password": "weekend123",
            "role": role_name
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "body={user}");
    let user_id = user["id"].as_str().unwrap().to_string();

    let (app, _) = test_app_and_pool().await;
    let (login_status, login_json) = login(app, &email, "weekend123").await;
    assert_eq!(login_status, StatusCode::OK);
    let user_token = login_json["access_token"].as_str().unwrap().to_string();

    let (status, products) = send("GET", "/api/admin/products", Some(&user_token), None).await;
    assert_eq!(status, StatusCode::OK, "body={products}");
    let first = products.as_array().unwrap().first().expect("seeded products");
    let product_id = first["id"].as_str().unwrap();
    let original_price = first["price"].clone();

    let (status, denied) = send(
        "PUT",
        &format!("/api/admin/products/{product_id}"),
        Some(&user_token),
        Some(json!({ "price": "1234.00" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "body={denied}");

    let (status, granted) = send(
        "POST",
        &format!("/api/admin/users/{user_id}/permissions"),
        Some(&admin),
        Some(json!({
            "permission": "catalog.update",
            "is_granted": true
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "body={granted}");
    let catalog_update = granted["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["name"] == "catalog.update")
        .unwrap();
    assert_eq!(catalog_update["source"], "grant");
    assert_eq!(catalog_update["is_effective"], true);

    let (status, updated) = send(
        "PUT",
        &format!("/api/admin/products/{product_id}"),
        Some(&user_token),
        Some(json!({ "price": "1234.00" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "body={updated}");
    assert_eq!(updated["price"], "1234.00");

    let (status, restored) = send(
        "PUT",
        &format!("/api/admin/products/{product_id}"),
        Some(&admin),
        Some(json!({ "price": original_price })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "body={restored}");

    let _ = send(
        "DELETE",
        &format!("/api/admin/users/{user_id}"),
        Some(&admin),
        None,
    )
    .await;
    let encoded = role_name.replace(' ', "%20");
    let _ = send(
        "DELETE",
        &format!("/api/admin/roles/{encoded}"),
        Some(&admin),
        None,
    )
    .await;
}

#[tokio::test]
async fn test_admin_product_and_customer_crud() {
    let admin = admin_token().await;
    let suffix = Uuid::new_v4().simple().to_string();

    let (status, product) = send(
        "POST",
        "/api/admin/products",
        Some(&admin),
        Some(json!({
            "name": format!("Guinness Stout {suffix}"),
            "price": "1200.00",
            "category": "beer",
            "stock_quantity": 24
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "body={product}");
    let product_id = product["id"].as_str().unwrap().to_string();
    assert_eq!(product["stock_quantity"], 24);

    let (status, listed) = send("GET", "/api/admin/products", Some(&admin), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(listed.as_array().unwrap().iter().any(|p| p["id"] == product_id));

    let (status, updated) = send(
        "PUT",
        &format!("/api/admin/products/{product_id}"),
        Some(&admin),
        Some(json!({ "stock_quantity": 40, "price": "1250.00" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "body={updated}");
    assert_eq!(updated["stock_quantity"], 40);

    let phone = format!("+237699{suffix:.8}");
    let (status, customer) = send(
        "POST",
        "/api/admin/customers",
        Some(&admin),
        Some(json!({
            "name": format!("UAT Customer {suffix}"),
            "phone_number": phone,
            "pin": "1234"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "body={customer}");
    let customer_id = customer["id"].as_str().unwrap().to_string();

    let (status, pin_reset) = send(
        "PUT",
        &format!("/api/admin/customers/{customer_id}"),
        Some(&admin),
        Some(json!({ "pin": "4321" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "body={pin_reset}");

    let (status, _) = send(
        "DELETE",
        &format!("/api/admin/customers/{customer_id}"),
        Some(&admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, _) = send(
        "DELETE",
        &format!("/api/admin/products/{product_id}"),
        Some(&admin),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn test_sales_cannot_create_products() {
    let sales = sales_token().await;
    let (status, json) = send(
        "POST",
        "/api/admin/products",
        Some(&sales),
        Some(json!({
            "name": "Forbidden Lager",
            "price": "500.00",
            "category": "beer",
            "stock_quantity": 1
        })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "body={json}");
}
