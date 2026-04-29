import { resolve4 } from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { text } from "node:stream/consumers";

dotenv.config();

const email_user = process.env.EMAIL_USER;
const email_pass = process.env.EMAIL_PASS;
const api_key = process.env.EMAIL_SENDER_APT_KEY;
const api_url = process.env.EMAIL_API_URL;



async function sendEmails({ to, subject, html, text} ){

  try {

    await fetch(api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        from: email_user,
        to,
        subject,
        html,
        text: text,
      })
    });

   
  } catch (error) {
    console.log(error);
  }
}

function buildConfirmEmailMessage(recipientEmail, confirmLink) {
  const html = `
    <html>
      <body>
        <p>Hi,</p>
        <p>Please confirm your email to complete sign up.</p>
        <p><a href="${confirmLink}">Confirm Email</a></p>
        <p>If you never registered on OSA pls contact us.</p>
        <p>Thank you!</p>
      </body>
    </html>
  `;

  return {
    to: recipientEmail,
    subject: "Confirm your email",
    text: `Please confirm your email: ${confirmLink}`,
    html,
  };
}

function buildResetPassordMail(email, redirectLink){
  const html = `
  <html>
    <body>
      <p>Friend, </p>
      <p>This a reset password bypass</p>
      <p>It will expire in 60 minutes be fast</p>
      <p><a href=${redirectLink}>Reset</a></p>
      <p>If you never requested email contact us for instant account deletion lol!</p>
      <p>Thank you friend</p>
    </body>
  </html>
  `;

  return {
    to: email,
    subject: "Reset Password",
    text: `Reset your password friend ${redirectLink}`,
    html, 
  }
}

function buildOtpMail(mail, code){
    const html = `
    <html>
      <body>
        <p>Hello,</p>
        <p>You need this otp to continue login</p>
        <p>It will expire in 5 mins</p>
        <p>${code}</p>
        <p>If you never initiated the code pls contact us for us to take action</p>
        <p>Importance of two factor authentication it protects account over suspicious login.</p>
        <p>Thanks for helping continue shape the community</p>
      </body>
    </html>
    `;

    return {
      to: mail,
      subject: "OSA 2FA LOGIN OTP",
      text: `He is you 5 mins code ${code}`,
      html,
    }
}

export async function sendConfirmEmail(recipientEmail, confirmLink) {
  const message = buildConfirmEmailMessage(recipientEmail, confirmLink);

  return await sendEmails(message);
}

export async function sendResetPasswordMail(email, redirectLink) {
  const message = buildResetPassordMail(email, redirectLink);
  
  return await sendEmails(message);
  
}

export async function sendOtpMail(mail, code) {
  const message = buildOtpMail(mail, code);
  
  return await sendOtpMail(message);
  
}