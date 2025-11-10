import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("[Email] Configuration error:", error.message);
  }
});

export async function sendAnswerEmail(customerEmail, question, answer) {
  try {
    const mailOptions = {
      from: {
        name: "Luxe Salon & Spa AI Assistant",
        address: process.env.GMAIL_USER,
      },
      to: customerEmail,
      subject: "Your Question Has Been Answered!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .question {
              background: white;
              padding: 20px;
              border-left: 4px solid #667eea;
              margin: 20px 0;
              border-radius: 5px;
            }
            .answer {
              background: white;
              padding: 20px;
              border-left: 4px solid #10b981;
              margin: 20px 0;
              border-radius: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
            h1 {
              margin: 0;
              font-size: 24px;
            }
            h2 {
              color: #667eea;
              font-size: 16px;
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>✨ Great News!</h1>
            <p>We have an answer to your question</p>
          </div>
          <div class="content">
            <div class="question">
              <h2>Your Question:</h2>
              <p>${question}</p>
            </div>
            <div class="answer">
              <h2>Our Answer:</h2>
              <p>${answer}</p>
            </div>
            <p>If you have any more questions, feel free to chat with our AI assistant anytime!</p>
          </div>
          <div class="footer">
            <p>Luxe Salon & Spa</p>
            <p>This is an automated message from our AI assistant</p>
          </div>
        </body>
        </html>
      `,
      text: `
Your Question Has Been Answered!

Your Question:
${question}

Our Answer:
${answer}

If you have any more questions, feel free to chat with our AI assistant anytime!

---
Luxe Salon & Spa
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] ❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
}

export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
