import { parseArgs } from "node:util";
import { makeVbrickRevApiRequest, setVbrickAccessToken } from "../vbrickUtilities.ts";

let {values: {token, url}} = parseArgs({
  options: {
    token: { type: 'string' },
    url: { type: 'string' }
  }
});

if (!token || !url) {
  console.error(`Pass token and test url arguments: --token VBRICK_ACCESS_TOKEN --url "https://my.rev.tenant/api/v2/VIDEO_ID/transcription-files/en"`);
  process.exit(1);
}

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
    token,
    url).then(result => {
    if (result) {
      console.log("Integration test succeeded.");
      process.exit(0);
    } else {
      console.error("Integration test failed.");
      process.exit(1);
    }
  });
