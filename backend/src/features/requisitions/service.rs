use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    dto::{
        ConfirmVendorRequest, CreateRequisitionRequest, DeliverRequisitionRequest,
        RequisitionDetailResponse, RequisitionSummaryResponse, ShareRequisitionResponse,
    },
    repository,
};

#[derive(Debug)]
pub enum RequisitionError {
    ValidationError(String),
    NotFound(String),
    InvalidStatus(String),
    Database(sqlx::Error),
}

impl std::fmt::Display for RequisitionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            Self::NotFound(msg) => write!(f, "Not found: {}", msg),
            Self::InvalidStatus(msg) => write!(f, "Invalid status: {}", msg),
            Self::Database(e) => write!(f, "Database error: {}", e),
        }
    }
}

impl std::error::Error for RequisitionError {}


fn rescale_2(mut d: Decimal) -> Decimal {
    d.rescale(2);
    d
}

pub async fn create_requisition(
    pool: &PgPool,
    req: CreateRequisitionRequest,
) -> Result<RequisitionDetailResponse, RequisitionError> {
    let raw_title = req.title.as_deref().unwrap_or("").trim();
    let title = if raw_title.is_empty() {
        "Stock Requisition"
    } else {
        raw_title
    };

    if req.items.is_empty() {
        return Err(RequisitionError::ValidationError(
            "At least one item is required".to_string(),
        ));
    }

    for item in &req.items {
        if item.quantity <= 0 {
            return Err(RequisitionError::ValidationError(
                "Quantity must be greater than 0".to_string(),
            ));
        }
        if item.expected_price < Decimal::ZERO {
            return Err(RequisitionError::ValidationError(
                "Expected price cannot be negative".to_string(),
            ));
        }
    }

    // Verify products exist
    for item in &req.items {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)",
        )
        .bind(item.product_id)
        .fetch_one(pool)
        .await
        .map_err(RequisitionError::Database)?;

        if !exists {
            return Err(RequisitionError::ValidationError(
                "Product not found".to_string(),
            ));
        }
    }

    let mut tx = pool.begin().await.map_err(RequisitionError::Database)?;

    let requisition = repository::create_requisition_tx(&mut tx, title)
        .await
        .map_err(RequisitionError::Database)?;

    for item in &req.items {
        repository::add_requisition_item_tx(
            &mut tx,
            requisition.id,
            item.product_id,
            item.quantity,
            rescale_2(item.expected_price),
        )
        .await
        .map_err(RequisitionError::Database)?;
    }

    let items = repository::get_requisition_items_tx(&mut tx, requisition.id)
        .await
        .map_err(RequisitionError::Database)?;

    tx.commit().await.map_err(RequisitionError::Database)?;

    Ok(RequisitionDetailResponse {
        id: requisition.id,
        token: requisition.token,
        title: requisition.title,
        status: requisition.status,
        items,
        created_at: requisition.created_at,
        updated_at: requisition.updated_at,
    })
}

pub async fn get_requisitions(
    pool: &PgPool,
) -> Result<Vec<RequisitionSummaryResponse>, RequisitionError> {
    let summaries = repository::get_requisition_summaries(pool)
        .await
        .map_err(RequisitionError::Database)?;

    Ok(summaries
        .into_iter()
        .map(|s| RequisitionSummaryResponse {
            id: s.id,
            token: s.token,
            title: s.title,
            status: s.status,
            item_count: s.item_count,
            total_estimated_cost: rescale_2(s.total_estimated_cost),
            created_at: s.created_at,
            updated_at: s.updated_at,
        })
        .collect())
}

pub async fn get_requisition_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<RequisitionDetailResponse, RequisitionError> {
    let requisition = repository::get_requisition_by_id(pool, id)
        .await
        .map_err(RequisitionError::Database)?
        .ok_or_else(|| RequisitionError::NotFound(format!("Requisition {id} not found")))?;

    let items = repository::get_requisition_items(pool, id)
        .await
        .map_err(RequisitionError::Database)?;

    Ok(RequisitionDetailResponse {
        id: requisition.id,
        token: requisition.token,
        title: requisition.title,
        status: requisition.status,
        items,
        created_at: requisition.created_at,
        updated_at: requisition.updated_at,
    })
}

pub async fn share_requisition(
    pool: &PgPool,
    id: Uuid,
) -> Result<ShareRequisitionResponse, RequisitionError> {
    let mut tx = pool.begin().await.map_err(RequisitionError::Database)?;

    let _existing = repository::get_requisition_by_id_tx(&mut tx, id)
        .await
        .map_err(RequisitionError::Database)?
        .ok_or_else(|| RequisitionError::NotFound(format!("Requisition {id} not found")))?;

    let updated = repository::update_requisition_status_tx(&mut tx, id, "sent")
        .await
        .map_err(RequisitionError::Database)?;

    tx.commit().await.map_err(RequisitionError::Database)?;

    let base_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:3011".to_string());
    let share_url = format!("{}/public/vendor/{}", base_url.trim_end_matches('/'), updated.token);

    Ok(ShareRequisitionResponse {
        id: updated.id,
        token: updated.token,
        status: updated.status,
        share_url,
    })
}

pub async fn deliver_requisition(
    pool: &PgPool,
    id: Uuid,
    req: DeliverRequisitionRequest,
) -> Result<RequisitionDetailResponse, RequisitionError> {
    let mut tx = pool.begin().await.map_err(RequisitionError::Database)?;

    let existing = repository::get_requisition_by_id_tx(&mut tx, id)
        .await
        .map_err(RequisitionError::Database)?
        .ok_or_else(|| RequisitionError::NotFound(format!("Requisition {id} not found")))?;

    if existing.status != "sent" && existing.status != "accepted" && existing.status != "partial_delivery" {
        return Err(RequisitionError::InvalidStatus(format!(
            "Cannot deliver requisition in '{}' status. Expected 'sent' or 'accepted'",
            existing.status
        )));
    }

    if req.items.is_empty() {
        return Err(RequisitionError::ValidationError(
            "At least one item is required in delivery".to_string(),
        ));
    }

    let existing_items = repository::get_requisition_items_tx(&mut tx, id)
        .await
        .map_err(RequisitionError::Database)?;

    for item in &req.items {
        if item.received_quantity < 0 {
            return Err(RequisitionError::ValidationError(
                "Received quantity cannot be negative".to_string(),
            ));
        }

        let item_detail = existing_items
            .iter()
            .find(|i| i.id == item.item_id)
            .ok_or_else(|| {
                RequisitionError::ValidationError(format!(
                    "Item {} not found in requisition",
                    item.item_id
                ))
            })?;

        repository::update_item_received_quantity_tx(
            &mut tx,
            item.item_id,
            item.received_quantity,
        )
        .await
        .map_err(RequisitionError::Database)?;

        repository::increment_inventory_tx(&mut tx, item_detail.product_id, item.received_quantity)
            .await
            .map_err(RequisitionError::Database)?;
    }

    let updated_items = repository::get_requisition_items_tx(&mut tx, id)
        .await
        .map_err(RequisitionError::Database)?;

    let all_delivered = updated_items
        .iter()
        .all(|i| i.received_quantity.unwrap_or(0) >= i.quantity);

    let next_status = if all_delivered {
        "delivered"
    } else {
        "partial_delivery"
    };

    let updated_req = repository::update_requisition_status_tx(&mut tx, id, next_status)
        .await
        .map_err(RequisitionError::Database)?;

    tx.commit().await.map_err(RequisitionError::Database)?;

    Ok(RequisitionDetailResponse {
        id: updated_req.id,
        token: updated_req.token,
        title: updated_req.title,
        status: updated_req.status,
        items: updated_items,
        created_at: updated_req.created_at,
        updated_at: updated_req.updated_at,
    })
}

pub async fn pay_requisition(
    pool: &PgPool,
    id: Uuid,
) -> Result<RequisitionDetailResponse, RequisitionError> {
    let mut tx = pool.begin().await.map_err(RequisitionError::Database)?;

    let _existing = repository::get_requisition_by_id_tx(&mut tx, id)
        .await
        .map_err(RequisitionError::Database)?
        .ok_or_else(|| RequisitionError::NotFound(format!("Requisition {id} not found")))?;

    let updated = repository::update_requisition_status_tx(&mut tx, id, "paid")
        .await
        .map_err(RequisitionError::Database)?;

    let items = repository::get_requisition_items_tx(&mut tx, id)
        .await
        .map_err(RequisitionError::Database)?;

    tx.commit().await.map_err(RequisitionError::Database)?;

    Ok(RequisitionDetailResponse {
        id: updated.id,
        token: updated.token,
        title: updated.title,
        status: updated.status,
        items,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
    })
}

pub async fn get_public_requisition(
    pool: &PgPool,
    token: Uuid,
) -> Result<RequisitionDetailResponse, RequisitionError> {
    let requisition = repository::get_requisition_by_token(pool, token)
        .await
        .map_err(RequisitionError::Database)?
        .ok_or_else(|| RequisitionError::NotFound(format!("Requisition token {token} not found")))?;

    let items = repository::get_requisition_items(pool, requisition.id)
        .await
        .map_err(RequisitionError::Database)?;

    Ok(RequisitionDetailResponse {
        id: requisition.id,
        token: requisition.token,
        title: requisition.title,
        status: requisition.status,
        items,
        created_at: requisition.created_at,
        updated_at: requisition.updated_at,
    })
}

pub async fn confirm_public_requisition(
    pool: &PgPool,
    token: Uuid,
    req: ConfirmVendorRequest,
) -> Result<RequisitionDetailResponse, RequisitionError> {
    let mut tx = pool.begin().await.map_err(RequisitionError::Database)?;

    let requisition = repository::get_requisition_by_token_tx(&mut tx, token)
        .await
        .map_err(RequisitionError::Database)?
        .ok_or_else(|| RequisitionError::NotFound(format!("Requisition token {token} not found")))?;

    if req.items.is_empty() {
        return Err(RequisitionError::ValidationError(
            "At least one confirmed price item is required".to_string(),
        ));
    }

    let existing_items = repository::get_requisition_items_tx(&mut tx, requisition.id)
        .await
        .map_err(RequisitionError::Database)?;

    for item in &req.items {
        if item.confirmed_price < Decimal::ZERO {
            return Err(RequisitionError::ValidationError(
                "Confirmed price cannot be negative".to_string(),
            ));
        }

        if !existing_items.iter().any(|i| i.id == item.item_id) {
            return Err(RequisitionError::ValidationError(format!(
                "Item {} not found in requisition",
                item.item_id
            )));
        }

        repository::update_item_confirmed_price_tx(
            &mut tx,
            item.item_id,
            rescale_2(item.confirmed_price),
        )
        .await
        .map_err(RequisitionError::Database)?;
    }

    let updated_req = repository::update_requisition_status_tx(&mut tx, requisition.id, "accepted")
        .await
        .map_err(RequisitionError::Database)?;

    let updated_items = repository::get_requisition_items_tx(&mut tx, requisition.id)
        .await
        .map_err(RequisitionError::Database)?;

    tx.commit().await.map_err(RequisitionError::Database)?;

    Ok(RequisitionDetailResponse {
        id: updated_req.id,
        token: updated_req.token,
        title: updated_req.title,
        status: updated_req.status,
        items: updated_items,
        created_at: updated_req.created_at,
        updated_at: updated_req.updated_at,
    })
}
