import {integer,sqliteTable,text} from "drizzle-orm/sqlite-core";
export const workspaces=sqliteTable("workspaces",{owner:text("owner").primaryKey(),data:text("data").notNull(),version:integer("version").notNull().default(1),updatedAt:text("updated_at").notNull()});
