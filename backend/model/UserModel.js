import { type } from "os";

export default (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      user_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      resetToken: {
        type: DataTypes.STRING(255),
        defaultValue: null,
        field: 'resetToken',
      },
      resetTokenExpiry: {
        type: DataTypes.DATE,
        defaultValue: null,
        field: 'resetTokenExpiry',
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "users",
      timestamps: false,
      underscored: true,
    }
  );

  User.associate = (models) => {
    User.hasMany(models.ConfirmEmail, {
      foreignKey: "user_id",
      as: "emailVerifications",
      onDelete: "CASCADE",
    });

    User.hasMany(models.ScamScan, {
      foreignKey: "user_id",
      as: "scans",
      onDelete: "CASCADE",
    });

    User.hasMany(models.Scam, {
      foreignKey: "reporter_user_id",
      as: "reportedScams",
      onDelete: "CASCADE",
    });

    User.hasMany(models.ScamVote, {
      foreignKey: "user_id",
      as: "scamVotes",
      onDelete: "CASCADE",
    });

    User.hasMany(models.Thread, {
      foreignKey: "thread_user_id",
      as: "threads",
      onDelete: "CASCADE",
    });

    User.hasMany(models.Setting, {
      foreignKey: "settings_id",
      as: "settings",
      onDelete: "CASCADE",
    });
  };

  return User;
};
