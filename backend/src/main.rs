use backend::{app_with_state, AppState};
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://kwata_admin:kwata_password@127.0.0.1:5432/kwatapos".to_string());

    let pool = match PgPoolOptions::new().max_connections(5).connect(&db_url).await {
        Ok(p) => {
            println!("Connected to PostgreSQL database at {}", db_url);
            if let Err(e) = backend::run_migrations(&p).await {
                eprintln!("Warning: could not run migrations: {}", e);
            }
            Some(p)
        }
        Err(e) => {
            eprintln!("Warning: could not connect to PostgreSQL: {}", e);
            None
        }
    };

    let state = AppState { pool };
    let app = app_with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8095").await.unwrap();
    println!("Backend server listening on 8095");
    println!("Swagger UI available at http://127.0.0.1:8095/swagger-ui/");
    axum::serve(listener, app).await.unwrap();
}
