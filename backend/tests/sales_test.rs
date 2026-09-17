use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

use backend::features::inventory::repository::{create_product, get_inventory, set_inventory};
use rust_decimal::Decimal;

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

    let product_list: Vec<backend::features::inventory::repository::ProductWithInventory> =
        serde_json::from_slice(&body).unwrap();
    assert!(product_list[0].price > Decimal::ZERO);
}

#[tokio::test]
async fn test_post_orders_cash_success_and_decrements_inventory() {
    let (app, pool) = test_app_and_pool().await;

    let test_product = create_product(&pool, "Cash Order Beer", Decimal::from(750), "beer")
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
    assert_eq!(json["total_amount"], "2250.00");

    let items = json["items"].as_array().expect("items array missing");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["product_id"], test_product.id.to_string());
    assert_eq!(items[0]["quantity"], 3);
    assert_eq!(items[0]["unit_price"], "750.00");

    let order_resp: backend::features::sales::dto::OrderResponse =
        serde_json::from_slice(&body).unwrap();
    assert_eq!(order_resp.total_amount, Decimal::from(2250));
    assert_eq!(order_resp.items[0].unit_price, Decimal::from(750));

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

    let test_product = create_product(&pool, "Limited Stock Item", Decimal::from(1200), "food")
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

    let test_product = create_product(&pool, "Zero Qty Item", Decimal::from(500), "drink")
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

    let p1 = create_product(&pool, "Multi Item 1", Decimal::from(500), "drink")
        .await
        .expect("Failed to create p1");
    set_inventory(&pool, p1.id, 10).await.unwrap();

    let p2 = create_product(&pool, "Multi Item 2", Decimal::from(1500), "food")
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

    // 2 * 500 + 3 * 1500 = 1000 + 4500 = 5500.00
    assert_eq!(json["total_amount"], "5500.00");
    assert_eq!(json["items"].as_array().unwrap().len(), 2);

    let order_resp: backend::features::sales::dto::OrderResponse =
        serde_json::from_slice(&body).unwrap();
    assert_eq!(order_resp.total_amount, Decimal::from(5500));

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
    assert_eq!(db_order.total_amount, Decimal::from(5500));
    assert_eq!(db_order.payment_method.as_deref(), Some("cash"));
    assert_eq!(db_order.status, "completed");
    assert_eq!(db_order.order_name, None);

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

    let p1 = create_product(&pool, "Rollback Item 1", Decimal::from(300), "drink")
        .await
        .unwrap();
    set_inventory(&pool, p1.id, 10).await.unwrap();

    let p2 = create_product(&pool, "Rollback Item 2", Decimal::from(800), "food")
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

#[tokio::test]
async fn test_open_orders_repository_lifecycle() {
    let (_app, pool) = test_app_and_pool().await;

    // 1. Create open order with name
    let tab_name = "Table 4 - Tab";
    let order1 = backend::features::sales::repository::create_open_order(&pool, Some(tab_name))
        .await
        .expect("Failed to create open order");

    assert_eq!(order1.order_name.as_deref(), Some(tab_name));
    assert_eq!(order1.payment_method, None);
    assert_eq!(order1.status, "open");
    assert_eq!(order1.total_amount, Decimal::ZERO);

    // 2. Create open order inside transaction without name
    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    let order2 = backend::features::sales::repository::create_open_order_tx(&mut tx, None)
        .await
        .expect("Failed to create open order tx");
    tx.commit().await.expect("Failed to commit");

    assert_eq!(order2.order_name, None);
    assert_eq!(order2.payment_method, None);
    assert_eq!(order2.status, "open");
    assert_eq!(order2.total_amount, Decimal::ZERO);

    // 3. get_open_orders contains both
    let open_orders = backend::features::sales::repository::get_open_orders(&pool)
        .await
        .expect("Failed to get open orders");
    assert!(open_orders.iter().any(|o| o.id == order1.id));
    assert!(open_orders.iter().any(|o| o.id == order2.id));

    // 4. Update order total in transaction
    let mut tx = pool.begin().await.expect("Failed to begin tx");
    let new_total = Decimal::new(3500, 0); // 3500.00
    backend::features::sales::repository::update_order_total_tx(&mut tx, order1.id, new_total)
        .await
        .expect("Failed to update order total");
    tx.commit().await.expect("Failed to commit update");

    let updated = backend::features::sales::repository::get_order_by_id(&pool, order1.id)
        .await
        .expect("Failed to get order")
        .expect("Order not found");
    assert_eq!(updated.total_amount, new_total);

    // 5. Settle order
    let mut tx = pool.begin().await.expect("Failed to begin tx");
    let settled = backend::features::sales::repository::settle_order_tx(&mut tx, order1.id, "cash")
        .await
        .expect("Failed to settle order");
    tx.commit().await.expect("Failed to commit settle");

    assert_eq!(settled.id, order1.id);
    assert_eq!(settled.status, "completed");
    assert_eq!(settled.payment_method.as_deref(), Some("cash"));
    assert_eq!(settled.total_amount, new_total);

    // 6. Verify order1 is no longer in open orders
    let open_orders_after = backend::features::sales::repository::get_open_orders(&pool)
        .await
        .expect("Failed to get open orders after settlement");
    assert!(!open_orders_after.iter().any(|o| o.id == order1.id));
    assert!(open_orders_after.iter().any(|o| o.id == order2.id));

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id IN ($1, $2)")
        .bind(order1.id)
        .bind(order2.id)
        .execute(&pool)
        .await;
}

