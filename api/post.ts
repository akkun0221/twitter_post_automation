import { VercelRequest, VercelResponse } from "@vercel/node";
import { TwitterApi, EUploadMimeType } from "twitter-api-v2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, images } = req.body;

  if (!text || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "Missing text or images" });
  }

  // 必要な環境変数チェック
  const missing = [
    !process.env.X_API_KEY && "X_API_KEY",
    !process.env.X_API_KEY_SECRET && "X_API_KEY_SECRET",
    !process.env.X_ACCESS_TOKEN && "X_ACCESS_TOKEN",
    !process.env.X_ACCESS_TOKEN_SECRET && "X_ACCESS_TOKEN_SECRET",
  ].filter(Boolean);

  if (missing.length) {
    console.error("Missing X API credentials:", missing.join(", "));
    return res.status(500).json({
      error: "Server configuration error",
      details: `Missing environment variables: ${missing.join(", ")}`,
    });
  }

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_KEY_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });

  try {
    console.log("Start processing images...");
    const mediaIds: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const base64Image = images[i];

      // MIME タイプ抽出
      const match = base64Image.match(/^data:(image\/\w+);base64,/);
      const rawMime = match ? match[1] : "image/jpeg";

      const mimeTypeMap: Record<string, EUploadMimeType> = {
        "image/jpeg": EUploadMimeType.Jpeg,
        "image/png": EUploadMimeType.Png,
        "image/gif": EUploadMimeType.Gif,
        "image/webp": EUploadMimeType.Webp,
      };
      const mimeType = mimeTypeMap[rawMime] ?? EUploadMimeType.Jpeg;

      // base64 → Buffer
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(cleanBase64, "base64");

      console.log(
        `[Image ${i + 1}] Uploading... size: ${imageBuffer.length} bytes, type: ${mimeType}`,
      );

      // ✅ v2 アップロード（media_category 必須！）
      const mediaId = await client.v2.uploadMedia(imageBuffer, {
        media_type: mimeType,
        media_category: "tweet_image", // ← 重要：これがないと 503
      });

      console.log(`[Image ${i + 1}] Upload success! mediaId: ${mediaId}`);
      mediaIds.push(mediaId);

      // 連続アップロード時は 1 秒待機
      if (i < images.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // ツイート投稿
    console.log("Posting tweet with mediaIds:", mediaIds);
    const tweet = await client.v2.tweet(text, {
      media: { media_ids: mediaIds as any },
    });

    console.log("Tweet posted! id:", tweet.data.id);
    return res.status(200).json({
      success: true,
      postUrl: `https://x.com/user/status/${tweet.data.id}`,
      postId: tweet.data.id,
    });
  } catch (error: unknown) {
    const err = error as any;
    console.error("Twitter API Execution Error:", JSON.stringify(err, null, 2));
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Internal Server Error",
      code: err.code,
      data: err.data,
    });
  }
}
