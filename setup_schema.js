import pg from 'pg';

const connectionString = "postgresql://new_user:StrongPassword123!@103.172.150.31/website";

const schemaSql = `
CREATE TABLE IF NOT EXISTS outlet_master (
    restaurant_id VARCHAR(50) NOT NULL,
    brand_name VARCHAR(100),
    business_entity VARCHAR(100),
    city VARCHAR(100),
    area VARCHAR(100) NOT NULL,
    zone VARCHAR(50),
    PRIMARY KEY (restaurant_id, area)
);

CREATE TABLE IF NOT EXISTS order_reviews (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    restaurant_id VARCHAR(50) NOT NULL,
    area VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    date DATE,
    ordered_time TIMESTAMP WITH TIME ZONE,
    gmv_total NUMERIC(10, 2),
    comments TEXT,
    restaurant_rating INTEGER,
    post_status VARCHAR(50),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_order_item UNIQUE (order_id, restaurant_id, item_name)
);
`;

async function setupSchema() {
  console.log("Connecting to 'website' database to set up tables...");
  const client = new pg.Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected successfully!");
    
    await client.query(schemaSql);
    console.log("Schema tables created successfully (or already exist)!");
  } catch (err) {
    console.error("Schema setup failed:", err.message);
  } finally {
    await client.end();
  }
}

setupSchema();
