import { Setting } from "../config/db.js";

export const twoFactorSettingController = async(request, reply) => {
    try {
        const userId = request.session?.userId;

        if (!userId) {
            return reply.code(401).send({message: "Unauthorized"});
        }

        const [setting] = await Setting.findOrCreate({
            where: {user_id: userId},
            defaults: {
                user_id: userId,
                is_2fa_enabled: false,
            },
        });

        if (request.method === "GET") {
            return reply.code(200).send({
                is_2fa_enabled: setting.is_2fa_enabled
            });
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
