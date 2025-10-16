import { config, formatResponse, makeVbrickRevApiRequest } from "../config.js";

//#region src/tools/whoAmI.ts
const whoAmITool = {
	name: "vbrick_who_am_i",
	description: "Check who is the current logged-in Vbrick Rev user. Always use this tool first to check if the user is authenticated and get users info.",
	inputSchema: {},
	async handler() {
		const userData = await makeVbrickRevApiRequest(`${config.vbrickRevTenantUrl}/api/v2/users/me`);
		if (!userData) return formatResponse("Failed to retrieve user data", "text");
		return formatResponse({
			firstname: userData.firstname,
			lastname: userData.lastname,
			email: userData.email,
			username: userData.username
		}, "json");
	}
};

//#endregion
export { whoAmITool };
//# sourceMappingURL=whoAmI.js.map