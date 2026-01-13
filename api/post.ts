import { VercelRequest, VercelResponse } from "@vercel/node";
import { TwitterApi } from "twitter-api-v2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, images } = req.body;

  if (!text || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "Missing text or images" });
  }

  // Ensure environment variables are set
  if (
    !process.env.X_API_KEY ||
    !process.env.X_API_KEY_SECRET ||
    !process.env.X_ACCESS_TOKEN ||
    !process.env.X_ACCESS_TOKEN_SECRET
  ) {
    console.error("Missing X API credentials in environment variables.");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_KEY_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  try {
    // 1. Upload Media
    // Twitter API v1.1 upload endpoint supports binary or base64.
    // The library wrapper helps us.
    const mediaIds = await Promise.all(
      images.map(async (base64Image: string) => {
        // Remove data header if present
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(cleanBase64, "base64");

        // Upload media.
        const mediaId = await client.v1.uploadMedia(imageBuffer);
        return mediaId;
      })
    );

    // 2. Post Tweet
    // Twitter API v2
    const tweet = await client.v2.tweet(text, {
      media: { media_ids: mediaIds },
    });

    return res.status(200).json({
      success: true,
      postUrl: `https://x.com/user/status/${tweet.data.id}`,
      postId: tweet.data.id,
    });
  } catch (error: unknown) {
    const err = error as any;
    console.error("Twitter API Error:", err);
    // Rate limit errors, etc.
    return res.status(500).json({
      error: err.message || "Internal Server Error",
      details: err.data || undefined,
    });
  }
}
