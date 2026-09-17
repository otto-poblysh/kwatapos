use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use http_body_util::BodyExt;
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

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

async fn admin_token(app: axum::Router) -> String {
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
    json["access_token"].as_str().unwrap().to_string()
}

async fn fetch_daily_report(app: axum::Router, token: &str) -> (StatusCode, Value) {
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/reports/daily")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = if body.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&body).unwrap_or(Value::Null)
    };
    (status, json)
}

fn money(value: &Value) -> Decimal {
    match value {
        Value::String(s) => s.parse().expect("decimal string"),
        Value::Number(n) => n.to_string().parse().expect("decimal number"),
        other => panic!("expected money value, got {other}"),
    }
}

#[tokio::test]
async fn test_daily_report_requires_admin() {
    let (app, _) = test_app_and_pool().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/reports/daily")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let (app2, _) = test_app_and_pool().await;
    let sales_payload = json!({
        "email": "sales@kwatapos.com",
        "password": "sales123"
    });
    let sales_login = app2
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&sales_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    let sales_body = sales_login.into_body().collect().await.unwrap().to_bytes();
    let sales_json: Value = serde_json::from_slice(&sales_body).unwrap();
    let sales_token = sales_json["access_token"].as_str().unwrap();

    let (app3, _) = test_app_and_pool().await;
    let (status, _) = fetch_daily_report(app3, sales_token).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_daily_report_aggregates_todays_sales_and_expenses() {
    let (app, pool) = test_app_and_pool().await;
    let token = admin_token(app).await;

    let (app_before, _) = test_app_and_pool().await;
    let (status_before, before) = fetch_daily_report(app_before, &token).await;
    assert_eq!(status_before, StatusCode::OK);

    let cash_amount = Decimal::new(11100, 2); // 111.00
    let transfer_amount = Decimal::new(22200, 2); // 222.00
    let card_amount = Decimal::new(33300, 2); // 333.00
    let credit_amount = Decimal::new(44400, 2); // 444.00
    let expense_amount = Decimal::new(5500, 2); // 55.00

    let mut tx = pool.begin().await.expect("Failed to start transaction");
    backend::features::sales::repository::create_order_tx(
        &mut tx,
        Some("Report Cash"),
        Some("cash"),
        cash_amount,
        "completed",
    )
    .await
    .expect("cash order");
    backend::features::sales::repository::create_order_tx(
        &mut tx,
        Some("Report Transfer"),
        Some("transfer"),
        transfer_amount,
        "completed",
    )
    .await
    .expect("transfer order");
    backend::features::sales::repository::create_order_tx(
        &mut tx,
        Some("Report Card"),
        Some("card"),
        card_amount,
        "completed",
    )
    .await
    .expect("card order");
    backend::features::sales::repository::create_order_tx(
        &mut tx,
        Some("Report Credit"),
        Some("credit"),
        credit_amount,
        "completed",
    )
    .await
    .expect("credit order");
    backend::features::sales::repository::create_order_tx(
        &mut tx,
        Some("Open Tab Ignored"),
        None,
        Decimal::new(99999, 2),
        "open",
    )
    .await
    .expect("open order");
    tx.commit().await.expect("commit orders");

    let expense = backend::features::expenses::repository::create_expense(
        &pool,
        None,
        "Report Fuel",
        expense_amount,
        Some("Phase 6 daily report fixture"),
    )
    .await
    .expect("create expense");
    backend::features::expenses::repository::update_expense_status(&pool, expense.id, "approved")
        .await
        .expect("approve expense");

    let (app_after, _) = test_app_and_pool().await;
    let (status_after, after) = fetch_daily_report(app_after, &token).await;
    assert_eq!(status_after, StatusCode::OK);
    assert!(after.get("date").is_some());

    let cash_delta = money(&after["by_payment_method"]["cash"]) - money(&before["by_payment_method"]["cash"]);
    let transfer_delta =
        money(&after["by_payment_method"]["transfer"]) - money(&before["by_payment_method"]["transfer"]);
    let card_delta = money(&after["by_payment_method"]["card"]) - money(&before["by_payment_method"]["card"]);
    let credit_delta =
        money(&after["by_payment_method"]["credit"]) - money(&before["by_payment_method"]["credit"]);
    let expenses_delta = money(&after["direct_expenses"]) - money(&before["direct_expenses"]);
    let sales_delta = money(&after["total_sales"]) - money(&before["total_sales"]);

    assert_eq!(cash_delta, cash_amount);
    assert_eq!(transfer_delta, transfer_amount);
    assert_eq!(card_delta, card_amount);
    assert_eq!(credit_delta, credit_amount);
    assert_eq!(money(&after["credit_issued"]), money(&after["by_payment_method"]["credit"]));
    assert_eq!(expenses_delta, expense_amount);
    assert_eq!(
        sales_delta,
        cash_amount + transfer_amount + card_amount + credit_amount
    );
    assert_eq!(
        money(&after["expected_cash_drawer"]),
        money(&after["by_payment_method"]["cash"]) - money(&after["direct_expenses"])
    );

    let _ = sqlx::query("DELETE FROM direct_expenses WHERE id = $1")
        .bind(expense.id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM orders WHERE order_name LIKE 'Report %' OR order_name = 'Open Tab Ignored'")
        .execute(&pool)
        .await;
}
