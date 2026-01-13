import axios from "axios";

export interface PostResponse {
  success: boolean;
  postUrl: string;
  postId: string;
}

export const postTweet = async (
  text: string,
  images: string[]
): Promise<PostResponse> => {
  // Real implementation:
  try {
    const response = await axios.post("/api/post", { text, images });
    return response.data;
  } catch (error: unknown) {
    const err = error as any;
    console.error("API Error:", err);
    throw err.response?.data?.error || new Error("Failed to post");
  }
};
