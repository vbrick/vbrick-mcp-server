import { config } from "../config.js";
import { makeVbrickRevApiRequest, formatResponse } from "../vbrickUtilities.js";

export const whoAmITool = {
  name: "vbrick_who_am_i",
  description: "Check who is the current logged-in Vbrick Rev user. " +
                "Always use this tool first to check if the user is authenticated and get users info.",
  inputSchema: {},
  async handler() {
    const userUrl = `${config.vbrickRevTenantUrl}/api/v2/users/me`;
    const userData = await makeVbrickRevApiRequest<any>(userUrl);

    if (!userData) {
      return formatResponse("Failed to retrieve user data", "text");
    }

    const responseData = {
      firstname: userData.firstname,
      lastname: userData.lastname,
      email: userData.email,
      username: userData.username
    }

    return formatResponse(responseData, "json");
  }
};
