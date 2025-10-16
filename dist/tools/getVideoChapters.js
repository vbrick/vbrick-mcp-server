import { config, formatResponse, makeVbrickRevApiRequest } from "../config.js";
import { z } from "zod";

//#region src/tools/getVideoChapters.ts
const getVideoChaptersTool = {
	name: "vbrick_get_video_chapters",
	description: "Get chapters for a specific video within Vbrick Rev",
	inputSchema: { videoId: z.string().describe("ID of the video to retrieve") },
	async handler({ videoId }) {
		const videoData = await makeVbrickRevApiRequest(`${config.vbrickRevTenantUrl}/api/v2/videos/${videoId}/chapters`);
		if (!videoData) return formatResponse("Failed to retrieve video chapters", "text");
		return formatResponse(videoData, "json");
	}
};

//#endregion
export { getVideoChaptersTool };
//# sourceMappingURL=getVideoChapters.js.map