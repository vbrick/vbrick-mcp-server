import { config } from "../config.js";
import { makeVbrickRevApiRequest, formatResponse } from "../vbrickUtilities.js";
import { z } from "zod";

export const getVideoChaptersTool = {
  name: "vbrick_get_video_chapters",
  description: "Get chapters for a specific video within Vbrick Rev",
  inputSchema: {
    videoId: z.string().describe("ID of the video to retrieve")
  },
  async handler({ videoId }: { videoId: string }) {
    const videoUrl = `${config.vbrickRevTenantUrl}/api/v2/videos/${videoId}/chapters`;
    const videoData = await makeVbrickRevApiRequest<any>(videoUrl);
    if (!videoData) {
      return formatResponse("Failed to retrieve video chapters", "text");
    }
    return formatResponse(videoData, "json");
  }
};
