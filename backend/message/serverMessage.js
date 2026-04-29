export const serverMessageController = async(request, reply) => {
    try {
        const serverMessage = "Osa is a non profit project majorly developed to raise awareness, but feel free to donate :)";

        return reply.code(200).send({
            message: serverMessage
        });
    } catch (error) {
        return reply.code(500).send({message: "Internal server error"});
    }
}