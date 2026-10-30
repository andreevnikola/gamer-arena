import { AsyncLocalStorage } from "node:async_hooks";
import { asc, eq, sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Db } from "@/data/db";

/** Generic CRUD contract shared by every entity. No business logic belongs here. */
export interface IRepository<T extends { id: number }, TNew = Omit<T, "id">> {
  getAll(): Promise<T[]>;
  getById(id: number): Promise<T | undefined>;
  add(entity: TNew): Promise<T>;
  update(entity: T): Promise<T>;
  /** Resolves true when a row was deleted, false when the id did not exist. */
  delete(id: number): Promise<boolean>;
}

export type IdTable = PgTable & { id: PgColumn };
type Row<TTable extends IdTable> = InferSelectModel<TTable> & { id: number };

export class EntityNotFoundError extends Error {
  constructor(entity: string, id: number) {
    super(`${entity} with id ${id} was not found`);
    this.name = "EntityNotFoundError";
  }
}

/** First row of a result set, or undefined. */
export const first = <T>(rows: T[]): T | undefined => rows[0];

/** Arbitrary constant: the advisory lock key every unit of work takes. */
const UNIT_OF_WORK_LOCK = 7_243_001;

/**
 * Hands repositories the connection they should use. Outside a unit of work
 * that is the pool; inside `runInTransaction` it is the transaction, carried
 * through async calls by AsyncLocalStorage so repositories need no extra argument.
 */
export class DbContext {
  private readonly transaction = new AsyncLocalStorage<Db>();

  constructor(private readonly root: Db) {}

  get db(): Db {
    return this.transaction.getStore() ?? this.root;
  }

  /**
   * Runs `work` in one transaction (joins the current one when nested). A
   * transaction-scoped advisory lock serialises units of work, so check-then-write
   * rules (capacity, confirmation) stay race-free as they were on single-writer SQLite.
   */
  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.transaction.getStore()) return work();
    return this.root.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${UNIT_OF_WORK_LOCK})`);
      return this.transaction.run(tx as unknown as Db, work);
    });
  }
}

/**
 * One implementation of IRepository<T> reused by all entities (DRY).
 * The Promise-based contract keeps the business layer independent of the storage engine.
 */
export class DrizzleRepository<TTable extends IdTable>
  implements IRepository<Row<TTable>, InferInsertModel<TTable>>
{
  constructor(
    protected readonly context: DbContext,
    protected readonly table: TTable,
    private readonly entityName: string,
  ) {}

  protected get db(): Db {
    return this.context.db;
  }

  async getAll(): Promise<Row<TTable>[]> {
    return (await this.db.select().from(this.table as IdTable).orderBy(asc(this.table.id))) as Row<TTable>[];
  }

  async getById(id: number): Promise<Row<TTable> | undefined> {
    return first(
      (await this.db
        .select()
        .from(this.table as IdTable)
        .where(eq(this.table.id, id))) as Row<TTable>[],
    );
  }

  async add(entity: InferInsertModel<TTable>): Promise<Row<TTable>> {
    const rows = await this.db
      .insert(this.table as IdTable)
      .values(entity as never)
      .returning();
    return rows[0] as Row<TTable>;
  }

  async update(entity: Row<TTable>): Promise<Row<TTable>> {
    const { id, ...values } = entity;
    const rows = await this.db
      .update(this.table as IdTable)
      .set(values as never)
      .where(eq(this.table.id, id))
      .returning();
    const row = first(rows) as Row<TTable> | undefined;
    if (!row) throw new EntityNotFoundError(this.entityName, id);
    return row;
  }

  async delete(id: number): Promise<boolean> {
    const deleted = await this.db.delete(this.table as IdTable).where(eq(this.table.id, id)).returning();
    return deleted.length > 0;
  }
}
