use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    dto::{CreateExpenseRequest, UploadReceiptRequest},
    repository::{self, DirectExpense},
};

#[derive(Debug)]
pub enum ExpenseError {
    ValidationError(String),
    NotFound(String),
    Database(sqlx::Error),
}

impl std::fmt::Display for ExpenseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            Self::NotFound(msg) => write!(f, "Not found: {}", msg),
            Self::Database(e) => write!(f, "Database error: {}", e),
        }
    }
}

impl std::error::Error for ExpenseError {}


fn rescale_2(mut d: Decimal) -> Decimal {
    d.rescale(2);
    d
}

pub async fn create_expense(
    pool: &PgPool,
    req: CreateExpenseRequest,
) -> Result<DirectExpense, ExpenseError> {
    let category = req.category.trim();
    if category.is_empty() {
        return Err(ExpenseError::ValidationError(
            "Category cannot be empty".to_string(),
        ));
    }

    if req.amount < Decimal::ZERO {
        return Err(ExpenseError::ValidationError(
            "Amount cannot be negative".to_string(),
        ));
    }

    if let Some(user_id) = req.requested_by {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)",
        )
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(ExpenseError::Database)?;

        if !exists {
            return Err(ExpenseError::ValidationError("User not found".to_string()));
        }
    }

    let expense = repository::create_expense(
        pool,
        req.requested_by,
        category,
        rescale_2(req.amount),
        req.notes.as_deref(),
    )
    .await
    .map_err(ExpenseError::Database)?;

    Ok(expense)
}

pub async fn get_all_expenses(pool: &PgPool) -> Result<Vec<DirectExpense>, ExpenseError> {
    repository::get_all_expenses(pool)
        .await
        .map_err(ExpenseError::Database)
}

pub async fn approve_expense(
    pool: &PgPool,
    id: Uuid,
) -> Result<DirectExpense, ExpenseError> {
    let existing = repository::get_expense_by_id(pool, id)
        .await
        .map_err(ExpenseError::Database)?
        .ok_or_else(|| ExpenseError::NotFound(format!("Expense {id} not found")))?;

    let updated = repository::update_expense_status(pool, existing.id, "approved")
        .await
        .map_err(ExpenseError::Database)?;

    Ok(updated)
}

pub async fn upload_receipt(
    pool: &PgPool,
    id: Uuid,
    req: UploadReceiptRequest,
) -> Result<DirectExpense, ExpenseError> {
    let receipt_url = req.receipt_image_url.trim();
    if receipt_url.is_empty() {
        return Err(ExpenseError::ValidationError(
            "Receipt image URL cannot be empty".to_string(),
        ));
    }

    let updated = repository::attach_receipt_and_update_status(
        pool,
        id,
        receipt_url,
        "receipt_uploaded",
    )
    .await
    .map_err(ExpenseError::Database)?
    .ok_or_else(|| ExpenseError::NotFound(format!("Expense {id} not found")))?;

    Ok(updated)
}
