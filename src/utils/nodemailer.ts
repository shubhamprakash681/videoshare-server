import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import juice from "juice";

interface emailObject {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (emailObject: emailObject): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    service: process.env.SMTP_SERVICE_NAME,
    auth: {
      user: process.env.SMTP_MAIL_ID,
      pass: process.env.SMTP_PSWD,
    },
  });

  const htmlWithInlinedStyles = emailObject.html
    ? juice(emailObject.html)
    : undefined;

  const mailOptions: Mail.Options = {
    from: process.env.SMTP_MAIL_ID,
    to: emailObject.to,
    subject: emailObject.subject,
    text: emailObject.text || undefined,
    html: htmlWithInlinedStyles || undefined,
  };

  await transporter.sendMail(mailOptions);
};
