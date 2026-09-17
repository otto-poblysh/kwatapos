use backend::{app_with_state, AppState};
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() {
    let db_url = backend::database_url();

    let pool = match PgPoolOptions::new().max_connections(5).connect(&db_url).await {
        Ok(p) => {
            println!("Connected to PostgreSQL database at {}", db_url);
            backend::run_migrations(&p)
                .await
                .expect("Failed to run database migrations");
            Some(p)
        }
        Err(e) => {
            eprintln!("Warning: could not connect to PostgreSQL: {}", e);
            None
        }
    };

    let state = AppState { pool };
    let app = app_with_state(state);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", backend::BACKEND_PORT))
        .await
        .unwrap();
    println!("Backend server listening on {}", backend::BACKEND_PORT);
    println!(
        "Swagger UI available at http://127.0.0.1:{}/swagger-ui/",
        backend::BACKEND_PORT
    );
    axum::serve(listener, app).await.unwrap();
}
