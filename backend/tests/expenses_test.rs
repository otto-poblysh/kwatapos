use backend::features::expenses::repository::{
    attach_receipt, create_expense, create_expense_tx, get_all_expenses, get_expense_by_id,
    update_expense_status,
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
async fn test_create_and_fetch_expense() {
    let pool = test_pool().await;

    let category = "Cleaning Supplies";
    let amount = Decimal::new(7500, 2); // 75.00
    let notes = Some("Bought detergent and mops");

    let created = create_expense(&pool, None, category, amount, notes)
        .await
        .expect("Failed to create expense");

    assert_eq!(created.category, category);
    assert_eq!(created.amount, amount);
    assert_eq!(created.notes, notes.map(|s| s.to_string()));
    assert_eq!(created.status, "requested");
    assert_eq!(created.requested_by, None);
    assert_eq!(created.receipt_image_url, None);
    assert!(!created.id.is_nil());

    // Fetch by id
    let fetched = get_expense_by_id(&pool, created.id)
        .await
        .expect("Failed to get expense by id");
    assert!(fetched.is_some());
    let exp = fetched.unwrap();
    assert_eq!(exp.id, created.id);
    assert_eq!(exp.category, category);
    assert_eq!(exp.amount, amount);
    assert_eq!(exp.status, "requested");

    // Fetch all
    let all = get_all_expenses(&pool)
        .await
        .expect("Failed to get all expenses");
    assert!(all.iter().any(|e| e.id == created.id));
}

#[tokio::test]
async fn test_expense_with_user_and_fk_nullify_on_delete() {
    let pool = test_pool().await;

    // Create a temporary user
    let user_id: Uuid = sqlx::query_scalar(
        "INSERT INTO users (email, password_hash, role) \
         VALUES ($1, 'hash123', 'sales') \
         RETURNING id",
    )
    .bind(format!("temp_user_{}@kwatapos.com", Uuid::new_v4().simple()))
    .fetch_one(&pool)
    .await
    .expect("Failed to create test user");

    // Create expense requested by this user
    let expense = create_expense(
        &pool,
        Some(user_id),
        "Transportation",
        Decimal::new(1500, 2),
        Some("Taxi fare"),
    )
    .await
    .expect("Failed to create expense");

    assert_eq!(expense.requested_by, Some(user_id));

    // Delete the user
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .expect("Failed to delete user");

    // Check that expense requested_by is now NULL (ON DELETE SET NULL)
    let updated_expense = get_expense_by_id(&pool, expense.id)
        .await
        .expect("Failed to fetch expense")
        .expect("Expense not found");

    assert_eq!(
        updated_expense.requested_by, None,
        "Expense requested_by should be set to NULL after user deletion"
    );
}

#[tokio::test]
async fn test_update_expense_status_and_attach_receipt() {
    let pool = test_pool().await;

    let expense = create_expense(
        &pool,
        None,
        "Maintenance",
        Decimal::new(12000, 2),
        Some("AC repair"),
    )
    .await
    .expect("Failed to create expense");

    // Update status to 'approved'
    let approved = update_expense_status(&pool, expense.id, "approved")
        .await
        .expect("Failed to update status to approved");
    assert_eq!(approved.status, "approved");

    // Attach receipt
    let receipt_url = "https://storage.kwatapos.com/receipts/ac_repair.pdf";
    let with_receipt = attach_receipt(&pool, expense.id, receipt_url)
        .await
        .expect("Failed to attach receipt");
    assert_eq!(with_receipt.receipt_image_url, Some(receipt_url.to_string()));

    // Update status to 'receipt_uploaded'
    let final_exp = update_expense_status(&pool, expense.id, "receipt_uploaded")
        .await
        .expect("Failed to update status to receipt_uploaded");
    assert_eq!(final_exp.status, "receipt_uploaded");
    assert_eq!(final_exp.receipt_image_url, Some(receipt_url.to_string()));
}

#[tokio::test]
async fn test_expense_amount_check_constraint() {
    let pool = test_pool().await;

    let neg_amount = Decimal::new(-500, 2); // -5.00
    let res = create_expense(&pool, None, "Invalid Expense", neg_amount, None).await;

    assert!(
        res.is_err(),
        "Negative amount should violate CHECK constraint (amount >= 0)"
    );
}

#[tokio::test]
async fn test_create_expense_tx_and_rollback() {
    let pool = test_pool().await;

    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    let exp = create_expense_tx(
        &mut tx,
        None,
        "Rollback Category",
        Decimal::new(3000, 2),
        Some("To be rolled back"),
    )
    .await
    .expect("Failed to create expense in transaction");

    tx.rollback().await.expect("Rollback failed");

    let query_res = get_expense_by_id(&pool, exp.id)
        .await
        .expect("Query failed");
    assert!(query_res.is_none(), "Rolled back expense should not exist in database");
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
async fn test_api_create_and_list_expenses() {
    let (app, _pool) = test_app_and_pool().await;

    // 1. Empty category returns 400
    let res_empty_cat = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/expenses")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "category": "   ",
                    "amount": "5000.00"
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_empty_cat.status(), StatusCode::BAD_REQUEST);

    // 2. Negative amount returns 400
    let res_neg_amt = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/expenses")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "category": "Soap",
                    "amount": "-50.00"
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_neg_amt.status(), StatusCode::BAD_REQUEST);

    // 3. Valid creation returns 201
    let res_valid = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/expenses")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "category": "Soap",
                    "amount": "5000.00",
                    "notes": "Cleaning supplies",
                    "requested_by": null
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_valid.status(), StatusCode::CREATED);
    let body = res_valid.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let expense_id = created["id"].as_str().unwrap();
    assert_eq!(created["category"], "Soap");
    assert_eq!(created["amount"], "5000.00");
    assert_eq!(created["status"], "requested");
    assert_eq!(created["notes"], "Cleaning supplies");

    // 4. GET /api/expenses returns 200 with list
    let res_list = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/expenses")
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
        .find(|e| e["id"] == expense_id)
        .expect("Created expense should be in list");
    assert_eq!(found["category"], "Soap");
}

#[tokio::test]
async fn test_api_approve_expense() {
    let (app, _pool) = test_app_and_pool().await;

    // Create expense
    let res_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/expenses")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "category": "Office Paper",
                    "amount": "1200.00"
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_create.status(), StatusCode::CREATED);
    let body = res_create.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let expense_id = created["id"].as_str().unwrap();

    // 1. POST /api/expenses/:id/approve sets status to 'approved'
    let res_approve = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/expenses/{}/approve", expense_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_approve.status(), StatusCode::OK);
    let approve_body = res_approve.into_body().collect().await.unwrap().to_bytes();
    let approve_json: Value = serde_json::from_slice(&approve_body).unwrap();
    assert_eq!(approve_json["status"], "approved");

    // 2. Non-existent returns 404
    let res_404 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/expenses/{}/approve", Uuid::new_v4()))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_404.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_api_upload_receipt_expense() {
    let (app, _pool) = test_app_and_pool().await;

    // Create expense
    let res_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/expenses")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "category": "Printer Ink",
                    "amount": "8000.00"
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    let body = res_create.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let expense_id = created["id"].as_str().unwrap();

    // 1. Empty receipt image url returns 400
    let res_empty = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/expenses/{}/receipt", expense_id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "receipt_image_url": "   "
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_empty.status(), StatusCode::BAD_REQUEST);

    // 2. Attach receipt updates status to 'receipt_uploaded' and sets receipt_image_url
    let receipt_data = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD";
    let res_receipt = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/expenses/{}/receipt", expense_id))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "receipt_image_url": receipt_data
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_receipt.status(), StatusCode::OK);
    let receipt_body = res_receipt.into_body().collect().await.unwrap().to_bytes();
    let receipt_json: Value = serde_json::from_slice(&receipt_body).unwrap();
    assert_eq!(receipt_json["status"], "receipt_uploaded");
    assert_eq!(receipt_json["receipt_image_url"], receipt_data);

    // 3. Non-existent returns 404
    let res_404 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/expenses/{}/receipt", Uuid::new_v4()))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&json!({
                    "receipt_image_url": receipt_data
                })).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res_404.status(), StatusCode::NOT_FOUND);
}

