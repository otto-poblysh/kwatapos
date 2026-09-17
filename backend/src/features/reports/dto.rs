use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyReportResponse {
    pub date: String,
    pub total_sales: Decimal,
    pub by_payment_method: BTreeMap<String, Decimal>,
    pub credit_issued: Decimal,
    pub direct_expenses: Decimal,
    pub expected_cash_drawer: Decimal,
}
