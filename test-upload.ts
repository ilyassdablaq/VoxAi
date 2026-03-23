import FormData from "form-data";
import axios from "axios";
import fs from "fs";

async function testUpload() {
  // Create a test file
  const testContent = "This is a test PDF file. " + "Lorem ipsum dolor sit amet. ".repeat(100);
  const testFilePath = "./test-file.txt";
  fs.writeFileSync(testFilePath, testContent);

  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(testFilePath));
    formData.append("title", "Test Upload");

    const response = await axios.post(
      "http://localhost:8000/api/knowledge/ingest/file",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          // Mock JWT token - replace with real one for actual testing
          Authorization: "Bearer test-token",
        },
      }
    );

    console.log("Upload successful:", response.data);
  } catch (error: any) {
    console.error("Upload failed:", error.response?.data || error.message);
  } finally {
    fs.unlinkSync(testFilePath);
  }
}

testUpload();
