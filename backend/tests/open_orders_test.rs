use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use http_body_util::BodyExt;
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;
use uuid::Uuid;

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
async fn test_post_orders_creates_open_order_with_name_and_returns_201() {
    let (app, pool) = test_app_and_pool().await;

    let payload = json!({
        "order_name": "Table 4"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders")
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
    let order_id = Uuid::parse_str(json["id"].as_str().unwrap()).unwrap();
    assert_eq!(json["order_name"], "Table 4");
    assert!(json["payment_method"].is_null());
    assert_eq!(json["total_amount"], "0.00");
    assert_eq!(json["status"], "open");
    assert!(json.get("created_at").is_some());
    assert!(json.get("updated_at").is_some());

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id = $1")
        .bind(order_id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_orders_empty_payload_creates_open_order_without_name() {
    let (app, pool) = test_app_and_pool().await;

    let payload = json!({});

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["order_name"].is_null());
    assert_eq!(json["status"], "open");
    assert_eq!(json["total_amount"], "0.00");

    let order_id = Uuid::parse_str(json["id"].as_str().unwrap()).unwrap();
    let _ = sqlx::query("DELETE FROM orders WHERE id = $1")
        .bind(order_id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_get_orders_returns_200_and_open_orders_list() {
    let (app, pool) = test_app_and_pool().await;

    // Create two open orders via repository
    let o1 = backend::features::sales::repository::create_open_order(&pool, Some("Tab Alpha"))
        .await
        .unwrap();
    let o2 = backend::features::sales::repository::create_open_order(&pool, Some("Tab Beta"))
        .await
        .unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/orders")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json.is_array());
    let orders = json.as_array().unwrap();

    assert!(orders.iter().any(|o| o["id"] == o1.id.to_string()));
    assert!(orders.iter().any(|o| o["id"] == o2.id.to_string()));

    let first = &orders[0];
    assert!(first.get("id").is_some());
    assert!(first.get("status").is_some());
    assert_eq!(first["status"], "open");
    assert!(first.get("total_amount").is_some());
    assert!(first.get("created_at").is_some());
    assert!(first.get("updated_at").is_some());
    assert!(first.get("items_count").is_some());

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id IN ($1, $2)")
        .bind(o1.id)
        .bind(o2.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_get_order_by_id_returns_details_and_items() {
    let (app, pool) = test_app_and_pool().await;

    let p1 = create_product(&pool, "Tab Beer", Decimal::from(650), "drink")
        .await
        .unwrap();
    let order = backend::features::sales::repository::create_open_order(&pool, Some("Tab Details"))
        .await
        .unwrap();

    let mut tx = pool.begin().await.unwrap();
    backend::features::sales::repository::create_order_item_tx(
        &mut tx,
        order.id,
        p1.id,
        2,
        Decimal::from(650),
    )
    .await
    .unwrap();
    backend::features::sales::repository::update_order_total_tx(&mut tx, order.id, Decimal::from(1300))
        .await
        .unwrap();
    tx.commit().await.unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/orders/{}", order.id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["id"], order.id.to_string());
    assert_eq!(json["order_name"], "Tab Details");
    assert_eq!(json["total_amount"], "1300.00");
    assert_eq!(json["status"], "open");

    let items = json["items"].as_array().expect("items array missing");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["product_id"], p1.id.to_string());
    assert_eq!(items[0]["product_name"], "Tab Beer");
    assert_eq!(items[0]["quantity"], 2);
    assert_eq!(items[0]["unit_price"], "650.00");
    assert_eq!(items[0]["subtotal"], "1300.00");

    // Non-existent order returns 404
    let (app2, _) = test_app_and_pool().await;
    let missing_response = app2
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/orders/{}", Uuid::new_v4()))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(missing_response.status(), StatusCode::NOT_FOUND);

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id = $1")
        .bind(order.id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(p1.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_put_order_items_replaces_and_recalculates_total() {
    let (app, pool) = test_app_and_pool().await;

    let p1 = create_product(&pool, "Beer Item", Decimal::from(700), "drink")
        .await
        .unwrap();
    let p2 = create_product(&pool, "Food Item", Decimal::from(1500), "food")
        .await
        .unwrap();

    let order = backend::features::sales::repository::create_open_order(&pool, Some("Sync Tab"))
        .await
        .unwrap();

    // 1. Initial PUT items: 2x p1 + 1x p2 = 1400 + 1500 = 2900
    let payload = json!({
        "items": [
            { "product_id": p1.id, "quantity": 2 },
            { "product_id": p2.id, "quantity": 1 }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["total_amount"], "2900.00");
    assert_eq!(json["items"].as_array().unwrap().len(), 2);

    // 2. Replace items: 3x p1 only = 2100
    let replace_payload = json!({
        "items": [
            { "product_id": p1.id, "quantity": 3 }
        ]
    });

    let (app2, _) = test_app_and_pool().await;
    let response2 = app2
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&replace_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response2.status(), StatusCode::OK);
    let body2 = response2.into_body().collect().await.unwrap().to_bytes();
    let json2: Value = serde_json::from_slice(&body2).unwrap();
    assert_eq!(json2["total_amount"], "2100.00");
    let items2 = json2["items"].as_array().unwrap();
    assert_eq!(items2.len(), 1);
    assert_eq!(items2[0]["product_id"], p1.id.to_string());
    assert_eq!(items2[0]["quantity"], 3);

    // 3. PUT on nonexistent order returns 404
    let (app3, _) = test_app_and_pool().await;
    let response3 = app3
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", Uuid::new_v4()))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&replace_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response3.status(), StatusCode::NOT_FOUND);

    // 4. Invalid quantity returns 400
    let invalid_payload = json!({
        "items": [
            { "product_id": p1.id, "quantity": -1 }
        ]
    });
    let (app4, _) = test_app_and_pool().await;
    let response4 = app4
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&invalid_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response4.status(), StatusCode::BAD_REQUEST);

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id = $1")
        .bind(order.id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM products WHERE id IN ($1, $2)")
        .bind(p1.id)
        .bind(p2.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_settle_order_transfer_success_decrements_inventory() {
    let (app, pool) = test_app_and_pool().await;

    let p1 = create_product(&pool, "Settlement Beer", Decimal::from(800), "drink")
        .await
        .unwrap();
    set_inventory(&pool, p1.id, 15).await.unwrap();

    let order = backend::features::sales::repository::create_open_order(&pool, Some("Transfer Tab"))
        .await
        .unwrap();

    // Add 4 items via PUT
    let put_payload = json!({
        "items": [
            { "product_id": p1.id, "quantity": 4 }
        ]
    });
    let put_resp = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&put_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(put_resp.status(), StatusCode::OK);

    // Settle with transfer
    let settle_payload = json!({
        "payment_method": "transfer"
    });

    let (app2, _) = test_app_and_pool().await;
    let settle_resp = app2
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/orders/{}/settle", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&settle_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(settle_resp.status(), StatusCode::OK);
    let body = settle_resp.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "completed");
    assert_eq!(json["payment_method"], "transfer");
    assert_eq!(json["total_amount"], "3200.00");

    // Inventory decremented from 15 to 11
    let inv = get_inventory(&pool, p1.id).await.unwrap().unwrap();
    assert_eq!(inv.quantity, 11);

    // Order should not be in open orders anymore
    let open_orders = backend::features::sales::repository::get_open_orders(&pool)
        .await
        .unwrap();
    assert!(!open_orders.iter().any(|o| o.id == order.id));

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id = $1")
        .bind(order.id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(p1.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_settle_order_credit_success_requires_customer_and_creates_credit() {
    let (app, pool) = test_app_and_pool().await;

    let customer = backend::features::customers::repository::create_customer(
        &pool,
        "Credit Buyer",
        &format!("+2376{}", &Uuid::new_v4().simple().to_string()[..8]),
        &backend::features::auth::service::hash_password("0000").unwrap(),
    )
    .await
    .unwrap();

    let p1 = create_product(&pool, "Credit Drink", Decimal::from(1000), "drink")
        .await
        .unwrap();
    set_inventory(&pool, p1.id, 10).await.unwrap();

    let order = backend::features::sales::repository::create_open_order(&pool, Some("Credit Tab"))
        .await
        .unwrap();

    // PUT 3 items
    let put_payload = json!({
        "items": [
            { "product_id": p1.id, "quantity": 3 }
        ]
    });
    let put_resp = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&put_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(put_resp.status(), StatusCode::OK);

    // Settle with credit
    let settle_payload = json!({
        "payment_method": "credit",
        "customer_id": customer.id
    });

    let (app2, _) = test_app_and_pool().await;
    let settle_resp = app2
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/orders/{}/settle", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&settle_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(settle_resp.status(), StatusCode::OK);
    let body = settle_resp.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "completed");
    assert_eq!(json["payment_method"], "credit");
    assert_eq!(json["total_amount"], "3000.00");

    // Inventory decremented from 10 to 7
    let inv = get_inventory(&pool, p1.id).await.unwrap().unwrap();
    assert_eq!(inv.quantity, 7);

    // Credit created in DB
    let credits = backend::features::customers::repository::get_credits_by_customer(&pool, customer.id)
        .await
        .unwrap();
    assert_eq!(credits.len(), 1);
    assert_eq!(credits[0].order_id, order.id);
    assert_eq!(credits[0].amount, Decimal::from(3000));
    assert_eq!(credits[0].status, "unpaid");

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id = $1")
        .bind(order.id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM customers WHERE id = $1")
        .bind(customer.id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(p1.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_post_settle_order_credit_missing_or_invalid_customer_returns_400() {
    let (app, pool) = test_app_and_pool().await;

    let p1 = create_product(&pool, "Tab Drink X", Decimal::from(500), "drink")
        .await
        .unwrap();
    set_inventory(&pool, p1.id, 10).await.unwrap();

    let order = backend::features::sales::repository::create_open_order(&pool, Some("Bad Customer Tab"))
        .await
        .unwrap();

    let put_payload = json!({
        "items": [{ "product_id": p1.id, "quantity": 1 }]
    });
    let _ = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&put_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // 1. Missing customer_id
    let (app2, _) = test_app_and_pool().await;
    let res1 = app2
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/orders/{}/settle", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({ "payment_method": "credit" })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res1.status(), StatusCode::BAD_REQUEST);

    // 2. Nonexistent customer_id
    let (app3, _) = test_app_and_pool().await;
    let res2 = app3
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/orders/{}/settle", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "payment_method": "credit",
                    "customer_id": Uuid::new_v4()
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res2.status(), StatusCode::BAD_REQUEST);

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id = $1")
        .bind(order.id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(p1.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_settle_order_validation_rules() {
    let (app, pool) = test_app_and_pool().await;

    let p1 = create_product(&pool, "Stock Valid Item", Decimal::from(1000), "drink")
        .await
        .unwrap();
    set_inventory(&pool, p1.id, 2).await.unwrap();

    let order = backend::features::sales::repository::create_open_order(&pool, Some("Validation Tab"))
        .await
        .unwrap();

    // 1. Settle empty tab returns 400
    let res_empty = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/orders/{}/settle", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({ "payment_method": "cash" })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_empty.status(), StatusCode::BAD_REQUEST);

    // 2. Add 5 items when only 2 available
    let (app2, _) = test_app_and_pool().await;
    let _ = app2
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [{ "product_id": p1.id, "quantity": 5 }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Settle with insufficient stock returns 400 and rolls back
    let (app3, _) = test_app_and_pool().await;
    let res_stock = app3
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/orders/{}/settle", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({ "payment_method": "card" })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_stock.status(), StatusCode::BAD_REQUEST);

    let inv = get_inventory(&pool, p1.id).await.unwrap().unwrap();
    assert_eq!(inv.quantity, 2, "Inventory must remain 2 after failed settlement");

    // Fix inventory to 10
    set_inventory(&pool, p1.id, 10).await.unwrap();

    // Settle successfully with cash
    let (app4, _) = test_app_and_pool().await;
    let res_ok = app4
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/orders/{}/settle", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({ "payment_method": "cash" })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_ok.status(), StatusCode::OK);

    // 3. Settle already completed tab returns 400
    let (app5, _) = test_app_and_pool().await;
    let res_already = app5
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/orders/{}/settle", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({ "payment_method": "cash" })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_already.status(), StatusCode::BAD_REQUEST);

    // 4. PUT items on already completed order returns 400
    let (app6, _) = test_app_and_pool().await;
    let res_put_closed = app6
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/orders/{}/items", order.id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [{ "product_id": p1.id, "quantity": 1 }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_put_closed.status(), StatusCode::BAD_REQUEST);

    // Cleanup
    let _ = sqlx::query("DELETE FROM orders WHERE id = $1")
        .bind(order.id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(p1.id)
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn test_customer_api_endpoints() {
    let (app, pool) = test_app_and_pool().await;

    let phone = format!("+23765{}", &Uuid::new_v4().simple().to_string()[..7]);

    // 1. POST /api/customers creates customer
    let create_payload = json!({
        "name": "Jane Doe",
        "phone_number": phone,
        "pin": "0000"
    });

    let res_create = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/customers")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res_create.status(), StatusCode::CREATED);
    let body = res_create.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert!(json.get("id").is_some());
    let customer_id = Uuid::parse_str(json["id"].as_str().unwrap()).unwrap();
    assert_eq!(json["name"], "Jane Doe");
    assert_eq!(json["phone_number"], phone);

    // 2. Duplicate phone returns 409 Conflict
    let (app2, _) = test_app_and_pool().await;
    let res_dup = app2
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/customers")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&create_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_dup.status(), StatusCode::CONFLICT);

    // 3. Search customer by phone returns 200 with customer
    let (app3, _) = test_app_and_pool().await;
    let res_search = app3
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/customers?phone={}", phone))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_search.status(), StatusCode::OK);
    let search_body = res_search.into_body().collect().await.unwrap().to_bytes();
    let search_json: Value = serde_json::from_slice(&search_body).unwrap();
    assert_eq!(search_json["id"], customer_id.to_string());
    assert_eq!(search_json["phone_number"], phone);

    // 4. Search nonexistent phone returns 200 with null
    let (app4, _) = test_app_and_pool().await;
    let res_missing = app4
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/customers?phone=+237000000000")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_missing.status(), StatusCode::OK);
    let missing_body = res_missing.into_body().collect().await.unwrap().to_bytes();
    let missing_json: Value = serde_json::from_slice(&missing_body).unwrap();
    assert!(missing_json.is_null());

    // Cleanup
    let _ = sqlx::query("DELETE FROM customers WHERE id = $1")
        .bind(customer_id)
        .execute(&pool)
        .await;
}
