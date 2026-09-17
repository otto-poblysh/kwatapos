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
