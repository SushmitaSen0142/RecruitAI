// Vercel API Route: /api/screen-resume.js
// This replaces your N8N workflow completely
// Deploy to Vercel: https://vercel.com

import Groq from "groq-sdk";
import nodemailer from "nodemailer";
import pdfParse from "pdf-parse";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Gmail transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
  },
});

// PDF extraction helper
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

// Parse LLM response JSON
function parseAIResponse(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("JSON parse error:", error);
    // Return a structured fallback
    return {
      score: 50,
      Name: "Candidate",
      Email: "candidate@example.com",
      matchedSkills: [],
      missingSkills: [],
      niceToHaveSkills: [],
      highestEducation: "Not specified",
      Limitation: "Could not fully parse response",
      "Executive summary": "Resume analysis encountered an issue",
    };
  }
}

// Send email helper
async function sendEmail(to, subject, isApproved, candidateName, jobTitle) {
  const htmlMessage = isApproved
    ? `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello ${candidateName},</p>
  <p>
    Thank you for applying for the position of 
    <strong>${jobTitle}</strong> 
    at <strong>Our Company</strong>.
  </p>
  <p>
    We are pleased to inform you that your profile has been 
    <strong>shortlisted</strong> for the next round of our hiring process.
  </p>
  <p>
    Our recruitment team will reach out to you shortly to schedule your interview.  
    Please keep your phone available, and feel free to contact us if you need any clarification.
  </p>
  <p>
    We look forward to speaking with you soon.
  </p>
  <p style="margin-top: 25px;">
    Warm regards,<br>
    <strong>Hiring Team</strong>
  </p>
</body>
</html>`
    : `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello ${candidateName},</p>
  <p>
    Thank you for applying for the position of 
    <strong>${jobTitle}</strong> 
    at <strong>Our Company</strong>, and for the time you spent submitting your application.
  </p>
  <p>
    After careful evaluation, we regret to inform you that we will not be moving forward with your
    candidacy for this role. This decision is based on the specific requirements of the position and
    the competitive nature of the applications we received.
  </p>
  <p>
    We genuinely appreciate your interest in our organization and encourage you to apply again for
    future opportunities that align with your skills and career aspirations.
  </p>
  <p>
    We wish you great success in your professional journey.
  </p>
  <p style="margin-top: 25px;">
    Kind regards,<br>
    <strong>Hiring Team</strong>
  </p>
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
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }
}

export default async function handler(req, res) {
  // Enable CORS
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
    // Parse form data
    const formData = req.body;

    if (!formData.resume) {
      return res.status(400).json({ error: "Resume file is required" });
    }

    const {
      jobTitle,
      jobDescription,
      experienceRequired,
      mustHaveSkills,
      strictness,
      resume,
    } = formData;

    // Extract text from PDF
    let resumeText;
    if (typeof resume === "string" && resume.startsWith("data:")) {
      // Handle base64 PDF
      const base64Data = resume.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      resumeText = await extractTextFromPDF(buffer);
    } else if (resume instanceof Buffer) {
      resumeText = await extractTextFromPDF(resume);
    } else {
      return res.status(400).json({ error: "Invalid resume format" });
    }

    // Prepare the screening prompt
    const screeningPrompt = `You are an expert HR resume screener. Analyze the following resume against the job requirements.

Strictness Level: ${strictness} (0 = very lenient, 100 = very strict)

Job Title: ${jobTitle}
Job Description: ${jobDescription}
Experience Required: ${experienceRequired}
Must-Have Skills: ${mustHaveSkills}

Resume Content:
${resumeText}

Provide your analysis ONLY as valid JSON (no markdown, no code blocks, pure JSON):
{
  "score": <number 0-100>,
  "Name": "<candidate name>",
  "Email": "<email if found>",
  "matchedSkills": [<array of skills>],
  "missingSkills": [<array of skills>],
  "niceToHaveSkills": [<array of skills>],
  "highestEducation": "<education level>",
  "Limitation": "<any limitations>",
  "Executive summary": "<brief summary>"
}`;

    // Call Groq AI
    const message = await groq.messages.create({
      model: "mixtral-8x7b-32768", // Free Groq model
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: screeningPrompt,
        },
      ],
    });

    // Parse AI response
    const aiResponseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const analysisResult = parseAIResponse(aiResponseText);

    // Determine if approved (score > 74)
    const isApproved = analysisResult.score > 74;

    // Send email if email exists
    if (analysisResult.Email && analysisResult.Email !== "candidate@example.com") {
      const emailSubject = isApproved
        ? `Update on Your Application to ${jobTitle}`
        : `Update on your Application to ${jobTitle}`;

      await sendEmail(
        analysisResult.Email,
        emailSubject,
        isApproved,
        analysisResult.Name,
        jobTitle
      );
    }

    // Return results
    return res.status(200).json({
      score: analysisResult.score,
      Name: analysisResult.Name,
      Email: analysisResult.Email,
      matchedSkills: analysisResult.matchedSkills,
      missingSkills: analysisResult.missingSkills,
      niceToHaveSkills: analysisResult.niceToHaveSkills,
      highestEducation: analysisResult.highestEducation,
      Limitation: analysisResult.Limitation,
      "Executive summary": analysisResult["Executive summary"],
      emailSent: isApproved || !!analysisResult.Email,
    });
  } catch (error) {
    console.error("Error processing resume:", error);
    return res.status(500).json({
      error: "Failed to process resume",
      details: error.message,
    });
  }
}
