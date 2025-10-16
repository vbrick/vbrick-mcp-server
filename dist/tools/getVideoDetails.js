import { config, formatResponse, makeVbrickRevApiRequest } from "../config.js";
import { z } from "zod";
import "zod/v4/locales";

//#region src/tools/getVideoDetails.ts
const getVideoDetailsTool = {
	name: "vbrick_get_video_details",
	description: "Get details for a specific video within Vbrick Rev. The results include information about the video including the playback link.",
	inputSchema: { videoId: z.string().describe("ID of the video to retrieve") },
	async handler({ videoId }) {
		const videoData = await makeVbrickRevApiRequest(`${config.vbrickRevTenantUrl}/api/v2/videos/${videoId}/details`);
		if (!videoData) return formatResponse("Failed to retrieve video details", "text");
		return formatResponse({
			id: videoData.id,
			title: videoData.title,
			htmlDescription: videoData.htmlDescription,
			description: videoData.description,
			linkedUrl: videoData.linkedUrl,
			approvalStatus: videoData.approvalStatus,
			categories: videoData.categories,
			categoryPaths: videoData.categoryPaths,
			videoAccessControl: videoData.videoAccessControl,
			accessControlEntities: videoData.accessControlEntities,
			tags: videoData.tags,
			enableComments: videoData.enableComments,
			enableRatings: videoData.enableRatings,
			enableDownloads: videoData.enableDownloads,
			enableExternalApplicationAccess: videoData.enableExternalApplicationAccess,
			enableExternalViewersAccess: videoData.enableExternalViewersAccess,
			status: videoData.status,
			canEdit: videoData.canEdit,
			thumbnailKey: videoData.thumbnailKey,
			thumbnailUrl: videoData.thumbnailUrl,
			uploadedBy: videoData.uploadedBy,
			whenUploaded: videoData.whenUploaded,
			lastViewed: videoData.lastViewed,
			customFields: videoData.customFields,
			sourceType: videoData.sourceType,
			expirationDate: videoData.expirationDate,
			expirationAction: videoData.expirationAction,
			publishDate: videoData.publishDate,
			is360: videoData.is360,
			unlisted: videoData.unlisted,
			totalViews: videoData.totalViews,
			overallProgress: videoData.overallProgress,
			isProcessing: videoData.isProcessing,
			enableAutoShowChapterImages: videoData.enableAutoShowChapterImages,
			sensitiveContent: videoData.sensitiveContent,
			passwordIsRequired: videoData.passwordIsRequired,
			password: videoData.password,
			userTags: videoData.userTags,
			upLoader: videoData.upLoader,
			owner: videoData.owner,
			instances: videoData.instances,
			audioTracks: videoData.audioTracks,
			duration: videoData.duration,
			chapters: videoData.chapters,
			hasAudioOnly: videoData.hasAudioOnly,
			avgRating: videoData.avgRating,
			ratingsCount: videoData.ratingsCount,
			expiration: videoData.expiration,
			commentsCount: videoData.commentsCount,
			whenModified: videoData.whenModified,
			closedCaptionsEnabled: videoData.closedCaptionsEnabled,
			approval: videoData.approval,
			transcodeFailed: videoData.transcodeFailed,
			source: videoData.source,
			viewerIdEnabled: videoData.viewerIdEnabled,
			hasDualStreams: videoData.hasDualStreams,
			isConvertedToSwitched: videoData.isConvertedToSwitched
		}, "json");
	}
};

//#endregion
export { getVideoDetailsTool };
//# sourceMappingURL=getVideoDetails.js.map