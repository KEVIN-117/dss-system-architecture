-- Disposable integration-fixture role. Production credentials are managed separately.
-- PostgreSQL's local max_connections is 100; reserve no more than 20 for OLAP here.
CREATE ROLE olap_test LOGIN PASSWORD 'olap_test' CONNECTION LIMIT 20;
GRANT CONNECT ON DATABASE dw_integration TO olap_test;
