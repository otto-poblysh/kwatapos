use backend::features::auth::repository::find_user_by_email;
use sqlx::postgres::PgPoolOptions;

#[tokio::test]
async fn test_find_user_by_email_integration() {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://kwata_admin:kwata_password@127.0.0.1:5432/kwatapos".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");

    // Ensure migrations are run
    backend::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    // Test finding seeded Super Admin
    let user_opt = find_user_by_email(&pool, "admin@kwatapos.com")
        .await
        .expect("Query failed");

    assert!(user_opt.is_some(), "Expected admin@kwatapos.com to exist");
    let user = user_opt.unwrap();
    assert_eq!(user.email, "admin@kwatapos.com");
    assert_eq!(user.role, "admin");
    assert!(!user.password_hash.is_empty());

    // Verify argon2 password verification on the fetched user
    use argon2::{
        password_hash::{PasswordHash, PasswordVerifier},
        Argon2,
    };
    let parsed_hash = PasswordHash::new(&user.password_hash).expect("Invalid password hash format in DB");
    assert!(
        Argon2::default().verify_password(b"admin123", &parsed_hash).is_ok(),
        "Password verification failed for admin123"
    );

    // Test non-existent user returns None
    let missing_user = find_user_by_email(&pool, "nonexistent@example.com")
        .await
        .expect("Query failed");
    assert!(missing_user.is_none(), "Expected nonexistent user to return None");
}
