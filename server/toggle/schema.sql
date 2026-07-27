CREATE TABLE IF NOT EXISTS toggle_activity (
  id SERIAL PRIMARY KEY,
  store_name VARCHAR(255),
  store_id VARCHAR(255),
  email VARCHAR(255),
  action VARCHAR(50),
  result VARCHAR(50),
  is_bulk BOOLEAN DEFAULT false,
  bulk_job_id INT,
  error_msg TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bulk_toggle_jobs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50),
  total_stores INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  pending_count INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'RUNNING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS problem_stores (
  id SERIAL PRIMARY KEY,
  store_name VARCHAR(255),
  store_id VARCHAR(255),
  brand VARCHAR(255),
  issue_type VARCHAR(50),
  fail_count INT DEFAULT 1,
  last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT false,
  UNIQUE(store_id, issue_type)
);

CREATE TABLE IF NOT EXISTS api_health (
  brand VARCHAR(255) PRIMARY KEY,
  requests_this_minute INT DEFAULT 0,
  minute_start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  keepalive_status VARCHAR(50) DEFAULT 'STOPPED'
);
