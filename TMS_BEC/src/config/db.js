import { Sequelize } from "sequelize";
import config from "./config.js";

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: "postgres",
  logging: config.env === "development" ? false : false,
  define: {
    underscored: true,
    timestamps: false,
  },
});

export default sequelize;
