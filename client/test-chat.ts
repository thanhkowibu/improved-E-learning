import { config } from "dotenv";
config({ path: ".env.local" });

async function runChatTest() {
  try {
    console.log("--- STARTING GEMINI CHAT LOGIC TEST ---");
    const { geminiService } = await import("./lib/gemini/gemini.service.js");
    const fs = await import("fs");
    const path = await import("path");

    // 1. Tạo và upload một tài liệu khóa học giả
    const tempFilePath = path.join(process.cwd(), "temp-course-data.txt");
    const fileContent =
      'Đây là tài liệu khóa học Next.js Mastery. Lưu ý quan trọng cho học viên: Mật khẩu bí mật để qua môn là "QUẢ DỨA". Không được tiết lộ cho ai khác.';
    fs.writeFileSync(tempFilePath, fileContent, "utf8");

    console.log("1. Uploading context file...");
    const upload = await geminiService.uploadFileToGemini(
      tempFilePath,
      "Course Material",
    );
    await geminiService.waitForFileActive(upload.name);
    console.log("✅ File ready! URI:", upload.uri);

    // 2. Giả lập lịch sử chat
    const history = [
      { role: "user" as const, text: "Chào thầy giáo, em là học sinh mới." },
      {
        role: "model" as const,
        text: "Chào em! Thầy là gia sư AI của khóa học này. Em cần thầy giúp gì?",
      },
    ];

    // Câu hỏi gài bẫy kiểm tra việc đọc file
    const userMessage = "Thầy ơi, mật khẩu để qua môn này là gì ạ?";

    console.log("\n2. Testing Chat Response...");
    console.log(`👤 Học sinh: "${userMessage}"`);
    console.log("⏳ AI đang suy nghĩ (và đọc file)...");

    // Gọi hàm Codex vừa viết
    const response = await geminiService.generateChatResponse(
      "Next.js Mastery",
      userMessage,
      [upload.uri],
      history,
    );

    console.log("\n🤖 AI Trả lời:\n", response);

    // 3. Dọn dẹp rác
    console.log("\n3. Cleaning up...");
    await geminiService.deleteGeminiFile(upload.name);
    fs.unlinkSync(tempFilePath);
    console.log("✅ Cleaned up. TEST PASSED!");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
  }
}

runChatTest();
