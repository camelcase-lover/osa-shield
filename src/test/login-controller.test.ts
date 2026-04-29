/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findOne = vi.fn();
const updateUser = vi.fn();
const updateConfirmEmail = vi.fn();
const createConfirmEmail = vi.fn();
const sendConfirmEmail = vi.fn();
const sendOtpMail = vi.fn();
const comparePassword = vi.fn();
const findSetting = vi.fn();
const updateOtp = vi.fn();
const createOtp = vi.fn();

vi.mock("../../backend/config/db.js", () => ({
  User: {
    findOne,
  },
  ScamScan: {
    count: vi.fn().mockResolvedValue(0),
  },
  Scam: {
    count: vi.fn().mockResolvedValue(0),
  },
  ConfirmEmail: {
    update: updateConfirmEmail,
    create: createConfirmEmail,
  },
  Setting: {
    findOne: findSetting,
  },
  Otp: {
    update: updateOtp,
    create: createOtp,
  },
}));

vi.mock("../../backend/data/emailSender.js", () => ({
  isEmailServiceConfigured: () => true,
  sendConfirmEmail,
  sendOtpMail,
  sendResetPasswordMail: vi.fn(),
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: comparePassword,
  },
}));

function createReply() {
  return {
    statusCode: 200,
    payload: null,
    code: vi.fn(function code(statusCode) {
      this.statusCode = statusCode;
      return this;
    }),
    send: vi.fn(function send(payload) {
      this.payload = payload;
      return this;
    }),
  };
}

describe("loginController", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DEMO_MODE;
    findOne.mockReset();
    updateUser.mockReset();
    updateConfirmEmail.mockReset();
    createConfirmEmail.mockReset();
    sendConfirmEmail.mockReset();
    sendOtpMail.mockReset();
    comparePassword.mockReset();
    findSetting.mockReset();
    updateOtp.mockReset();
    createOtp.mockReset();
    findSetting.mockResolvedValue(null);
  });

  it("reissues confirmation email for valid unverified logins without waiting on SMTP", async () => {
    findOne.mockResolvedValue({
      user_id: "user-123",
      email: "fresh@example.com",
      password: "hashed-password",
      is_verified: false,
    });
    comparePassword.mockResolvedValue(true);
    updateConfirmEmail.mockResolvedValue([0]);
    createConfirmEmail.mockResolvedValue({});
    sendConfirmEmail.mockImplementation(() => new Promise(() => {}));

    const { loginController } = await import("../../backend/controllers/userController.js");

    const reply = createReply();
    const request = {
      body: {
        identifier: "fresh@example.com",
        password: "secret123",
      },
      log: {
        error: vi.fn(),
      },
    };

    await expect(
      Promise.race([
        loginController(request, reply),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("loginController timed out")), 50);
        }),
      ])
    ).resolves.toBe(reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.payload).toEqual({
      message:
        "Email is not verified. A new confirmation email is being sent. Please verify your email first.",
    });
    expect(sendConfirmEmail).toHaveBeenCalledWith(
      "fresh@example.com",
      expect.stringContaining("/verification?token=")
    );
  });

  it("auto-verifies existing users in demo mode and allows login", async () => {
    process.env.DEMO_MODE = "true";
    findOne.mockResolvedValue({
      user_id: "user-123",
      email: "fresh@example.com",
      password: "hashed-password",
      is_verified: false,
      update: updateUser.mockResolvedValue({}),
    });
    comparePassword.mockResolvedValue(true);

    const { loginController } = await import("../../backend/controllers/userController.js");

    const reply = createReply();
    const request = {
      body: {
        identifier: "fresh@example.com",
        password: "secret123",
      },
      session: {},
      headers: {},
      ip: "127.0.0.1",
      log: {
        error: vi.fn(),
      },
    };

    await loginController(request, reply);

    expect(updateUser).toHaveBeenCalledWith({ is_verified: true });
    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toEqual(
      expect.objectContaining({
        message: "Login successful",
        user: expect.objectContaining({
          email: "fresh@example.com",
        }),
      })
    );
    expect(request.session.userId).toBe("user-123");
    expect(sendConfirmEmail).not.toHaveBeenCalled();
  });

  it("sends an OTP and does not create a session when two-factor authentication is enabled", async () => {
    findOne.mockResolvedValue({
      user_id: "user-123",
      email: "secure@example.com",
      password: "hashed-password",
      is_verified: true,
    });
    comparePassword.mockResolvedValue(true);
    findSetting.mockResolvedValue({ is_2fa_enabled: true });
    updateOtp.mockResolvedValue([0]);
    createOtp.mockResolvedValue({});
    sendOtpMail.mockImplementation(() => new Promise(() => {}));

    const { loginController } = await import("../../backend/controllers/userController.js");

    const reply = createReply();
    const request = {
      body: {
        identifier: "secure@example.com",
        password: "secret123",
      },
      session: {},
      headers: {},
      ip: "127.0.0.1",
      log: {
        error: vi.fn(),
      },
    };

    await expect(
      Promise.race([
        loginController(request, reply),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("loginController timed out")), 50);
        }),
      ])
    ).resolves.toBe(reply);

    expect(reply.statusCode).toBe(202);
    expect(reply.payload).toEqual({
      message: "Two-factor code sent to your email.",
      requiresTwoFactor: true,
      email: "secure@example.com",
    });
    expect(sendOtpMail).toHaveBeenCalledWith("secure@example.com", expect.stringMatching(/^\d{6}$/));
    expect(request.session.userId).toBeUndefined();
  });
});
