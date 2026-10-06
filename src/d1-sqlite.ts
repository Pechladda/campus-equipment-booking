// @ts-nocheck
import { DatabaseSync } from 'node:sqlite'

export function createSqliteD1(dbPath: string = ':memory:'): D1Database {
  const db = new DatabaseSync(dbPath)

  function createPreparedStatement(query: string, params: any[] = []): D1PreparedStatement {
    return {
      bind(...newParams: any[]) {
        return createPreparedStatement(query, newParams)
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        try {
          const stmt = db.prepare(query)
          const row = stmt.get(...params) as any
          if (!row) return null
          if (colName) return row[colName] ?? null
          return row as T
        } catch (err) {
          console.error('D1 first() error:', err, 'SQL:', query, 'Params:', params)
          throw err
        }
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        try {
          const stmt = db.prepare(query)
          const results = stmt.all(...params) as T[]
          return {
            results,
            success: true,
            meta: {} as any
          }
        } catch (err) {
          console.error('D1 all() error:', err, 'SQL:', query, 'Params:', params)
          throw err
        }
      },
      async run<T = unknown>(): Promise<D1Response> {
        try {
          const stmt = db.prepare(query)
          const info = stmt.run(...params) as any
          return {
            success: true,
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid)
            } as any
          }
        } catch (err) {
          console.error('D1 run() error:', err, 'SQL:', query, 'Params:', params)
          throw err
        }
      },
      async raw<T = unknown[]>() {
        const stmt = db.prepare(query)
        return stmt.all(...params).map((r: any) => Object.values(r)) as T[]
      }
    } as unknown as D1PreparedStatement
  }

  return {
    prepare(query: string) {
      return createPreparedStatement(query)
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = []
      db.exec('BEGIN')
      try {
        for (const stmt of statements) {
          const res = await (stmt as any).all()
          results.push(res)
        }
        db.exec('COMMIT')
        return results
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
    async exec(query: string) {
      db.exec(query)
      return { count: 1, duration: 0 }
    },
    dump() {
      throw new Error('dump not implemented in mock')
    }
  } as unknown as D1Database
}
