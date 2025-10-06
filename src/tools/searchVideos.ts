import { config } from "../config.js";
import { makeVbrickRevApiRequest, formatResponse } from "../vbrickUtilities.js";
import { z } from "zod";

export const searchVideosTool = {
  name: "vbrick_search_videos",
  description: "Search for videos within Vbrick Rev. " +
               "The search works with a keyword and returns results in order by best match." +
               "Make sure the user is authenticated or there may not be any results.",
  inputSchema: {
    query: z.string().describe("Search terms, title, description, tags"),
    count: z.number().min(1).max(100).default(10).describe("Number of results to return, the default is 10.")
  },
  async handler({ query, count }: { query: string; count: number }) {
    const searchUrl = `${config.vbrickRevTenantUrl}/api/v2/videos/search?q=${encodeURIComponent(query)}&count=${count}&sortField=_score&sortDirection=desc`;
    const searchData = await makeVbrickRevApiRequest<any>(searchUrl);
    if (!searchData) {
      return formatResponse("No results matching search criteria", "text");
    }
    return formatResponse(searchData, "json");
  }
};
