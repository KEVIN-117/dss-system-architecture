import pg from 'pg';
import type { SecurityConfig } from '../config/security.js';

const { Pool } = pg;

export class DatabaseClient {
  private pool: pg.Pool;

  constructor(private config: SecurityConfig) {
    this.pool = new Pool({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  /**
   * Comprueba si la base de datos OLTP simulada está disponible
   */
  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const res = await client.query('SELECT current_database() as db, version() as v');
      client.release();
      return !!res.rows[0];
    } catch {
      return false;
    }
  }

  /**
   * Ejecuta un script SQL completo dentro de una transacción
   */
  public async executeTransaction(sqlContent: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cierra el pool de conexiones
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}
