import { makeVbrickRevApiRequest, setVbrickAccessToken } from "../vbrickUtilities.js";

async function testmakeVbrickRevApiRequestWithToken(token: string, testUrl: string) {
  setVbrickAccessToken(token);
  try {
    const result = await makeVbrickRevApiRequest<any>(testUrl);
    console.log("makeVbrickRevApiRequest result:", result);
    return result;
  } catch (err) {
    console.error("makeVbrickRevApiRequest error:", err);
    return null;
  }
}

await testmakeVbrickRevApiRequestWithToken(
    "AI1m7WKgi9GIjPZi0Im5gDCNJjZzVOKKEP110oa9LxX2UfCoYQZ47mJyeiQL6lSYkCqQpvGxh7MdJ1mmzPIalVgc2Ra_s52py01KWjBmAe94C85R7NZTaTwvhIHsA6_PpMP0rXaBDnVlkwDGe2WxjA2",
    "http://avenger.vbricklab.com:9999/api/v2/videos/486c1512-24d3-4c27-9ab9-ef1cb3a02ac2/transcription-files/en").then(result => {
    if (result) {
      console.log("Integration test succeeded.");
      process.exit(0);
    } else {
      console.error("Integration test failed.");
      process.exit(1);
    }
  });
