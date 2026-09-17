use backend::features::inventory::repository::create_product;
use backend::features::requisitions::repository::{
    add_requisition_item_tx, create_requisition_tx, get_requisition_by_id,
    get_requisition_by_id_tx, get_requisition_by_token, get_requisition_items,
    get_requisition_items_tx, get_requisitions, increment_inventory_tx,
    update_item_confirmed_price_tx, update_item_received_quantity_tx,
    update_requisition_status_tx,
};
use rust_decimal::Decimal;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

async fn test_pool() -> sqlx::PgPool {
    let db_url = backend::database_url();

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");

    backend::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}

#[tokio::test]
async fn test_create_and_fetch_requisitions() {
    let pool = test_pool().await;

    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    let title = "Weekly Restock Order";
    let created = create_requisition_tx(&mut tx, title)
        .await
        .expect("Failed to create requisition");
    tx.commit().await.expect("Failed to commit transaction");

    assert_eq!(created.title, title);
    assert_eq!(created.status, "draft");
    assert!(!created.id.is_nil());
    assert!(!created.token.is_nil());

    // Fetch by id
    let by_id = get_requisition_by_id(&pool, created.id)
        .await
        .expect("Failed to get requisition by id");
    assert!(by_id.is_some());
    let req = by_id.unwrap();
    assert_eq!(req.id, created.id);
    assert_eq!(req.token, created.token);
    assert_eq!(req.title, title);
    assert_eq!(req.status, "draft");

    // Fetch by token
    let by_token = get_requisition_by_token(&pool, created.token)
        .await
        .expect("Failed to get requisition by token");
    assert!(by_token.is_some());
    assert_eq!(by_token.unwrap().id, created.id);

    // List requisitions
    let all = get_requisitions(&pool)
        .await
        .expect("Failed to get all requisitions");
    assert!(all.iter().any(|r| r.id == created.id));
}

#[tokio::test]
async fn test_requisition_items_lifecycle() {
    let pool = test_pool().await;

    let product_name = format!("Restock Product {}", &Uuid::new_v4().simple().to_string()[..6]);
    let product = create_product(&pool, &product_name, Decimal::new(1500, 2), "Beverages")
        .await
        .expect("Failed to create product");

    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    let requisition = create_requisition_tx(&mut tx, "Beverage Restock")
        .await
        .expect("Failed to create requisition");

    let item_price = Decimal::new(1250, 2); // 12.50
    let item = add_requisition_item_tx(&mut tx, requisition.id, product.id, 50, item_price)
        .await
        .expect("Failed to add requisition item");
    tx.commit().await.expect("Failed to commit transaction");

    assert_eq!(item.requisition_id, requisition.id);
    assert_eq!(item.product_id, product.id);
    assert_eq!(item.quantity, 50);
    assert_eq!(item.expected_price, item_price);
    assert_eq!(item.confirmed_price, None);
    assert_eq!(item.received_quantity, None);

    // Query items with product join
    let items = get_requisition_items(&pool, requisition.id)
        .await
        .expect("Failed to get requisition items");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, item.id);
    assert_eq!(items[0].product_name, product_name);
    assert_eq!(items[0].quantity, 50);
    assert_eq!(items[0].expected_price, item_price);

    // Update confirmed price and received quantity in transaction
    let mut update_tx = pool.begin().await.expect("Failed to begin transaction");
    let tx_req = get_requisition_by_id_tx(&mut update_tx, requisition.id)
        .await
        .expect("Failed to get requisition in tx");
    assert!(tx_req.is_some());

    let tx_items = get_requisition_items_tx(&mut update_tx, requisition.id)
        .await
        .expect("Failed to get items in tx");
    assert_eq!(tx_items.len(), 1);

    let confirmed_price = Decimal::new(1200, 2); // 12.00
    update_item_confirmed_price_tx(&mut update_tx, item.id, confirmed_price)
        .await
        .expect("Failed to update confirmed price");

    update_item_received_quantity_tx(&mut update_tx, item.id, 50)
        .await
        .expect("Failed to update received quantity");
    update_tx.commit().await.expect("Failed to commit updates");

    // Verify persisted updates
    let updated_items = get_requisition_items(&pool, requisition.id)
        .await
        .expect("Failed to query updated items");
    assert_eq!(updated_items[0].confirmed_price, Some(confirmed_price));
    assert_eq!(updated_items[0].received_quantity, Some(50));
}

#[tokio::test]
async fn test_requisition_status_transitions() {
    let pool = test_pool().await;

    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    let requisition = create_requisition_tx(&mut tx, "Status Flow Test")
        .await
        .expect("Failed to create requisition");

    let statuses = ["sent", "accepted", "partial_delivery", "delivered", "paid"];
    for status in statuses {
        let updated = update_requisition_status_tx(&mut tx, requisition.id, status)
            .await
            .expect("Failed to update status");
        assert_eq!(updated.status, status);
    }
    tx.commit().await.expect("Failed to commit status updates");

    let final_state = get_requisition_by_id(&pool, requisition.id)
        .await
        .expect("Failed to get requisition")
        .expect("Requisition not found");
    assert_eq!(final_state.status, "paid");
}

#[tokio::test]
async fn test_requisition_quantity_and_price_constraints() {
    let pool = test_pool().await;

    let product = create_product(&pool, "Constraint Prod", Decimal::new(100, 2), "Test")
        .await
        .expect("Failed to create product");

    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    let req = create_requisition_tx(&mut tx, "Constraints Requisition")
        .await
        .expect("Failed to create requisition");

    // Quantity <= 0 must fail CHECK (quantity > 0)
    let zero_qty_res = add_requisition_item_tx(&mut tx, req.id, product.id, 0, Decimal::new(10, 2)).await;
    assert!(zero_qty_res.is_err(), "Quantity 0 should violate CHECK constraint");

    let neg_qty_res = add_requisition_item_tx(&mut tx, req.id, product.id, -5, Decimal::new(10, 2)).await;
    assert!(neg_qty_res.is_err(), "Quantity -5 should violate CHECK constraint");

    // Expected price < 0 must fail CHECK (expected_price >= 0)
    let neg_price_res = add_requisition_item_tx(&mut tx, req.id, product.id, 5, Decimal::new(-10, 2)).await;
    assert!(neg_price_res.is_err(), "Negative expected_price should violate CHECK constraint");

    tx.rollback().await.expect("Rollback failed");

    // Valid item creation
    let mut tx2 = pool.begin().await.expect("Failed to begin transaction");
    let req2 = create_requisition_tx(&mut tx2, "Constraints Requisition 2")
        .await
        .expect("Failed to create requisition");
    let item = add_requisition_item_tx(&mut tx2, req2.id, product.id, 10, Decimal::new(20, 2))
        .await
        .expect("Failed to create valid item");

    // Negative confirmed price must fail CHECK constraint
    let neg_conf_price = update_item_confirmed_price_tx(&mut tx2, item.id, Decimal::new(-1, 2)).await;
    assert!(neg_conf_price.is_err(), "Negative confirmed_price should violate CHECK constraint");

    // Negative received quantity must fail CHECK constraint
    let neg_recv_qty = update_item_received_quantity_tx(&mut tx2, item.id, -1).await;
    assert!(neg_recv_qty.is_err(), "Negative received_quantity should violate CHECK constraint");

    tx2.rollback().await.expect("Rollback failed");
}

#[tokio::test]
async fn test_requisition_foreign_keys_and_cascade() {
    let pool = test_pool().await;

    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    let req = create_requisition_tx(&mut tx, "FK Requisition")
        .await
        .expect("Failed to create requisition");

    // Non-existent product foreign key error
    let invalid_prod_id = Uuid::new_v4();
    let invalid_prod_res = add_requisition_item_tx(&mut tx, req.id, invalid_prod_id, 5, Decimal::new(10, 2)).await;
    assert!(invalid_prod_res.is_err(), "Non-existent product_id must violate foreign key");

    tx.rollback().await.expect("Rollback failed");

    // Test Cascade Delete
    let product = create_product(&pool, "Cascade Test Prod", Decimal::new(100, 2), "Test")
        .await
        .expect("Failed to create product");

    let mut tx2 = pool.begin().await.expect("Failed to begin transaction");
    let req2 = create_requisition_tx(&mut tx2, "Cascade Requisition")
        .await
        .expect("Failed to create requisition");
    let _item = add_requisition_item_tx(&mut tx2, req2.id, product.id, 10, Decimal::new(20, 2))
        .await
        .expect("Failed to create item");
    tx2.commit().await.expect("Commit failed");

    // Verify item exists
    let items_before = get_requisition_items(&pool, req2.id)
        .await
        .expect("Query failed");
    assert_eq!(items_before.len(), 1);

    // Delete requisition
    sqlx::query("DELETE FROM requisitions WHERE id = $1")
        .bind(req2.id)
        .execute(&pool)
        .await
        .expect("Delete requisition failed");

    // Verify item is cascade deleted
    let items_after = get_requisition_items(&pool, req2.id)
        .await
        .expect("Query failed");
    assert!(items_after.is_empty(), "Requisition items should be cascade deleted");
}

#[tokio::test]
async fn test_increment_inventory_tx() {
    let pool = test_pool().await;

    let product = create_product(&pool, "Stock Prod", Decimal::new(50, 2), "Supplies")
        .await
        .expect("Failed to create product");

    // 1. Initial increment on product with no inventory row yet
    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    increment_inventory_tx(&mut tx, product.id, 10)
        .await
        .expect("Failed to increment initial inventory");
    tx.commit().await.expect("Failed to commit");

    let inv = backend::features::inventory::repository::get_inventory(&pool, product.id)
        .await
        .expect("Failed to get inventory")
        .expect("Inventory not found");
    assert_eq!(inv.quantity, 10);

    // 2. Further increment on existing inventory
    let mut tx2 = pool.begin().await.expect("Failed to begin transaction");
    increment_inventory_tx(&mut tx2, product.id, 25)
        .await
        .expect("Failed to increment inventory again");
    tx2.commit().await.expect("Failed to commit");

    let inv2 = backend::features::inventory::repository::get_inventory(&pool, product.id)
        .await
        .expect("Failed to get inventory")
        .expect("Inventory not found");
    assert_eq!(inv2.quantity, 35);

    // 3. Rollback test
    let mut tx3 = pool.begin().await.expect("Failed to begin transaction");
    increment_inventory_tx(&mut tx3, product.id, 50)
        .await
        .expect("Failed to increment inventory");
    tx3.rollback().await.expect("Rollback failed");

    let inv3 = backend::features::inventory::repository::get_inventory(&pool, product.id)
        .await
        .expect("Failed to get inventory")
        .expect("Inventory not found");
    assert_eq!(inv3.quantity, 35, "Quantity should remain unchanged after rollback");
}

use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

async fn test_app_and_pool() -> (axum::Router, sqlx::PgPool) {
    let pool = test_pool().await;
    let app = backend::app_with_state(backend::AppState {
        pool: Some(pool.clone()),
    });
    (app, pool)
}

#[tokio::test]
async fn test_api_create_requisition_success_and_validation() {
    let (app, pool) = test_app_and_pool().await;

    let product = create_product(&pool, "Req API Product 1", Decimal::new(650, 2), "Beverages")
        .await
        .unwrap();

    // 1. Empty items returns 400
    let res_empty = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Weekly Restock",
                    "items": []
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_empty.status(), StatusCode::BAD_REQUEST);

    // 2. Quantity <= 0 returns 400
    let res_zero_qty = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Weekly Restock",
                    "items": [{ "product_id": product.id, "quantity": 0, "expected_price": "650.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_zero_qty.status(), StatusCode::BAD_REQUEST);

    // 3. Negative expected_price returns 400
    let res_neg_price = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Weekly Restock",
                    "items": [{ "product_id": product.id, "quantity": 10, "expected_price": "-10.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_neg_price.status(), StatusCode::BAD_REQUEST);

    // 4. Non-existent product returns 400
    let res_missing_prod = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Weekly Restock",
                    "items": [{ "product_id": Uuid::new_v4(), "quantity": 10, "expected_price": "650.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_missing_prod.status(), StatusCode::BAD_REQUEST);

    // 5. Empty title defaults to "Stock Requisition" and returns 201
    let res_default_title = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "   ",
                    "items": [{ "product_id": product.id, "quantity": 10, "expected_price": "650.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_default_title.status(), StatusCode::CREATED);
    let body = res_default_title.into_body().collect().await.unwrap().to_bytes();
    let json_val: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json_val["title"], "Stock Requisition");
    assert_eq!(json_val["status"], "draft");
    assert!(!json_val["token"].as_str().unwrap().is_empty());
    assert_eq!(json_val["items"].as_array().unwrap().len(), 1);
    assert_eq!(json_val["items"][0]["product_id"], product.id.to_string());
    assert_eq!(json_val["items"][0]["product_name"], "Req API Product 1");
    assert_eq!(json_val["items"][0]["quantity"], 10);

    // 6. Explicit title returns 201
    let res_valid = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Weekly Restock",
                    "items": [{ "product_id": product.id, "quantity": 10, "expected_price": "650.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_valid.status(), StatusCode::CREATED);
    let body_valid = res_valid.into_body().collect().await.unwrap().to_bytes();
    let json_valid: Value = serde_json::from_slice(&body_valid).unwrap();
    assert_eq!(json_valid["title"], "Weekly Restock");
}

#[tokio::test]
async fn test_api_get_requisitions_list_and_details() {
    let (app, pool) = test_app_and_pool().await;

    let product = create_product(&pool, "Req API Product List", Decimal::new(500, 2), "Supplies")
        .await
        .unwrap();

    // Create requisition
    let res_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "List Restock",
                    "items": [{ "product_id": product.id, "quantity": 4, "expected_price": "500.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_create.status(), StatusCode::CREATED);
    let body = res_create.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let req_id = created["id"].as_str().unwrap();

    // 1. GET /api/requisitions returns 200 with list including item_count and total_estimated_cost
    let res_list = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/requisitions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_list.status(), StatusCode::OK);
    let list_body = res_list.into_body().collect().await.unwrap().to_bytes();
    let list_json: Value = serde_json::from_slice(&list_body).unwrap();
    assert!(list_json.is_array());
    let found = list_json
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == req_id)
        .expect("Created requisition should be in list");
    assert_eq!(found["title"], "List Restock");
    assert_eq!(found["item_count"], 1);
    assert_eq!(found["total_estimated_cost"], "2000.00");

    // 2. GET /api/requisitions/:id returns 200 with details and product name
    let res_details = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/requisitions/{}", req_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_details.status(), StatusCode::OK);
    let details_body = res_details.into_body().collect().await.unwrap().to_bytes();
    let details_json: Value = serde_json::from_slice(&details_body).unwrap();
    assert_eq!(details_json["id"], req_id);
    assert_eq!(details_json["items"][0]["product_name"], "Req API Product List");

    // 3. GET non-existent returns 404
    let res_not_found = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/requisitions/{}", Uuid::new_v4()))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_not_found.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_api_share_requisition() {
    let (app, pool) = test_app_and_pool().await;

    let product = create_product(&pool, "Req Share Product", Decimal::new(200, 2), "Food")
        .await
        .unwrap();

    let res_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Share Test",
                    "items": [{ "product_id": product.id, "quantity": 5, "expected_price": "200.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    let body = res_create.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let req_id = created["id"].as_str().unwrap();
    let token = created["token"].as_str().unwrap();

    // 1. Share requisition transitions to 'sent' and returns share_url
    let res_share = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/share", req_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_share.status(), StatusCode::OK);
    let share_body = res_share.into_body().collect().await.unwrap().to_bytes();
    let share_json: Value = serde_json::from_slice(&share_body).unwrap();
    assert_eq!(share_json["id"], req_id);
    assert_eq!(share_json["token"], token);
    assert_eq!(share_json["status"], "sent");
    assert!(
        share_json["share_url"].as_str().unwrap().contains(token),
        "share_url must contain the token"
    );

    // 2. Non-existent returns 404
    let res_404 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/share", Uuid::new_v4()))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_404.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_api_public_vendor_flow() {
    let (app, pool) = test_app_and_pool().await;

    let product = create_product(&pool, "Req Vendor Product", Decimal::new(650, 2), "Food")
        .await
        .unwrap();

    let res_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Vendor Flow",
                    "items": [{ "product_id": product.id, "quantity": 10, "expected_price": "650.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    let body = res_create.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let token = created["token"].as_str().unwrap();
    let item_id = created["items"][0]["id"].as_str().unwrap();

    // 1. GET /api/public/requisition/:token returns public review data
    let res_pub_get = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/public/requisition/{}", token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_pub_get.status(), StatusCode::OK);
    let pub_get_body = res_pub_get.into_body().collect().await.unwrap().to_bytes();
    let pub_get_json: Value = serde_json::from_slice(&pub_get_body).unwrap();
    assert_eq!(pub_get_json["token"], token);
    assert_eq!(pub_get_json["items"][0]["product_name"], "Req Vendor Product");
    assert_eq!(pub_get_json["items"][0]["quantity"], 10);
    assert_eq!(pub_get_json["items"][0]["expected_price"], "650.00");
    assert_eq!(pub_get_json["items"][0]["confirmed_price"], Value::Null);

    // 2. GET invalid token returns 404
    let res_pub_404 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/public/requisition/{}", Uuid::new_v4()))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_pub_404.status(), StatusCode::NOT_FOUND);

    // 3. POST /api/public/requisition/:token updates confirmed prices and sets status to 'accepted'
    let res_pub_post = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/public/requisition/{}", token))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [{ "item_id": item_id, "confirmed_price": "700.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_pub_post.status(), StatusCode::OK);
    let pub_post_body = res_pub_post.into_body().collect().await.unwrap().to_bytes();
    let pub_post_json: Value = serde_json::from_slice(&pub_post_body).unwrap();
    assert_eq!(pub_post_json["status"], "accepted");
    assert_eq!(pub_post_json["items"][0]["confirmed_price"], "700.00");

    // 4. POST with invalid item returns 400
    let res_invalid_item = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/public/requisition/{}", token))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [{ "item_id": Uuid::new_v4(), "confirmed_price": "700.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_invalid_item.status(), StatusCode::BAD_REQUEST);

    // 5. POST non-existent token returns 404
    let res_post_404 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/public/requisition/{}", Uuid::new_v4()))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [{ "item_id": item_id, "confirmed_price": "700.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_post_404.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_api_deliver_requisition_flow() {
    let (app, pool) = test_app_and_pool().await;

    let p1 = create_product(&pool, "Req Deliver P1", Decimal::new(100, 2), "Beverages")
        .await
        .unwrap();
    let p2 = create_product(&pool, "Req Deliver P2", Decimal::new(200, 2), "Beverages")
        .await
        .unwrap();

    let res_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Deliver Flow",
                    "items": [
                        { "product_id": p1.id, "quantity": 10, "expected_price": "100.00" },
                        { "product_id": p2.id, "quantity": 5, "expected_price": "200.00" }
                    ]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    let body = res_create.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let req_id = created["id"].as_str().unwrap();
    let item1_id = created["items"][0]["id"].as_str().unwrap();
    let item2_id = created["items"][1]["id"].as_str().unwrap();

    // 1. Requisition in 'draft' cannot be delivered (must be sent or accepted)
    let res_draft_deliver = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/deliver", req_id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [
                        { "item_id": item1_id, "received_quantity": 8 },
                        { "item_id": item2_id, "received_quantity": 5 }
                    ]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_draft_deliver.status(), StatusCode::BAD_REQUEST);

    // Share to transition to 'sent'
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/share", req_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // 2. Partial delivery: item1 received 8 (< 10), item2 received 5 (== 5)
    let res_partial = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/deliver", req_id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [
                        { "item_id": item1_id, "received_quantity": 8 },
                        { "item_id": item2_id, "received_quantity": 5 }
                    ]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_partial.status(), StatusCode::OK);
    let partial_body = res_partial.into_body().collect().await.unwrap().to_bytes();
    let partial_json: Value = serde_json::from_slice(&partial_body).unwrap();
    assert_eq!(partial_json["status"], "partial_delivery");

    // Check inventory increased
    let inv1 = backend::features::inventory::repository::get_inventory(&pool, p1.id).await.unwrap().unwrap();
    assert_eq!(inv1.quantity, 8);
    let inv2 = backend::features::inventory::repository::get_inventory(&pool, p2.id).await.unwrap().unwrap();
    assert_eq!(inv2.quantity, 5);

    // 3. Full delivery on remaining (or deliver when all >= quantity):
    // Deliver 10 for item 1, 5 for item 2
    let res_full = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/deliver", req_id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [
                        { "item_id": item1_id, "received_quantity": 10 },
                        { "item_id": item2_id, "received_quantity": 5 }
                    ]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_full.status(), StatusCode::OK);
    let full_body = res_full.into_body().collect().await.unwrap().to_bytes();
    let full_json: Value = serde_json::from_slice(&full_body).unwrap();
    assert_eq!(full_json["status"], "delivered");

    // Inventory incremented by 10 and 5
    let inv1_after = backend::features::inventory::repository::get_inventory(&pool, p1.id).await.unwrap().unwrap();
    assert_eq!(inv1_after.quantity, 18);

    // 4. Deliver on already 'delivered' requisition returns 400
    let res_already_deliv = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/deliver", req_id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [
                        { "item_id": item1_id, "received_quantity": 10 }
                    ]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_already_deliv.status(), StatusCode::BAD_REQUEST);

    // 5. Negative received_quantity returns 400
    // Create another sent requisition
    let res_create2 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Neg Test",
                    "items": [{ "product_id": p1.id, "quantity": 10, "expected_price": "100.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    let body2 = res_create2.into_body().collect().await.unwrap().to_bytes();
    let created2: Value = serde_json::from_slice(&body2).unwrap();
    let req2_id = created2["id"].as_str().unwrap();
    let item_neg_id = created2["items"][0]["id"].as_str().unwrap();
    let _ = app.clone().oneshot(
        Request::builder().method("POST").uri(format!("/api/requisitions/{}/share", req2_id)).body(Body::empty()).unwrap(),
    ).await.unwrap();

    let res_neg_recv = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/deliver", req2_id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [{ "item_id": item_neg_id, "received_quantity": -1 }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_neg_recv.status(), StatusCode::BAD_REQUEST);

    // 6. Deliver non-existent returns 404
    let res_deliv_404 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/deliver", Uuid::new_v4()))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "items": [{ "item_id": item1_id, "received_quantity": 5 }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_deliv_404.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_api_pay_requisition() {
    let (app, pool) = test_app_and_pool().await;

    let p = create_product(&pool, "Req Pay Prod", Decimal::new(150, 2), "Food")
        .await
        .unwrap();

    let res_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/requisitions")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "title": "Pay Test",
                    "items": [{ "product_id": p.id, "quantity": 10, "expected_price": "150.00" }]
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    let body = res_create.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let req_id = created["id"].as_str().unwrap();

    // 1. Pay transitions status to 'paid'
    let res_pay = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/pay", req_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_pay.status(), StatusCode::OK);
    let pay_body = res_pay.into_body().collect().await.unwrap().to_bytes();
    let pay_json: Value = serde_json::from_slice(&pay_body).unwrap();
    assert_eq!(pay_json["status"], "paid");

    // 2. Pay non-existent returns 404
    let res_pay_404 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/requisitions/{}/pay", Uuid::new_v4()))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_pay_404.status(), StatusCode::NOT_FOUND);
}

