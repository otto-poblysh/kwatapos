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
