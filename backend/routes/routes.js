import requireAuthentication from "../middleware/requireAuthentication.js";
import { checkPassword } from '../services/passwordCheck.js';
import requireDatabaseReady from "../middleware/requireDatabaseReady.js";
import {normalize} from "../utils/normalize.js";
import {hash} from "../utils/sha256.js";
//redis connection
import { createClient } from "redis";


import {
  loginController,
  logoutController,
  meController,
  registerController,
  verifyEmailController,
  verifyLoginOtpController,
  sendResetPasswordController,
  resetPasswordPasswordController
} from "../controllers/userController.js";
import { healthController } from "../controllers/systemController.js";
import {
  analyzeScamController,
  createScamReportController,
  getProfileActivityController,
  getReportedScamsController,
  publishScanToCommunityController,
  voteOnScamController,
} from "../controllers/scamController.js";
import { createThreadController,
  deleteThreadCommentController,
  deleteThreadController,
  getCreatedThreadsController,
  createThreadCommentController,
  getThreadCommentController,
  threadLikesController,
  threadLikeAndDislikesCountsController,
  getThreadCommentsCountController,
  updateThreadCommentController,
  updateThreadController
 } from "../controllers/threadController.js";
import { request } from "node:http";
import { twoFactorSettingController } from "../controllers/settingsController.js";
import { serverMessageController } from "../message/serverMessage.js";
import { analyzeUrlThreat } from "../services/urlThreatAnalysisService.js";

const DEFAULT_ALLOWED_ORIGINS = "http://localhost:8080,http://localhost:8081,http://localhost:5173";

function normalizeOrigin(value) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue === "*") {
    return trimmedValue;
  }

  try {
    return new URL(trimmedValue).origin;
  } catch {
    return trimmedValue.replace(/\/+$/, "");
  }
}

function getAllowedOrigins() {
  return (process.env.CORS_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

function applyCorsHeaders(request, reply) {
  const origin = normalizeOrigin(request.headers.origin);
  const allowedOrigins = getAllowedOrigins();
  const requestedHeaders = request.headers["access-control-request-headers"];

  if (!origin) {
    reply.header("Access-Control-Allow-Origin", "*");
  } else if (allowedOrigins.includes("*")) {
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Vary", "Origin");
  } else if (allowedOrigins.includes(origin)) {
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Vary", "Origin");
  }

  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    requestedHeaders || "Content-Type, Authorization"
  );
}

export default async function routes(fastify) {
  fastify.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply);
  });

  const preflightPaths = [
    "/health",
    "/auth/register",
    "/auth/verify-email",
    "/auth/login",
    "/auth/login/verify-otp",
    "/auth/logout",
    "/auth/me",
    "/scams",
    "/scams/analyze",
    "/scams/report",
    "/scams/:scamId/vote",
    "/scans/:scanId/community",
    "/profile/activity",
    "/thread",
    "/thread/:threadId",
    "/created-threads",
    "/thread/:threadId/comment",
    "/thread/:threadId/comment/:commentId",
    "/thread/:threadId/comments",
    "/thread/:threadId/thread-likes",
    "/thread/:threadId/votes/count",
    "/thread/:threadId/comments/count",
    "/send-reset-email",
    "/resetPassword",
    "/checkPassword",
    "/urlCheck",
    "/two-factor",
    "/",
  ];

  for (const path of preflightPaths) {
    fastify.options(path, async (request, reply) => {
      applyCorsHeaders(request, reply);
      return reply.code(204).send();
    });
  }

fastify.post("/urlCheck", async(request, reply) => {
  try {
    const {url} = request.body;
    if(!url){
      return reply.code(400).send({
        message: "Required"
      });
    }

    const analysisResult = await analyzeUrlThreat(url);

    return reply.code(200).send({analysisResult});

  } catch (error) {
    console.log("Url analysis error", error);
    return reply.code(500).send({
      message: "Internal server error",
    });
  }
});

// fastify.post("/urlCheck", async (request, reply) => {
//   const { url } = request.body;
//   const client = createClient();
//   await client.connect();
//   const URL_SET = "phish:urls";
//   const DOMAIN_SET = "phish:domains";

//   const norm = normalize(url);
//   if (!norm) {
//     return reply.code(400).send({ error: "Invalid URL" });
//   }

//   const urlHash = hash(norm.full);

//   // check exact match
//   if (await client.sIsMember(URL_SET, urlHash)) {
//     return { safe: false, reason: "exact_match" };
//   }

//   // check domain match
//   if (await client.sIsMember(DOMAIN_SET, norm.domain)) {
//     return { safe: false, reason: "domain_match" };
//   }

//   return { safe: true };
// });

fastify.post('/checkPassword', async (request, reply) => {
    try {
        const { password } = request.body;

        if(!password){
          return reply.code(400).send({message: "Password is required"})
        }


        const result = await checkPassword(password);   

        return result;  
    } 
    catch (e) {
      //bad request no here
      // if no field return 400 before continue
      
        // if (e.message === "Password is required") {
        //     return reply.code(400).send({ error: "Password is required" });
        // }

        console.log(e);
       
        return reply.code(500).send({ 
            message: "Internal server error"
        });
    }
});

  fastify.get("/health", healthController);
  fastify.get("/", serverMessageController);
  fastify.post(
    "/auth/register",
    {
      preHandler: requireDatabaseReady,
    },
    registerController
  );
  fastify.get(
    "/auth/verify-email",
    {
      preHandler: requireDatabaseReady,
    },
    verifyEmailController
  );
  fastify.post(
    "/auth/login",
    {
      preHandler: requireDatabaseReady,
    },
    loginController
  );
  fastify.post(
    "/auth/login/verify-otp",
    {
      preHandler: requireDatabaseReady,
    },
    verifyLoginOtpController
  );
  fastify.post("/auth/logout", logoutController);
  fastify.get(
    "/auth/me",
    {
      preHandler: [requireDatabaseReady, requireAuthentication],
    },
    meController
  );

  fastify.get(
    "/scams",
    {
      preHandler: requireDatabaseReady,
    },
    getReportedScamsController
  );
  fastify.post(
    "/scams/analyze",
    {
      preHandler: [requireDatabaseReady, requireAuthentication],
    },
    analyzeScamController
  );
  fastify.post(
    "/scams/report",
    {
      preHandler: [requireDatabaseReady, requireAuthentication],
    },
    createScamReportController
  );
  fastify.post(
    "/scams/:scamId/vote",
    {
      preHandler: [requireDatabaseReady, requireAuthentication],
    },
    voteOnScamController
  );
  fastify.post(
    "/scans/:scanId/community",
    {
      preHandler: [requireDatabaseReady, requireAuthentication],
    },
    publishScanToCommunityController
  );
  fastify.get(
    "/profile/activity",
    {
      preHandler: [requireDatabaseReady, requireAuthentication],
    },
    getProfileActivityController
  );

  fastify.post(
    "/thread",{
      preHandler: [requireDatabaseReady, requireAuthentication]
    },
    createThreadController
  );
  fastify.patch(
    "/thread/:threadId",
    {
      preHandler: [requireDatabaseReady, requireAuthentication]
    },
    updateThreadController
  );
  fastify.delete(
    "/thread/:threadId",
    {
      preHandler: [requireDatabaseReady, requireAuthentication]
    },
    deleteThreadController
  );

  fastify.get(
    "/created-threads",{
      preHandler: [requireDatabaseReady]
    },
    getCreatedThreadsController
  )

  fastify.post(
  "/thread/:threadId/comment",
  {
    preHandler: [requireDatabaseReady, requireAuthentication]
  },
  createThreadCommentController
)
fastify.patch(
  "/thread/:threadId/comment/:commentId",
  {
    preHandler: [requireDatabaseReady, requireAuthentication]
  },
  updateThreadCommentController
)
fastify.delete(
  "/thread/:threadId/comment/:commentId",
  {
    preHandler: [requireDatabaseReady, requireAuthentication]
  },
  deleteThreadCommentController
)
fastify.get(
  "/thread/:threadId/comments",
  {
    preHandler: [requireDatabaseReady]
  },
  getThreadCommentController
)
fastify.post(
  "/thread/:threadId/thread-likes",
  {
    preHandler: [requireDatabaseReady, requireAuthentication]
  },
  threadLikesController
)
fastify.get(
  "/thread/:threadId/votes/count",
  {
    preHandler: [requireDatabaseReady]
  },
  threadLikeAndDislikesCountsController
)

fastify.get(
  "/thread/:threadId/comments/count",
  {
    preHandler: [requireDatabaseReady]
  },
  getThreadCommentsCountController
)
fastify.post(
  "/send-reset-email",
  {
    preHandler: [requireDatabaseReady]
  },
  sendResetPasswordController
)
fastify.post(
  "/resetPassword",
  {
    preHandler: [requireDatabaseReady]
  },
  resetPasswordPasswordController
)
fastify.post(
  "/two-factor",
  {
    preHandler: [requireDatabaseReady, requireAuthentication],
  },
  twoFactorSettingController
)
fastify.get(
  "/two-factor",
  {
    preHandler: [requireDatabaseReady, requireAuthentication],
  },
  twoFactorSettingController
)

};
