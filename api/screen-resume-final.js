// /api/screen-resume.js
// Production API with Groq + Gmail

const Groq = require("groq-sdk");
const nodemailer = require("nodemailer");
const pdfParse = require("pdf-parse");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Extract text from PDF
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

// Parse JSON from AI response
function parseAIResponse(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Parse error:", error);
    return {
      score: 50,
      Name: "Candidate",
      Email: "candidate@example.com",
      matchedSkills: [],
      missingSkills: [],
      niceToHaveSkills: [],
      highestEducation: "Not specified",
      Limitation: "Parse error",
      "Executive summary": "Analysis failed",
    };
  }
}

// Send email
async function sendEmail(to, subject, isApproved, candidateName, jobTitle) {
  const htmlMessage = isApproved
    ? `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello ${candidateName},</p>
  <p>Thank you for applying for the position of <strong>${jobTitle}</strong>.</p>
  <p>We are pleased to inform you that your profile has been <strong>shortlisted</strong> for the next round.</p>
  <p>Our recruitment team will reach out to you shortly to schedule your interview.</p>
  <p>Warm regards,<br><strong>Hiring Team</strong></p>
</body>
</html>`
    : `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello ${candidateName},</p>
  <p>Thank you for applying for the position of <strong>${jobTitle}</strong>.</p>
  <p>After careful evaluation, we regret to inform you that we will not be moving forward with your candidacy for this role.</p>
  <p>We appreciate your interest and encourage you to apply for future opportunities.</p>
  <p>Kind regards,<br><strong>Hiring Team</strong></p>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      html: htmlMessage,
    });
    return { success: true };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.message };
  }
}

// Main handler
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;

    if (!body.resume) {
      return res.status(400).json({ error: "Resume required" });
    }

    const {
      jobTitle,
      jobDescription,
      experienceRequired,
      mustHaveSkills,
      strictness,
      resume,
    } = body;

    // Extract PDF text
    let resumeText;
    if (typeof resume === "string" && resume.startsWith("data:")) {
      const base64Data = resume.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      resumeText = await extractTextFromPDF(buffer);
    } else {
      return res.status(400).json({ error: "Invalid resume format" });
    }

    // AI screening prompt
    const prompt = `You are an expert HR resume screener. Analyze this resume against the job requirements.

Strictness: ${strictness} (0=lenient, 100=strict)
Job Title: ${jobTitle}
Job Description: ${jobDescription}
Experience Required: ${experienceRequired}
Must-Have Skills: ${mustHaveSkills}

Resume:
${resumeText}

Provide ONLY valid JSON:
{
  "score": <0-100>,
  "Name": "<name>",
  "Email": "<email>",
  "matchedSkills": [],
  "missingSkills": [],
  "niceToHaveSkills": [],
  "highestEducation": "<education>",
  "Limitation": "<limitations>",
  "Executive summary": "<summary>"
}`;

    // Call Groq
    const message = await groq.messages.create({
      model: "mixtral-8x7b-32768",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const aiText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const result = parseAIResponse(aiText);

    // Send email if approved/rejected
    const isApproved = result.score > 74;
    if (result.Email && result.Email !== "candidate@example.com") {
      const subject = isApproved
        ? `Update on Your Application to ${jobTitle}`
        : `Update on your Application to ${jobTitle}`;
      await sendEmail(result.Email, subject, isApproved, result.Name, jobTitle);
    }

    // Return results
    return res.status(200).json({
      score: result.score,
      Name: result.Name,
      Email: result.Email,
      matchedSkills: result.matchedSkills,
      missingSkills: result.missingSkills,
      niceToHaveSkills: result.niceToHaveSkills,
      highestEducation: result.highestEducation,
      Limitation: result.Limitation,
      "Executive summary": result["Executive summary"],
      emailSent: true,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Failed to process resume",
      details: error.message,
    });
  }
};
