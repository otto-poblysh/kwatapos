use rust_decimal::Decimal;
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow)]
pub struct PaymentMethodTotal {
    pub payment_method: Option<String>,
    pub total: Decimal,
}

pub async fn daily_sales_by_payment_method(
    pool: &PgPool,
) -> Result<Vec<PaymentMethodTotal>, sqlx::Error> {
    sqlx::query_as::<_, PaymentMethodTotal>(
        "SELECT payment_method, COALESCE(SUM(total_amount), 0) AS total \
         FROM orders \
         WHERE status = 'completed' \
           AND updated_at >= date_trunc('day', NOW()) \
           AND updated_at < date_trunc('day', NOW()) + INTERVAL '1 day' \
         GROUP BY payment_method",
    )
    .fetch_all(pool)
    .await
}

pub async fn daily_approved_expenses_total(pool: &PgPool) -> Result<Decimal, sqlx::Error> {
    sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) \
         FROM direct_expenses \
         WHERE status IN ('approved', 'receipt_uploaded') \
           AND updated_at >= date_trunc('day', NOW()) \
           AND updated_at < date_trunc('day', NOW()) + INTERVAL '1 day'",
    )
    .fetch_one(pool)
    .await
}

pub async fn current_date(pool: &PgPool) -> Result<String, sqlx::Error> {
    sqlx::query_scalar::<_, String>("SELECT CURRENT_DATE::text")
        .fetch_one(pool)
        .await
}
