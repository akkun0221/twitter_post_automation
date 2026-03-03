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

  if (
    !process.env.X_API_KEY ||
    !process.env.X_API_KEY_SECRET ||
    !process.env.X_ACCESS_TOKEN ||
    !process.env.X_ACCESS_TOKEN_SECRET
  ) {
    const missing = [
      !process.env.X_API_KEY && "X_API_KEY",
      !process.env.X_API_KEY_SECRET && "X_API_KEY_SECRET",
      !process.env.X_ACCESS_TOKEN && "X_ACCESS_TOKEN",
      !process.env.X_ACCESS_TOKEN_SECRET && "X_ACCESS_TOKEN_SECRET",
    ].filter(Boolean);
    console.error("Missing X API credentials:", missing.join(", "));
    return res.status(500).json({
      error: "Server configuration error",
      details: `Missing environment variables: ${missing.join(", ")}`,
    });
  }

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_KEY_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  try {
    console.log("Start processing images...");
    const mediaIds = await Promise.all(
      images.map(async (base64Image: string, index: number) => {
        try {
          // Detect mime type
          const match = base64Image.match(/^data:(image\/\w+);base64,/);
          const mimeType = match ? match[1] : "image/jpeg";

          const cleanBase64 = base64Image.replace(
            /^data:image\/\w+;base64,/,
            ""
          );
          const imageBuffer = Buffer.from(cleanBase64, "base64");

          console.log(
            `Uploading image ${index + 1}... size: ${imageBuffer.length} bytes`
          );

          // ✅ v1 → v2 に変更（v1.1は2025年6月廃止済み）
          const mediaId = await client.v2.uploadMedia(imageBuffer, {
            media_type: mimeType,
          });

          return mediaId;
        } catch (mediaErr: unknown) {
          const mErr = mediaErr as Error;
          console.error(`Error uploading image ${index + 1}:`, mErr);
          throw mErr;
        }
      })
    );

    console.log("Images uploaded successfully. Posting tweet...");
    const tweet = await client.v2.tweet(text, {
      media: {
        media_ids: mediaIds as
          | [string]
          | [string, string]
          | [string, string, string]
          | [string, string, string, string],
      },
    });

    console.log("Tweet posted successfully:", tweet.data.id);
    return res.status(200).json({
      success: true,
      postUrl: `https://x.com/user/status/${tweet.data.id}`,
      postId: tweet.data.id,
    });
  } catch (error: unknown) {
    const err = error as any;
    console.error("Twitter API Execution Error:", JSON.stringify(err, null, 2));

    const errorMessage =
      err instanceof Error ? err.message : "Internal Server Error";

    return res.status(500).json({
      error: errorMessage,
      code: err.code || undefined,
      data: err.data || undefined,
    });
  }
}
