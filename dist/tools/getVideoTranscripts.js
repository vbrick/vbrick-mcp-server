import { config, formatResponse, makeVbrickRevApiRequest } from "../config.js";
import { z } from "zod";

//#region src/tools/getVideoTranscripts.ts
const getVideoTranscriptsTool = {
	name: "vbrick_get_video_transcripts",
	description: "Get transcripts for a specific video within Vbrick Rev. The transcript is returned in SRT format with timestamps. Return just the text to the user unless more information is requested. ",
	inputSchema: { videoId: z.string().describe("ID of the video to retrieve") },
	async handler({ videoId }) {
		const videoStream = await makeVbrickRevApiRequest(`${config.vbrickRevTenantUrl}/api/v2/videos/${videoId}/transcription-files/en`);
		if (!videoStream || typeof videoStream.getReader !== "function") return formatResponse("Failed to retrieve video transcripts", "text");
		let transcriptText = "";
		const reader = videoStream.getReader();
		const decoder = new TextDecoder();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			transcriptText += decoder.decode(value, { stream: true });
		}
		if (!transcriptText) return formatResponse("Transcript is empty", "text");
		return formatResponse({ transcript: transcriptText }, "json");
	}
};

//#endregion
export { getVideoTranscriptsTool };
//# sourceMappingURL=getVideoTranscripts.js.map