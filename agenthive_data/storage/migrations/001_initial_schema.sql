-- Operational Relational Schema for AgentHive Data Layer
-- Enforces Multi-Tenancy (tenant_id), Decision Audit Lineage, and Hash Verification

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(32) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS decision_audit_logs (
    log_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    application_id VARCHAR(64) NOT NULL,
    as_of_date TIMESTAMP NOT NULL,
    decision VARCHAR(32) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    feature_vector_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE TABLE IF NOT EXISTS operational_applications (
    application_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    applicant_id VARCHAR(64) NOT NULL,
    application_type VARCHAR(64) NOT NULL,
    requested_amount NUMERIC(12, 2) NOT NULL,
    as_of_date TIMESTAMP NOT NULL,
    status VARCHAR(32) DEFAULT 'received',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_app ON decision_audit_logs (tenant_id, application_id);
CREATE INDEX IF NOT EXISTS idx_app_tenant_as_of ON operational_applications (tenant_id, as_of_date);
