import { DataTypes, Sequelize } from "sequelize";
import dotenv from "dotenv";
import createUserModel from "../model/UserModel.js";
import createConfirmEmailModel from "../model/ConfirmEmailModel.js";
import createScamScanModel from "../model/ScamScanModel.js";
import createScamModel from "../model/ScamModel.js";
import createScamVoteModel from "../model/ScamVoteModel.js";
import createThreadModel from "../model/ThreadModel.js";
import createThreadLikesModel from "../model/ThreadLikesModel.js"
import createThreadCommentsModel from "../model/ThreadCommentsModel.js"
import createSettingsModel from "../model/SettingsModel.js";
import createOtpModel from "../model/OtpModel.js";


dotenv.config();

const database_url = process.env.DATABASE_URL;
const db_user = process.env.DB_USER;
const db_password = process.env.DB_PASSWORD;
const db_host = process.env.DB_HOST;
const db_name = process.env.DB_NAME;
const dbConnectTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS || 8000);
const dbSslMode = (process.env.DB_SSL ?? "auto").trim().toLowerCase();

function detectDatabaseHost() {
  if (!database_url) {
    return db_host;
  }

  try {
    return new URL(database_url).hostname;
  } catch {
    return db_host;
  }
}

function shouldUseSsl() {
  if (dbSslMode === "true") {
    return true;
  }

  if (dbSslMode === "false") {
    return false;
  }

  const hostname = detectDatabaseHost();
  return !["localhost", "127.0.0.1", "::1"].includes(hostname ?? "");
}

const resolvedDbHost = detectDatabaseHost();
const dialectOptions = {
  connectionTimeoutMillis: dbConnectTimeoutMs,
};

if (shouldUseSsl()) {
  dialectOptions.ssl = {
    rejectUnauthorized: false,
    servername: resolvedDbHost,
  };
}

const commonOptions = {
  dialect: "postgres",
  logging: false,
  dialectOptions,
  pool: {
    max: 5,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
};

const sequelize = database_url
  ? new Sequelize(database_url, commonOptions)
  : new Sequelize(db_name, db_user, db_password, {
      ...commonOptions,
      host: db_host,
    });

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.User = createUserModel(sequelize, DataTypes);
db.ConfirmEmail = createConfirmEmailModel(sequelize, DataTypes);
db.ScamScan = createScamScanModel(sequelize, DataTypes);
db.Scam = createScamModel(sequelize, DataTypes);
db.ScamVote = createScamVoteModel(sequelize, DataTypes);
db.Thread = createThreadModel(sequelize, DataTypes);
db.ThreadLikes = createThreadLikesModel(sequelize, DataTypes);
db.ThreadComments = createThreadCommentsModel(sequelize, DataTypes);
db.Setting = createSettingsModel(sequelize, DataTypes);
db.Otp = createOtpModel(sequelize, DataTypes);

for (const value of Object.values(db)) {
  if (value?.associate) {
    value.associate(db);
  }
}

export const User = db.User;
export const ConfirmEmail = db.ConfirmEmail;
export const ScamScan = db.ScamScan;
export const Scam = db.Scam;
export const ScamVote = db.ScamVote;
export const Thread = db.Thread;
export const ThreadLikes = db.ThreadLikes;
export const ThreadComments = db.ThreadComments;
export const Setting = db.Setting;
export const Otp = db.Otp;

export { sequelize, db };
export default sequelize;
