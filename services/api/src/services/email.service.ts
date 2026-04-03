import nodemailer from "nodemailer";
import { Role } from "@prisma/client";
import { env } from "../config/env.config";
import { prisma } from "../prisma";

type SendCredentialsEmailInput = {
  recipientEmail: string;
  recipientName: string;
  role: Role;
  temporaryPassword: string;
  sentByUserId?: string;
};

type SendCredentialsEmailResult = {
  sent: boolean;
  reason?: string;
};

const isSmtpConfigured = () => {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
};

const buildTransport = () => {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
};

const roleLabel = (role: Role) => {
  if (role === Role.STUDENT) {
    return "Student";
  }

  if (role === Role.WARDEN) {
    return "Warden";
  }

  return "User";
};

export const sendCredentialsEmail = async (
  input: SendCredentialsEmailInput,
): Promise<SendCredentialsEmailResult> => {
  const subject = "GuardianGate account credentials";
  const text = [
    `Hello ${input.recipientName},`,
    "",
    `Your ${roleLabel(input.role)} account has been created in GuardianGate.`,
    `Email: ${input.recipientEmail}`,
    `Temporary password: ${input.temporaryPassword}`,
    "",
    "Please sign in and change your password immediately.",
  ].join("\n");

  const html = `
    <p>Hello ${input.recipientName},</p>
    <p>Your ${roleLabel(input.role)} account has been created in GuardianGate.</p>
    <p><strong>Email:</strong> ${input.recipientEmail}<br />
    <strong>Temporary password:</strong> ${input.temporaryPassword}</p>
    <p>Please sign in and change your password immediately.</p>
  `;

  const transporter = buildTransport();

  if (!transporter) {
    const reason = "SMTP is not configured";

    await prisma.emailLog.create({
      data: {
        recipient_email: input.recipientEmail,
        subject,
        template_type: "ACCOUNT_CREDENTIALS",
        status: "FAILED",
        failure_reason: reason,
        sent_by_user_id: input.sentByUserId,
      },
    });

    return { sent: false, reason };
  }

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: input.recipientEmail,
      subject,
      text,
      html,
    });

    await prisma.emailLog.create({
      data: {
        recipient_email: input.recipientEmail,
        subject,
        template_type: "ACCOUNT_CREDENTIALS",
        status: "SENT",
        sent_by_user_id: input.sentByUserId,
      },
    });

    return { sent: true };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown email delivery failure";

    await prisma.emailLog.create({
      data: {
        recipient_email: input.recipientEmail,
        subject,
        template_type: "ACCOUNT_CREDENTIALS",
        status: "FAILED",
        failure_reason: reason,
        sent_by_user_id: input.sentByUserId,
      },
    });

    return { sent: false, reason };
  }
};
