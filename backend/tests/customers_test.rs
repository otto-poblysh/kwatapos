use backend::features::customers::repository::{
    create_credit_tx, create_customer, find_by_id, find_by_phone, get_credits_by_customer,
};
use backend::features::sales::repository::create_order_tx;
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
async fn test_customer_creation_and_search_by_phone() {
    let pool = test_pool().await;

    let phone = format!("+2376{}", &Uuid::new_v4().simple().to_string()[..8]);
    let name = "Test Customer Alpha";

    // 1. Create customer
    let created = create_customer(&pool, name, &phone)
        .await
        .expect("Failed to create customer");

    assert_eq!(created.name, name);
    assert_eq!(created.phone_number, phone);

    // 2. Find by phone
    let found_by_phone = find_by_phone(&pool, &phone)
        .await
        .expect("Failed to search customer by phone");

    assert!(found_by_phone.is_some());
    let customer = found_by_phone.unwrap();
    assert_eq!(customer.id, created.id);
    assert_eq!(customer.name, name);
    assert_eq!(customer.phone_number, phone);

    // 3. Find by ID
    let found_by_id = find_by_id(&pool, created.id)
        .await
        .expect("Failed to find customer by id");

    assert!(found_by_id.is_some());
    assert_eq!(found_by_id.unwrap(), customer);

    // 4. Non-existent phone returns None
    let missing = find_by_phone(&pool, "+237000000000")
        .await
        .expect("Search non-existent phone failed");
    assert!(missing.is_none());
}

#[tokio::test]
async fn test_customer_phone_and_name_whitespace_trimming() {
    let pool = test_pool().await;

    let raw_phone = format!("+2376{}", &Uuid::new_v4().simple().to_string()[..8]);
    let padded_phone = format!("  {}  \n", raw_phone);
    let padded_name = "   Padded Customer Name \t ";

    let created = create_customer(&pool, &padded_name, &padded_phone)
        .await
        .expect("Failed to create customer with whitespace");

    assert_eq!(created.name, "Padded Customer Name");
    assert_eq!(created.phone_number, raw_phone);

    // Searching with padded phone should also succeed due to trimming
    let query_phone = format!("  {}  ", raw_phone);
    let found = find_by_phone(&pool, &query_phone)
        .await
        .expect("Failed to query customer with padded phone");

    assert!(found.is_some());
    assert_eq!(found.unwrap().id, created.id);

    // Duplicate phone with whitespace should fail unique constraint
    let duplicate_result = create_customer(&pool, "Another Person", &padded_phone).await;
    assert!(
        duplicate_result.is_err(),
        "Expected duplicate phone number to violate unique constraint"
    );
}

#[tokio::test]
async fn test_transactional_credit_creation_and_retrieval() {
    let pool = test_pool().await;

    let phone = format!("+2376{}", &Uuid::new_v4().simple().to_string()[..8]);
    let customer = create_customer(&pool, "Credit Customer", &phone)
        .await
        .expect("Failed to create customer");

    // Create an order in a transaction
    let mut tx = pool.begin().await.expect("Failed to start transaction");
    let amount = Decimal::new(15000, 2); // 150.00
    let order = create_order_tx(&mut tx, None, Some("credit"), amount, "completed")
        .await
        .expect("Failed to create order");

    let credit = create_credit_tx(&mut tx, customer.id, order.id, amount, "unpaid")
        .await
        .expect("Failed to create credit in transaction");

    tx.commit().await.expect("Failed to commit transaction");

    assert_eq!(credit.customer_id, customer.id);
    assert_eq!(credit.order_id, order.id);
    assert_eq!(credit.amount, amount);
    assert_eq!(credit.status, "unpaid");

    // Fetch credits for customer
    let credits = get_credits_by_customer(&pool, customer.id)
        .await
        .expect("Failed to get customer credits");

    assert_eq!(credits.len(), 1);
    assert_eq!(credits[0].id, credit.id);
    assert_eq!(credits[0].amount, amount);
    assert_eq!(credits[0].status, "unpaid");
}

#[tokio::test]
async fn test_credit_negative_amount_fails_check_constraint() {
    let pool = test_pool().await;

    let phone = format!("+2376{}", &Uuid::new_v4().simple().to_string()[..8]);
    let customer = create_customer(&pool, "Negative Test Customer", &phone)
        .await
        .expect("Failed to create customer");

    let mut tx = pool.begin().await.expect("Failed to start transaction");
    let order = create_order_tx(&mut tx, None, Some("credit"), Decimal::ZERO, "completed")
        .await
        .expect("Failed to create order");

    let negative_amount = Decimal::new(-5000, 2); // -50.00
    let credit_result =
        create_credit_tx(&mut tx, customer.id, order.id, negative_amount, "unpaid").await;

    assert!(
        credit_result.is_err(),
        "Expected negative credit amount to violate CHECK constraint"
    );

    tx.rollback().await.expect("Failed to rollback transaction");
}

#[tokio::test]
async fn test_credit_transaction_rollback() {
    let pool = test_pool().await;

    let phone = format!("+2376{}", &Uuid::new_v4().simple().to_string()[..8]);
    let customer = create_customer(&pool, "Rollback Customer", &phone)
        .await
        .expect("Failed to create customer");

    let mut tx = pool.begin().await.expect("Failed to start transaction");
    let amount = Decimal::new(2000, 2);
    let order = create_order_tx(&mut tx, None, Some("credit"), amount, "completed")
        .await
        .expect("Failed to create order");

    create_credit_tx(&mut tx, customer.id, order.id, amount, "unpaid")
        .await
        .expect("Failed to create credit in transaction");

    // Roll back without committing
    tx.rollback().await.expect("Failed to rollback");

    // Query credits outside transaction
    let credits = get_credits_by_customer(&pool, customer.id)
        .await
        .expect("Failed to fetch credits");

    assert!(
        credits.is_empty(),
        "Expected no credits to be persisted after rollback"
    );
}
