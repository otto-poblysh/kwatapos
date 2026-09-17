use rust_decimal::Decimal;
use sqlx::PgPool;
use std::collections::BTreeMap;

use super::{dto::DailyReportResponse, repository};

#[derive(Debug)]
pub enum ReportError {
    Database(sqlx::Error),
}

impl std::fmt::Display for ReportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Database(e) => write!(f, "Database error: {e}"),
        }
    }
}

impl std::error::Error for ReportError {}

fn zero_methods() -> BTreeMap<String, Decimal> {
    let mut map = BTreeMap::new();
    map.insert("cash".to_string(), Decimal::ZERO);
    map.insert("transfer".to_string(), Decimal::ZERO);
    map.insert("card".to_string(), Decimal::ZERO);
    map.insert("credit".to_string(), Decimal::ZERO);
    map
}

pub async fn get_daily_report(pool: &PgPool) -> Result<DailyReportResponse, ReportError> {
    let date = repository::current_date(pool)
        .await
        .map_err(ReportError::Database)?;
    let rows = repository::daily_sales_by_payment_method(pool)
        .await
        .map_err(ReportError::Database)?;
    let direct_expenses = repository::daily_approved_expenses_total(pool)
        .await
        .map_err(ReportError::Database)?;

    let mut by_payment_method = zero_methods();
    let mut total_sales = Decimal::ZERO;

    for row in rows {
        let method = row
            .payment_method
            .unwrap_or_else(|| "unknown".to_string())
            .to_lowercase();
        let amount = row.total;
        total_sales += amount;
        let entry = by_payment_method.entry(method).or_insert(Decimal::ZERO);
        *entry += amount;
    }

    let cash = *by_payment_method
        .get("cash")
        .unwrap_or(&Decimal::ZERO);
    let credit_issued = *by_payment_method
        .get("credit")
        .unwrap_or(&Decimal::ZERO);
    let expected_cash_drawer = cash - direct_expenses;

    Ok(DailyReportResponse {
        date,
        total_sales,
        by_payment_method,
        credit_issued,
        direct_expenses,
        expected_cash_drawer,
    })
}
