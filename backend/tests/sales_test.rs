use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

use backend::features::inventory::repository::{create_product, get_inventory, set_inventory};

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

#[tokio::test]
async fn test_get_products_returns_200_and_list() {
    let (app, _pool) = test_app_and_pool().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/products")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json.is_array(), "Expected JSON array of products");
    let products = json.as_array().unwrap();
    assert!(
        products.len() >= 5,
        "Expected at least 5 seeded products, got {}",
        products.len()
    );

    let first = &products[0];
    assert!(first.get("id").is_some());
    assert!(first.get("name").is_some());
    assert!(first.get("price").is_some());
    assert!(first.get("category").is_some());
    assert!(first.get("quantity").is_some());
}

#[tokio::test]
async fn test_post_orders_cash_success_and_decrements_inventory() {
    let (app, pool) = test_app_and_pool().await;

    let test_product = create_product(&pool, "Cash Order Beer", 750.0, "beer")
        .await
        .expect("Failed to create test product");

    set_inventory(&pool, test_product.id, 25)
        .await
        .expect("Failed to set inventory");

    let payload = json!({
        "items": [
            {
                "product_id": test_product.id,
                "quantity": 3
            }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders/cash")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json.get("id").is_some());
    assert_eq!(json["status"], "completed");
    assert_eq!(json["payment_method"], "cash");
    assert_eq!(json["total_amount"], 2250.0);

    let items = json["items"].as_array().expect("items array missing");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["product_id"], test_product.id.to_string());
    assert_eq!(items[0]["quantity"], 3);
    assert_eq!(items[0]["unit_price"], 750.0);

    // Verify inventory decrement in database
    let inv = get_inventory(&pool, test_product.id)
        .await
        .expect("Query failed")
        .expect("Inventory not found");
    assert_eq!(inv.quantity, 22);

    // Cleanup
    let _ = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(test_product.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_orders_cash_insufficient_stock_returns_400_and_rolls_back() {
    let (app, pool) = test_app_and_pool().await;

    let test_product = create_product(&pool, "Limited Stock Item", 1200.0, "food")
        .await
        .expect("Failed to create test product");

    set_inventory(&pool, test_product.id, 4)
        .await
        .expect("Failed to set inventory");

    let payload = json!({
        "items": [
            {
                "product_id": test_product.id,
                "quantity": 10
            }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders/cash")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert!(json.get("error").is_some());

    // Verify inventory was NOT changed (remains 4)
    let inv = get_inventory(&pool, test_product.id)
        .await
        .expect("Query failed")
        .expect("Inventory not found");
    assert_eq!(inv.quantity, 4);

    // Cleanup
    let _ = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(test_product.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_orders_cash_empty_items_returns_400() {
    let (app, _pool) = test_app_and_pool().await;

    let payload = json!({
        "items": []
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders/cash")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert!(json.get("error").is_some());
}

#[tokio::test]
async fn test_post_orders_cash_non_positive_quantity_returns_400() {
    let (app, pool) = test_app_and_pool().await;

    let test_product = create_product(&pool, "Zero Qty Item", 500.0, "drink")
        .await
        .expect("Failed to create test product");

    set_inventory(&pool, test_product.id, 10)
        .await
        .expect("Failed to set inventory");

    // Zero quantity
    let zero_payload = json!({
        "items": [
            {
                "product_id": test_product.id,
                "quantity": 0
            }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders/cash")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&zero_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // Negative quantity
    let neg_payload = json!({
        "items": [
            {
                "product_id": test_product.id,
                "quantity": -3
            }
        ]
    });

    let (app2, _) = test_app_and_pool().await;
    let response2 = app2
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders/cash")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&neg_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response2.status(), StatusCode::BAD_REQUEST);

    // Cleanup
    let _ = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(test_product.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_orders_cash_multi_item_success() {
    let (app, pool) = test_app_and_pool().await;

    let p1 = create_product(&pool, "Multi Item 1", 500.0, "drink")
        .await
        .expect("Failed to create p1");
    set_inventory(&pool, p1.id, 10).await.unwrap();

    let p2 = create_product(&pool, "Multi Item 2", 1500.0, "food")
        .await
        .expect("Failed to create p2");
    set_inventory(&pool, p2.id, 5).await.unwrap();

    let payload = json!({
        "items": [
            { "product_id": p1.id, "quantity": 2 },
            { "product_id": p2.id, "quantity": 3 }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders/cash")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    // 2 * 500 + 3 * 1500 = 1000 + 4500 = 5500.0
    assert_eq!(json["total_amount"], 5500.0);
    assert_eq!(json["items"].as_array().unwrap().len(), 2);

    let inv1 = get_inventory(&pool, p1.id).await.unwrap().unwrap();
    assert_eq!(inv1.quantity, 8); // 10 - 2

    let inv2 = get_inventory(&pool, p2.id).await.unwrap().unwrap();
    assert_eq!(inv2.quantity, 2); // 5 - 3

    // Verify order can be queried via repository
    let order_id = uuid::Uuid::parse_str(json["id"].as_str().unwrap()).unwrap();
    let db_order = backend::features::sales::repository::get_order_by_id(&pool, order_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(db_order.total_amount, 5500.0);
    assert_eq!(db_order.payment_method, "cash");

    let db_items = backend::features::sales::repository::get_order_items_by_order_id(&pool, order_id)
        .await
        .unwrap();
    assert_eq!(db_items.len(), 2);

    // Cleanup
    let _ = sqlx::query("DELETE FROM products WHERE id IN ($1, $2)")
        .bind(p1.id)
        .bind(p2.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_orders_cash_multi_item_rollback_on_partial_failure() {
    let (app, pool) = test_app_and_pool().await;

    let p1 = create_product(&pool, "Rollback Item 1", 300.0, "drink")
        .await
        .unwrap();
    set_inventory(&pool, p1.id, 10).await.unwrap();

    let p2 = create_product(&pool, "Rollback Item 2", 800.0, "food")
        .await
        .unwrap();
    set_inventory(&pool, p2.id, 2).await.unwrap();

    // p1 has 10 (asking 5 - ok), p2 has 2 (asking 5 - insufficient!)
    let payload = json!({
        "items": [
            { "product_id": p1.id, "quantity": 5 },
            { "product_id": p2.id, "quantity": 5 }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders/cash")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // BOTH inventories must be completely untouched due to transaction rollback
    let inv1 = get_inventory(&pool, p1.id).await.unwrap().unwrap();
    assert_eq!(inv1.quantity, 10, "p1 inventory must remain unchanged at 10");

    let inv2 = get_inventory(&pool, p2.id).await.unwrap().unwrap();
    assert_eq!(inv2.quantity, 2, "p2 inventory must remain unchanged at 2");

    // Cleanup
    let _ = sqlx::query("DELETE FROM products WHERE id IN ($1, $2)")
        .bind(p1.id)
        .bind(p2.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_orders_cash_nonexistent_product_returns_400() {
    let (app, _pool) = test_app_and_pool().await;

    let fake_id = uuid::Uuid::new_v4();
    let payload = json!({
        "items": [
            { "product_id": fake_id, "quantity": 1 }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders/cash")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert!(json["error"].as_str().unwrap().contains("not found"));
}
