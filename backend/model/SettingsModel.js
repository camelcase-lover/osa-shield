export default (sequelize, DataTypes) => {
    const Setting = sequelize.define(
        "settings",
        {
            settings_id: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: DataTypes.UUIDV4
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                reference: {
                    model: "users",
                    key: "user_id"
                }
            },
            is_2fa_enabled: {
                type: DataTypes.HOOLEAM,
                allowNull: false,
                defaultValue: false,
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "settings",
            timestamps: false,
            underscored: true,
        }
    );
        Setting.associate = (models) => {
            Setting.belongsTo(models.User, {
                foreignKey: "user_id",
                as: "user",
            });  
        }
    

    return Setting;
}