import { type } from "node:os"

export default (sequelize, DataTypes)  => {
    const Otp = sequelize.define(
        "otp_login",
        {
            otp_id: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: DataTypes.UUIDV4,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: "users",
                    key: "user_id",
                }
            },
            code: {
                type: DataTypes.STRING(6),
                allowNull: false, 
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "otp_login",
            timestamps: false,
            underscored: true
        }
    );

    Otp.associate = (models) => {
        Otp.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
            onDelete: "CASCADE",
        });
    };

    return Otp;
}