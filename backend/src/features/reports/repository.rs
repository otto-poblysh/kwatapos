use rust_decimal::Decimal;
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow)]
pub struct DailyReportRow {
    pub date: String,
    pub payment_method: Option<String>,
    pub sales_total: Decimal,
    pub direct_expenses: Decimal,
}

pub async fn load_daily_report(pool: &PgPool) -> Result<Vec<DailyReportRow>, sqlx::Error> {
    sqlx::query_as::<_, DailyReportRow>(
        "WITH bounds AS ( \
             SELECT date_trunc('day', NOW()) AS day_start, \
                    date_trunc('day', NOW()) + INTERVAL '1 day' AS day_end, \
                    CURRENT_DATE::text AS report_date \
         ), expenses AS ( \
             SELECT COALESCE(SUM(e.amount), 0) AS total \
             FROM direct_expenses e \
             CROSS JOIN bounds b \
             WHERE e.status IN ('approved', 'receipt_uploaded') \
               AND e.updated_at >= b.day_start \
               AND e.updated_at < b.day_end \
         ), sales AS ( \
             SELECT o.payment_method, SUM(o.total_amount) AS total \
             FROM orders o \
             CROSS JOIN bounds b \
             WHERE o.status = 'completed' \
               AND o.updated_at >= b.day_start \
               AND o.updated_at < b.day_end \
             GROUP BY o.payment_method \
         ) \
         SELECT b.report_date AS date, \
                s.payment_method, \
                COALESCE(s.total, 0) AS sales_total, \
                e.total AS direct_expenses \
         FROM bounds b \
         CROSS JOIN expenses e \
         LEFT JOIN sales s ON TRUE",
    )
    .fetch_all(pool)
    .await
}
