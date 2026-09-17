use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::dto::{
    AdminCustomerResponse, AdminProductResponse, PermissionResponse, RoleResponse, UserDetailResponse,
    UserPermissionEntry, UserSummary,
};

#[derive(Debug, Clone, FromRow)]
struct PermissionRow {
    id: Uuid,
    name: String,
    description: String,
}

#[derive(Debug, Clone, FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
struct RoleNameRow {
    name: String,
}

pub async fn user_has_permission(
    pool: &PgPool,
    user_id: Uuid,
    permission: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        r#"
        WITH inherited AS (
            SELECT p.name
            FROM users u
            JOIN role_permissions rp ON rp.role_name = u.role
            JOIN permissions p ON p.id = rp.permission_id
            WHERE u.id = $1
        ),
        overrides AS (
            SELECT p.name, up.is_granted
            FROM user_permissions up
            JOIN permissions p ON p.id = up.permission_id
            WHERE up.user_id = $1
        ),
        effective AS (
            SELECT i.name
            FROM inherited i
            WHERE NOT EXISTS (
                SELECT 1 FROM overrides o WHERE o.name = i.name AND o.is_granted = FALSE
            )
            UNION
            SELECT o.name FROM overrides o WHERE o.is_granted = TRUE
        )
        SELECT EXISTS (
            SELECT 1 FROM effective e
            WHERE e.name = $2
               OR ($2 IN ('catalog.read', 'catalog.update') AND e.name = 'catalog.manage')
        )
        "#,
    )
    .bind(user_id)
    .bind(permission)
    .fetch_one(pool)
    .await
}

pub async fn list_permissions(pool: &PgPool) -> Result<Vec<PermissionResponse>, sqlx::Error> {
    let rows = sqlx::query_as::<_, PermissionRow>(
        "SELECT id, name, description FROM permissions ORDER BY name ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| PermissionResponse {
            id: r.id,
            name: r.name,
            description: r.description,
        })
        .collect())
}

pub async fn list_users(pool: &PgPool) -> Result<Vec<UserSummary>, sqlx::Error> {
    let rows = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, role, created_at FROM users ORDER BY email ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| UserSummary {
            id: r.id,
            email: r.email,
            role: r.role,
            created_at: r.created_at,
        })
        .collect())
}

pub async fn find_user(pool: &PgPool, id: Uuid) -> Result<Option<UserRow>, sqlx::Error> {
    sqlx::query_as::<_, UserRow>(
        "SELECT id, email, role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn create_user(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
    role: &str,
) -> Result<UserSummary, sqlx::Error> {
    let row = sqlx::query_as::<_, UserRow>(
        "INSERT INTO users (email, password_hash, role) \
         VALUES ($1, $2, $3) \
         RETURNING id, email, role, created_at",
    )
    .bind(email)
    .bind(password_hash)
    .bind(role)
    .fetch_one(pool)
    .await?;
    Ok(UserSummary {
        id: row.id,
        email: row.email,
        role: row.role,
        created_at: row.created_at,
    })
}

pub async fn update_user(
    pool: &PgPool,
    id: Uuid,
    email: &str,
    password_hash: Option<&str>,
    role: &str,
) -> Result<Option<UserSummary>, sqlx::Error> {
    let row = if let Some(hash) = password_hash {
        sqlx::query_as::<_, UserRow>(
            "UPDATE users SET email = $1, password_hash = $2, role = $3 \
             WHERE id = $4 \
             RETURNING id, email, role, created_at",
        )
        .bind(email)
        .bind(hash)
        .bind(role)
        .bind(id)
        .fetch_optional(pool)
        .await?
    } else {
        sqlx::query_as::<_, UserRow>(
            "UPDATE users SET email = $1, role = $2 \
             WHERE id = $3 \
             RETURNING id, email, role, created_at",
        )
        .bind(email)
        .bind(role)
        .bind(id)
        .fetch_optional(pool)
        .await?
    };
    Ok(row.map(|r| UserSummary {
        id: r.id,
        email: r.email,
        role: r.role,
        created_at: r.created_at,
    }))
}

pub async fn delete_user(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn role_exists(pool: &PgPool, name: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM roles WHERE name = $1)")
        .bind(name)
        .fetch_one(pool)
        .await
}

pub async fn count_admins(pool: &PgPool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        .fetch_one(pool)
        .await
}

pub async fn user_permission_matrix(
    pool: &PgPool,
    user: &UserSummary,
) -> Result<Vec<UserPermissionEntry>, sqlx::Error> {
    #[derive(FromRow)]
    struct MatrixRow {
        id: Uuid,
        name: String,
        description: String,
        inherited: bool,
        override_granted: Option<bool>,
    }

    let rows = sqlx::query_as::<_, MatrixRow>(
        r#"
        SELECT
            p.id,
            p.name,
            p.description,
            EXISTS (
                SELECT 1 FROM role_permissions rp
                WHERE rp.role_name = $2 AND rp.permission_id = p.id
            ) AS inherited,
            up.is_granted AS override_granted
        FROM permissions p
        LEFT JOIN user_permissions up
            ON up.permission_id = p.id AND up.user_id = $1
        ORDER BY p.name ASC
        "#,
    )
    .bind(user.id)
    .bind(&user.role)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let (source, is_effective) = match r.override_granted {
                Some(true) => ("grant".to_string(), true),
                Some(false) => ("deny".to_string(), false),
                None => ("role".to_string(), r.inherited),
            };
            UserPermissionEntry {
                id: r.id,
                name: r.name,
                description: r.description,
                source,
                is_effective,
            }
        })
        .collect())
}

pub async fn user_detail(pool: &PgPool, id: Uuid) -> Result<Option<UserDetailResponse>, sqlx::Error> {
    let Some(row) = find_user(pool, id).await? else {
        return Ok(None);
    };
    let summary = UserSummary {
        id: row.id,
        email: row.email,
        role: row.role,
        created_at: row.created_at,
    };
    let permissions = user_permission_matrix(pool, &summary).await?;
    Ok(Some(UserDetailResponse {
        id: summary.id,
        email: summary.email,
        role: summary.role,
        created_at: summary.created_at,
        permissions,
    }))
}

pub async fn set_user_permission(
    pool: &PgPool,
    user_id: Uuid,
    permission_name: &str,
    is_granted: bool,
) -> Result<Option<()>, sqlx::Error> {
    let permission_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM permissions WHERE name = $1")
            .bind(permission_name)
            .fetch_optional(pool)
            .await?;
    let Some(permission_id) = permission_id else {
        return Ok(None);
    };
    sqlx::query(
        "INSERT INTO user_permissions (user_id, permission_id, is_granted) \
         VALUES ($1, $2, $3) \
         ON CONFLICT (user_id, permission_id) \
         DO UPDATE SET is_granted = EXCLUDED.is_granted",
    )
    .bind(user_id)
    .bind(permission_id)
    .bind(is_granted)
    .execute(pool)
    .await?;
    Ok(Some(()))
}

pub async fn clear_user_permission(
    pool: &PgPool,
    user_id: Uuid,
    permission_name: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM user_permissions up \
         USING permissions p \
         WHERE up.permission_id = p.id AND up.user_id = $1 AND p.name = $2",
    )
    .bind(user_id)
    .bind(permission_name)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn list_roles(pool: &PgPool) -> Result<Vec<RoleResponse>, sqlx::Error> {
    let roles = sqlx::query_as::<_, RoleNameRow>("SELECT name FROM roles ORDER BY name ASC")
        .fetch_all(pool)
        .await?;
    let mut out = Vec::with_capacity(roles.len());
    for role in roles {
        out.push(load_role(pool, &role.name).await?.expect("role vanished"));
    }
    Ok(out)
}

pub async fn load_role(pool: &PgPool, name: &str) -> Result<Option<RoleResponse>, sqlx::Error> {
    let exists = role_exists(pool, name).await?;
    if !exists {
        return Ok(None);
    }
    let permissions = sqlx::query_scalar::<_, String>(
        "SELECT p.name FROM role_permissions rp \
         JOIN permissions p ON p.id = rp.permission_id \
         WHERE rp.role_name = $1 ORDER BY p.name ASC",
    )
    .bind(name)
    .fetch_all(pool)
    .await?;
    Ok(Some(RoleResponse {
        name: name.to_string(),
        permissions,
    }))
}

pub async fn create_role_tx(
    tx: &mut Transaction<'_, Postgres>,
    name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO roles (name) VALUES ($1)")
        .bind(name)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn replace_role_permissions_tx(
    tx: &mut Transaction<'_, Postgres>,
    role_name: &str,
    permission_names: &[String],
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM role_permissions WHERE role_name = $1")
        .bind(role_name)
        .execute(&mut **tx)
        .await?;
    for perm in permission_names {
        let inserted = sqlx::query(
            "INSERT INTO role_permissions (role_name, permission_id) \
             SELECT $1, id FROM permissions WHERE name = $2",
        )
        .bind(role_name)
        .bind(perm)
        .execute(&mut **tx)
        .await?;
        if inserted.rows_affected() == 0 {
            return Err(sqlx::Error::Protocol(format!(
                "unknown permission: {perm}"
            )));
        }
    }
    Ok(())
}

pub async fn delete_role(pool: &PgPool, name: &str) -> Result<u64, sqlx::Error> {
    let result = sqlx::query("DELETE FROM roles WHERE name = $1")
        .bind(name)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

pub async fn list_admin_products(pool: &PgPool) -> Result<Vec<AdminProductResponse>, sqlx::Error> {
    sqlx::query_as::<_, AdminProductResponse>(
        "SELECT p.id, p.name, p.price, p.category, COALESCE(i.quantity, 0) AS stock_quantity, p.created_at \
         FROM products p \
         LEFT JOIN inventory i ON i.product_id = p.id \
         ORDER BY p.name ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_admin_product(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<AdminProductResponse>, sqlx::Error> {
    sqlx::query_as::<_, AdminProductResponse>(
        "SELECT p.id, p.name, p.price, p.category, COALESCE(i.quantity, 0) AS stock_quantity, p.created_at \
         FROM products p \
         LEFT JOIN inventory i ON i.product_id = p.id \
         WHERE p.id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn create_admin_product(
    pool: &PgPool,
    name: &str,
    price: Decimal,
    category: &str,
    stock_quantity: i32,
) -> Result<AdminProductResponse, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let product = sqlx::query_as::<_, (Uuid, String, Decimal, String, DateTime<Utc>)>(
        "INSERT INTO products (name, price, category) \
         VALUES ($1, $2, $3) \
         RETURNING id, name, price, category, created_at",
    )
    .bind(name)
    .bind(price)
    .bind(category)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO inventory (product_id, quantity) VALUES ($1, $2)",
    )
    .bind(product.0)
    .bind(stock_quantity)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(AdminProductResponse {
        id: product.0,
        name: product.1,
        price: product.2,
        category: product.3,
        stock_quantity,
        created_at: product.4,
    })
}

pub async fn update_admin_product(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    price: Decimal,
    category: &str,
    stock_quantity: i32,
) -> Result<Option<AdminProductResponse>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let updated = sqlx::query_as::<_, (Uuid, String, Decimal, String, DateTime<Utc>)>(
        "UPDATE products SET name = $1, price = $2, category = $3 \
         WHERE id = $4 \
         RETURNING id, name, price, category, created_at",
    )
    .bind(name)
    .bind(price)
    .bind(category)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(product) = updated else {
        return Ok(None);
    };
    sqlx::query(
        "INSERT INTO inventory (product_id, quantity) \
         VALUES ($1, $2) \
         ON CONFLICT (product_id) \
         DO UPDATE SET quantity = $2, updated_at = NOW()",
    )
    .bind(id)
    .bind(stock_quantity)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Some(AdminProductResponse {
        id: product.0,
        name: product.1,
        price: product.2,
        category: product.3,
        stock_quantity,
        created_at: product.4,
    }))
}

pub async fn delete_admin_product(pool: &PgPool, id: Uuid) -> Result<u64, sqlx::Error> {
    let result = sqlx::query("DELETE FROM products WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

pub async fn list_admin_customers(
    pool: &PgPool,
) -> Result<Vec<AdminCustomerResponse>, sqlx::Error> {
    sqlx::query_as::<_, AdminCustomerResponse>(
        "SELECT c.id, c.name, c.phone_number, c.created_at, \
                COALESCE(SUM(cr.amount) FILTER (WHERE cr.status = 'unpaid'), 0) AS outstanding_balance \
         FROM customers c \
         LEFT JOIN credits cr ON cr.customer_id = c.id \
         GROUP BY c.id \
         ORDER BY c.name ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_admin_customer(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<AdminCustomerResponse>, sqlx::Error> {
    sqlx::query_as::<_, AdminCustomerResponse>(
        "SELECT c.id, c.name, c.phone_number, c.created_at, \
                COALESCE(SUM(cr.amount) FILTER (WHERE cr.status = 'unpaid'), 0) AS outstanding_balance \
         FROM customers c \
         LEFT JOIN credits cr ON cr.customer_id = c.id \
         WHERE c.id = $1 \
         GROUP BY c.id",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn update_admin_customer(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    phone_number: &str,
    pin_hash: Option<&str>,
) -> Result<Option<AdminCustomerResponse>, sqlx::Error> {
    let updated = if let Some(hash) = pin_hash {
        sqlx::query(
            "UPDATE customers SET name = $1, phone_number = $2, pin_hash = $3 WHERE id = $4",
        )
        .bind(name)
        .bind(phone_number)
        .bind(hash)
        .bind(id)
        .execute(pool)
        .await?
    } else {
        sqlx::query("UPDATE customers SET name = $1, phone_number = $2 WHERE id = $3")
            .bind(name)
            .bind(phone_number)
            .bind(id)
            .execute(pool)
            .await?
    };
    if updated.rows_affected() == 0 {
        return Ok(None);
    }
    get_admin_customer(pool, id).await
}

pub async fn delete_admin_customer(pool: &PgPool, id: Uuid) -> Result<u64, sqlx::Error> {
    let result = sqlx::query("DELETE FROM customers WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}
