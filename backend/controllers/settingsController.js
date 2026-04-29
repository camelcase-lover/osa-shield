import { where } from "sequelize";
import { Setting } from "../config/db.js";
import UserModel from "../model/UserModel.js";

export const twoFactorSettingController = async(request, reply) => {
    try {
        const {userId} = request.params ?? {};

        const setting = await Setting.findOne({
            where: {user_id: userId}
        });

        if(!setting){
            return reply.code(404).send({message: "Who are you ?"});
        }

        setting.is_2fa_enabled = !setting.is_2fa_enabled;

        await setting.save();

        return reply.code(200).send({
            message: `2FA has been ${setting.is_2fa_enabled ? "enabled" : "disabled"}`,
            is_2fa_enabled: setting.is_2fa_enabled
        });

    } catch (error) {
        console.log(error);
        return reply.code(500).send({message: "Internal server error"});
    }
}