import { makeVbrickRevApiRequest, authenticateVbrickAndScheduleRefresh } from "../vbrickUtilities.js";
import { config } from "../config.js";

async function runIntegrationTest() {
  // This test will only succeed if valid API_KEY and SECRET are set in environment variables
  const token = await authenticateVbrickAndScheduleRefresh();

  if (!token) {
    console.error("Failed to authenticate with Rev.");
    process.exit(1);
  }
  
  const searchUrl = `${config.vbrickRevTenantUrl}/api/v2/videos/search?query=food&count=2`;
  
  try {
    const result = await makeVbrickRevApiRequest<any>(searchUrl);
    console.warn("Integration Test Result:", result.videos[0].title);
    process.exit(0);
  } catch (err) {
    console.error("Integration test failed:", err);
    process.exit(1);
  }
}

runIntegrationTest();
