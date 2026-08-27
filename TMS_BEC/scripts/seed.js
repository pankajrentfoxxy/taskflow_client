import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { now } from "../src/lib/time.js";
import { User } from "../src/models/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

export async function seedDatabase() {
  const t = now();
  const hash = bcrypt.hashSync("password123", 10);

  await User.create({
    name: "Admin",
    email: "admin@rentfoxxy.com",
    password_hash: hash,
    role: "ADMIN",
    team_id: null,
    created_at: t,
  });

  console.log("Seed complete.");
}

const isDirectRun = process.argv[1]?.endsWith("seed.js");

if (isDirectRun) {
  import("../src/app.js")
    .then(({ initApp }) => initApp())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export default seedDatabase;
