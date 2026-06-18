import "./load-env.js";
import { createConnection } from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  const conn = await createConnection(url);
  try {
    // 確認 locationShares 是否存在
    const [tables] = await conn.execute("SHOW TABLES LIKE 'locationShares'") as any;
    if (tables.length === 0) {
      console.log("locationShares not found, creating...");
      await conn.execute(`
        CREATE TABLE locationShares (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          latitude text NOT NULL,
          longitude text NOT NULL,
          speed varchar(32) DEFAULT '0',
          heading varchar(32) DEFAULT '0',
          altitude varchar(32) DEFAULT '0',
          isGhostMode int NOT NULL DEFAULT 0,
          batteryLevel int DEFAULT -1,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log("Created locationShares with batteryLevel");
    } else {
      console.log("locationShares exists, checking batteryLevel column...");
      const [cols] = await conn.execute("SHOW COLUMNS FROM locationShares LIKE 'batteryLevel'") as any;
      if (cols.length === 0) {
        await conn.execute("ALTER TABLE locationShares ADD COLUMN batteryLevel int DEFAULT -1");
        console.log("Added batteryLevel column");
      } else {
        console.log("batteryLevel already exists");
      }
    }
    // 最終確認
    const [final] = await conn.execute("DESCRIBE locationShares") as any;
    console.log("Columns:", final.map((c: any) => c.Field).join(", "));
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
