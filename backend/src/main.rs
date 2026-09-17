use backend::app;

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8095").await.unwrap();
    println!("Backend server listening on 8095");
    axum::serve(listener, app()).await.unwrap();
}
