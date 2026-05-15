import "dotenv/config";
import { sqlite } from "./index";
import { applySchema } from "./setup";

applySchema(true);
console.log("✓ Database migrations applied");
sqlite.close();
