import { eq, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
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

export type IdTable = SQLiteTable & { id: SQLiteColumn };
type Row<TTable extends IdTable> = InferSelectModel<TTable> & { id: number };

export class EntityNotFoundError extends Error {
  constructor(entity: string, id: number) {
    super(`${entity} with id ${id} was not found`);
    this.name = "EntityNotFoundError";
  }
}

/**
 * One implementation of IRepository<T> reused by all entities (DRY).
 * better-sqlite3 is synchronous; the Promise-based contract keeps the
 * business layer independent of the storage engine.
 */
export class DrizzleRepository<TTable extends IdTable>
  implements IRepository<Row<TTable>, InferInsertModel<TTable>>
{
  constructor(
    protected readonly db: Db,
    protected readonly table: TTable,
    private readonly entityName: string,
  ) {}

  async getAll(): Promise<Row<TTable>[]> {
    return this.db.select().from(this.table as IdTable).all() as Row<TTable>[];
  }

  async getById(id: number): Promise<Row<TTable> | undefined> {
    return this.db
      .select()
      .from(this.table as IdTable)
      .where(eq(this.table.id, id))
      .get() as Row<TTable> | undefined;
  }

  async add(entity: InferInsertModel<TTable>): Promise<Row<TTable>> {
    return this.db
      .insert(this.table as IdTable)
      .values(entity as never)
      .returning()
      .get() as Row<TTable>;
  }

  async update(entity: Row<TTable>): Promise<Row<TTable>> {
    const { id, ...values } = entity;
    const row = this.db
      .update(this.table as IdTable)
      .set(values as never)
      .where(eq(this.table.id, id))
      .returning()
      .get() as Row<TTable> | undefined;
    if (!row) throw new EntityNotFoundError(this.entityName, id);
    return row;
  }

  async delete(id: number): Promise<boolean> {
    const deleted = this.db.delete(this.table as IdTable).where(eq(this.table.id, id)).returning().all();
    return deleted.length > 0;
  }
}
