import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { ConfirmEmail, Otp, Setting, User } from "../config/db.js";
import { sendConfirmEmail, sendResetPasswordMail, sendOtpMail } from "../data/emailSender.js";
import { ensureSessionLocation, getSessionLocationLabel } from "../services/sessionLocationService.js";
import { getUserSummary } from "../services/userMetricsService.js";
import dotenv from 'dotenv';
import { Op } from "sequelize";

dotenv.config();

const resetPasswordLink = process.env.RESET_LINK;
const VERIFICATION_TTL_MINUTES = Number(process.env.VERIFICATION_TTL_MINUTES || 45);
const isDemoModeEnabled = String(process.env.DEMO_MODE ?? "false").toLowerCase() === "true";

function isEmailServiceConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_SENDER_APT_KEY && process.env.EMAIL_API_URL);
}

async function toPublicUser(user, request) {
  const summary = await getUserSummary(user.user_id);

  return {
    id: user.user_id,
    name: user.name,
    email: user.email,
    role: "user",
    trustScore: summary.trustScore,
    totalScans: summary.totalScans,
    totalReports: summary.totalReports,
    location: getSessionLocationLabel(request),
  };
}


function buildConfirmLink(token) {
  const fallback = "http://localhost:8080/verification";
  const configured = process.env.CONFIRM_LINK?.trim() || fallback;

  let confirmUrl;
  try {
    confirmUrl = new URL(configured);
  } catch {
    confirmUrl = new URL(fallback);
  }

  if (!confirmUrl.pathname || confirmUrl.pathname === "/") {
    confirmUrl.pathname = "/verification";
  }

  confirmUrl.searchParams.set("token", token);
  return confirmUrl.toString();
}

function buildVerificationExpiryDate() {
  return new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60 * 1000);
}

function loginCodeExpiryDate(){
  return new Date(Date.now() + 5 * 60 * 1000);
}

async function createFreshVerificationToken(userId) {
  await ConfirmEmail.update(
    { used: true },
    {
      where: {
        user_id: userId,
        used: false,
      },
    }
  );

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = buildVerificationExpiryDate();

  await ConfirmEmail.create({
    user_id: userId,
    token,
    expires_at: expiresAt,
    used: false,
  });

  return token;
}

async function createFreshLoginOtp(userId) {
  await Otp.update(
    { used: true },
    {
      where: {
        user_id: userId,
        used: false,
      },
    }
  );

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = loginCodeExpiryDate();

  await Otp.create({
    user_id: userId,
    code,
    expires_at: expiresAt,
    used: false,
  });

  return code;
}

function queueConfirmationEmail(request, recipientEmail, confirmLink) {
  void sendConfirmEmail(recipientEmail, confirmLink).catch((error) => {
    if (request?.log?.error) {
      request.log.error(
        { err: error, recipientEmail },
        "Failed to send confirmation email"
      );
      return;
    }

    console.error("Failed to send confirmation email", error);
  });
}

function queueLoginOtpEmail(request, recipientEmail, code) {
  void sendOtpMail(recipientEmail, code).catch((error) => {
    if (request?.log?.error) {
      request.log.error(
        { err: error, recipientEmail },
        "Failed to send login OTP email"
      );
      return;
    }

    console.error("Failed to send login OTP email", error);
  });
}

export const registerController = async (request, reply) => {
  try {
    const { name, email, password } = request.body ?? {};

    if (!name || !email || !password) {
      return reply.code(400).send({ message: "All fields are required" });
    }

    // if (!isDemoModeEnabled && !isEmailServiceConfigured()) {
    //   return reply
    //     .code(500)
    //     .send({ message: "Email service not configured for registration." });
    // }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedName = String(name).trim();

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.is_verified) {
        return reply.code(400).send({ message: "User with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      await existingUser.update({
        name: normalizedName,
        password: hashedPassword,
      });

      if (isDemoModeEnabled) {
        await existingUser.update({ is_verified: true });

        return reply.code(200).send({
          message: "Account restored and auto-verified for demo mode. You can now log in.",
        });
      }

      const token = await createFreshVerificationToken(existingUser.user_id);
      const confirmLink = buildConfirmLink(token);
      queueConfirmationEmail(request, existingUser.email, confirmLink);

      return reply.code(200).send({
        message:
          "Account exists but is not verified. A new confirmation email is being sent.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      is_verified: isDemoModeEnabled,
    });

    if (isDemoModeEnabled) {
      return reply.code(201).send({
        message: "Account created successfully. Demo mode auto-verified your account.",
      });
    }

    const token = await createFreshVerificationToken(newUser.user_id);
    const confirmLink = buildConfirmLink(token);
    queueConfirmationEmail(request, newUser.email, confirmLink);

    return reply.code(201).send({
      message:
        "Account created successfully. Please confirm your email when the verification message arrives.",
    });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message.includes("Email service not configured")) {
      return reply.code(500).send({ message: error.message });
    }
    return reply.code(500).send({ message: "Internal server error" });
  }
};

export const verifyEmailController = async (request, reply) => {
  try {
    const { token } = request.query ?? {};

    if (!token) {
      return reply.code(400).send({ message: "Verification token is required" });
    }

    const confirmRecord = await ConfirmEmail.findOne({
      where: {
        token,
        used: false,
      },
    });

    if (!confirmRecord) {
      return reply.code(400).send({
        message: "Invalid or already used token",
      });
    }

    if (new Date(confirmRecord.expires_at) < new Date()) {
      return reply.code(400).send({
        message: "Token has expired. Please register again to receive a new link.",
      });
    }

    const user = await User.findByPk(confirmRecord.user_id);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    await user.update({ is_verified: true });
    await confirmRecord.update({ used: true });

    return reply.code(200).send({ message: "Email verified successfully" });
  } catch (error) {
    console.error(error);
    return reply.code(500).send({ message: "Internal server error" });
  }
};

export const loginController = async (request, reply) => {
  try {
    const { identifier, email, password } = request.body ?? {};
    const loginIdentifier = String(identifier ?? email ?? "").toLowerCase().trim();

    if (!loginIdentifier || !password) {
      return reply.code(400).send({ message: "Email and password are required" });
    }

    const user = await User.findOne({
      where: { email: loginIdentifier },
    });

    if (!user) {
      return reply.code(400).send({ message: "Invalid login credentials" });
    }

    const passwordOK = await bcrypt.compare(password, user.password);
    if (!passwordOK) {
      return reply.code(400).send({ message: "Invalid login credentials" });
    }

    if (!user.is_verified) {
      if (isDemoModeEnabled) {
        await user.update({ is_verified: true });
      } else {
        if (!isEmailServiceConfigured()) {
          return reply.code(500).send({
            message: "Email is not verified and email service is not configured.",
          });
        }

        const token = await createFreshVerificationToken(user.user_id);
        const confirmLink = buildConfirmLink(token);
        queueConfirmationEmail(request, user.email, confirmLink);

        return reply.code(403).send({
          message:
            "Email is not verified. A new confirmation email is being sent. Please verify your email first.",
        });
      }
    }

    const setting = await Setting.findOne({
      where: { user_id: user.user_id },
    });

    if (setting?.is_2fa_enabled) {
      if (!isEmailServiceConfigured()) {
        return reply.code(500).send({
          message: "Two-factor authentication is enabled but email service is not configured.",
        });
      }

      const code = await createFreshLoginOtp(user.user_id);
      queueLoginOtpEmail(request, user.email, code);

      return reply.code(202).send({
        message: "Two-factor code sent to your email.",
        requiresTwoFactor: true,
        email: user.email,
      });
    }

    request.session.userId = user.user_id;
    request.session.userRole = "user";
    ensureSessionLocation(request);

    return reply.code(200).send({
      message: "Login successful",
      user: await toPublicUser(user, request),
    });
  } catch (error) {
    console.error(error);
    return reply.code(500).send({ message: "Internal server error" });
  }
};

export const verifyLoginOtpController = async (request, reply) => {
  try {
    const { email, code } = request.body ?? {};
    const loginEmail = String(email ?? "").toLowerCase().trim();
    const otpCode = String(code ?? "").trim();

    if (!loginEmail || !otpCode) {
      return reply.code(400).send({ message: "Email and OTP code are required" });
    }

    const user = await User.findOne({
      where: { email: loginEmail },
    });

    if (!user) {
      return reply.code(400).send({ message: "Invalid or expired OTP code" });
    }

    const otpRecord = await Otp.findOne({
      where: {
        user_id: user.user_id,
        code: otpCode,
        used: false,
      },
      order: [["created_at", "DESC"]],
    });

    if (!otpRecord || new Date(otpRecord.expires_at) < new Date()) {
      return reply.code(400).send({ message: "Invalid or expired OTP code" });
    }

    await otpRecord.update({ used: true });

    request.session.userId = user.user_id;
    request.session.userRole = "user";
    ensureSessionLocation(request);

    return reply.code(200).send({
      message: "Login successful",
      user: await toPublicUser(user, request),
    });
  } catch (error) {
    console.error(error);
    return reply.code(500).send({ message: "Internal server error" });
  }
};

export const meController = async (request, reply) => {
  try {
    const userId = request.session?.userId;

    if (!userId) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    ensureSessionLocation(request);

    return reply.code(200).send({
      user: await toPublicUser(user, request),
    });
  } catch (error) {
    console.error(error);
    return reply.code(500).send({ message: "Internal server error" });
  }
};

export const logoutController = async (request, reply) => {
  try {
    if (!request.session) {
      return reply.code(200).send({ message: "Logged out successfully" });
    }

    return await new Promise((resolve) => {
      request.session.destroy((error) => {
        if (error) {
          console.error(error);
          resolve(reply.code(500).send({ message: "Could not log out" }));
          return;
        }

        reply.clearCookie("sessionId", { path: "/" });
        resolve(reply.code(200).send({ message: "Logged out successfully" }));
      });
    });
  } catch (error) {
    console.error(error);
    return reply.code(500).send({ message: "Internal server error" });
  }
};


export const sendResetPasswordController = async(request, reply) => {

   const { email } = request.body;
    const user = await User.findOne({
      where: {
        email: email
      }
    });

    if(!user){
      return reply.send({message: "User with this email address does not exist!"});
    }

    const token = crypto.randomBytes(32).toString('hex');

    const expiry = new Date(Date.now() + 3600000);

    await user.update({
      resetToken: token,
      resetTokenExpiry: expiry
    });
    

    const redirectLink = `${resetPasswordLink}?token=${token}`;

  try {
    await sendResetPasswordMail(email, redirectLink);
    return reply.send({message: "Email reset sent successfully, check email or junk!"});
  } catch (error) {
    console.log(error);
    return reply.code(500).send({message: "Internal server error"});
  }
}

export const resetPasswordPasswordController = async(request, reply) =>{

  const {token, password} = request.body;
  
  const user = await User.findOne({
    where: {
      resetToken: token,
      resetTokenExpiry: { [Op.gt]: new Date() }
    }
  });

  if(!user){
    return reply.status(401).send({message: "Invalid or expired session token"});
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await user.update({
    password: hashedPassword,
    resetToken: null,
    resetTokenExpiry: null
  });

  return reply.send({ message: "Password updated successfully" });

}
