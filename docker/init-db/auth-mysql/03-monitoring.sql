-- Monitoring users (first boot only).
--  * exporter          -> prometheus mysqld-exporter
--  * proxysql_monitor  -> ProxySQL health checks (ping / read_only / replication lag)
-- Dev passwords; keep in sync with .env (MYSQL_EXPORTER_PASSWORD) and docker/proxysql/proxysql.cnf.
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED WITH mysql_native_password BY 'exporter_password' WITH MAX_USER_CONNECTIONS 5;
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';

CREATE USER IF NOT EXISTS 'proxysql_monitor'@'%' IDENTIFIED WITH mysql_native_password BY 'monitor_password';
GRANT USAGE, REPLICATION CLIENT ON *.* TO 'proxysql_monitor'@'%';
FLUSH PRIVILEGES;
