use backend::features::inventory::repository::{
    create_product, decrement_inventory, decrement_inventory_tx, get_all_products,
    get_all_products_with_inventory, get_inventory, get_product_by_id, set_inventory,
};
use sqlx::postgres::PgPoolOptions;

#[tokio::test]
async fn test_products_and_inventory_seeded_data() {
    let db_url = backend::database_url();

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations to ensure 0003 and 0004 are applied
    backend::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    // 1. Fetch all products
    let products = get_all_products(&pool)
        .await
        .expect("Failed to get all products");

    assert!(
        products.len() >= 5,
        "Expected at least 5 seeded products, got {}",
        products.len()
    );

    // Verify each expected seeded product exists
    let expected_seeds = vec![
        ("Castel Beer", 650.0, "beer", 50),
        ("Guinness", 1000.0, "beer", 40),
        ("Heineken", 1000.0, "beer", 30),
        ("Roasted Fish (Medium)", 2500.0, "fish", 20),
        ("Roasted Fish (Large)", 4000.0, "fish", 15),
    ];

    for (name, price, category, expected_qty) in expected_seeds {
        let product = products
            .iter()
            .find(|p| p.name == name)
            .unwrap_or_else(|| panic!("Product '{name}' not found in database"));

        assert_eq!(product.price, price, "Price mismatch for {name}");
        assert_eq!(product.category, category, "Category mismatch for {name}");

        // Test get_product_by_id
        let by_id = get_product_by_id(&pool, product.id)
            .await
            .expect("Failed to get product by id")
            .unwrap_or_else(|| panic!("Product by id '{name}' not found"));
        assert_eq!(by_id.id, product.id);
        assert_eq!(by_id.name, product.name);

        // Test get_inventory for seeded item
        let inv = get_inventory(&pool, product.id)
            .await
            .expect("Failed to get inventory")
            .unwrap_or_else(|| panic!("Inventory for '{name}' not found"));

        assert_eq!(
            inv.product_id, product.id,
            "Inventory product_id mismatch for {name}"
        );
        assert_eq!(
            inv.quantity, expected_qty,
            "Initial inventory mismatch for {name}"
        );
    }

    // 2. Test get_all_products_with_inventory
    let products_with_inv = get_all_products_with_inventory(&pool)
        .await
        .expect("Failed to get products with inventory");

    assert!(
        products_with_inv.len() >= 5,
        "Expected products with inventory list to contain at least 5 items"
    );
    let castel = products_with_inv
        .iter()
        .find(|p| p.name == "Castel Beer")
        .expect("Castel Beer not found in joined list");
    assert_eq!(castel.quantity, 50);
}

#[tokio::test]
async fn test_inventory_decrement_and_transactions() {
    let db_url = backend::database_url();

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");

    backend::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    // Create a temporary product for mutation tests to avoid altering seed data
    let test_product = create_product(&pool, "Integration Test Drink", 150.0, "drink")
        .await
        .expect("Failed to create test product");

    // Initialize inventory for the test product
    let initial_inv = set_inventory(&pool, test_product.id, 25)
        .await
        .expect("Failed to set inventory");
    assert_eq!(initial_inv.quantity, 25);

    // Test direct decrement_inventory
    let decremented = decrement_inventory(&pool, test_product.id, 5)
        .await
        .expect("Failed to decrement inventory");
    assert_eq!(decremented.quantity, 20);

    let current_inv = get_inventory(&pool, test_product.id)
        .await
        .expect("Failed to fetch inventory")
        .expect("Inventory should exist");
    assert_eq!(current_inv.quantity, 20);

    // Test decrement_inventory_tx with commit
    let mut tx = pool.begin().await.expect("Failed to begin transaction");
    let tx_decremented = decrement_inventory_tx(&mut tx, test_product.id, 8)
        .await
        .expect("Failed to decrement inventory in tx");
    assert_eq!(tx_decremented.quantity, 12);
    tx.commit().await.expect("Failed to commit transaction");

    let after_tx_commit = get_inventory(&pool, test_product.id)
        .await
        .expect("Failed to fetch inventory")
        .expect("Inventory should exist");
    assert_eq!(after_tx_commit.quantity, 12);

    // Test decrement_inventory_tx with rollback
    let mut rollback_tx = pool.begin().await.expect("Failed to begin transaction");
    let rollback_decremented = decrement_inventory_tx(&mut rollback_tx, test_product.id, 4)
        .await
        .expect("Failed to decrement inventory in tx");
    assert_eq!(rollback_decremented.quantity, 8);
    rollback_tx
        .rollback()
        .await
        .expect("Failed to rollback transaction");

    let after_rollback = get_inventory(&pool, test_product.id)
        .await
        .expect("Failed to fetch inventory")
        .expect("Inventory should exist");
    assert_eq!(
        after_rollback.quantity, 12,
        "Quantity should remain 12 after rollback"
    );

    // Cleanup test product (CASCADE will remove inventory)
    sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(test_product.id)
        .execute(&pool)
        .await
        .expect("Failed to delete test product");

    let cleaned_inv = get_inventory(&pool, test_product.id)
        .await
        .expect("Query failed");
    assert!(
        cleaned_inv.is_none(),
        "Inventory should be cascade-deleted when product is deleted"
    );
}

#[tokio::test]
async fn test_inventory_decrement_underflow_and_validation() {
    let db_url = backend::database_url();

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");

    backend::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    let test_product = create_product(&pool, "Underflow Test Product", 300.0, "test")
        .await
        .expect("Failed to create test product");

    set_inventory(&pool, test_product.id, 10)
        .await
        .expect("Failed to set initial inventory to 10");

    // 1. Decrementing by more than available stock should fail with RowNotFound
    let underflow_result = decrement_inventory(&pool, test_product.id, 15).await;
    match underflow_result {
        Err(sqlx::Error::RowNotFound) => {} // Expected: WHERE quantity >= $1 failed
        other => panic!("Expected RowNotFound for underflow, got: {other:?}"),
    }

    // Inventory must remain unchanged at 10
    let inv_after_underflow = get_inventory(&pool, test_product.id)
        .await
        .expect("Failed to get inventory")
        .expect("Inventory should exist");
    assert_eq!(
        inv_after_underflow.quantity, 10,
        "Inventory quantity should remain unchanged after underflow attempt"
    );

    // 2. Decrementing by zero should fail validation
    let zero_result = decrement_inventory(&pool, test_product.id, 0).await;
    assert!(
        zero_result.is_err(),
        "Expected error when decrementing by zero"
    );

    // 3. Decrementing by negative amount should fail validation
    let neg_result = decrement_inventory(&pool, test_product.id, -5).await;
    assert!(
        neg_result.is_err(),
        "Expected error when decrementing by negative amount"
    );

    // 4. In-transaction underflow should also fail with RowNotFound
    let mut tx = pool.begin().await.expect("Failed to begin tx");
    let tx_underflow_result = decrement_inventory_tx(&mut tx, test_product.id, 20).await;
    match tx_underflow_result {
        Err(sqlx::Error::RowNotFound) => {}
        other => panic!("Expected RowNotFound for tx underflow, got: {other:?}"),
    }
    tx.rollback().await.expect("Failed to rollback tx");

    // Inventory must remain unchanged at 10
    let final_inv = get_inventory(&pool, test_product.id)
        .await
        .expect("Failed to get inventory")
        .expect("Inventory should exist");
    assert_eq!(
        final_inv.quantity, 10,
        "Inventory quantity should remain 10 after all rejected attempts"
    );

    // Cleanup
    sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(test_product.id)
        .execute(&pool)
        .await
        .expect("Failed to delete test product");
}
