import { VercelRequest, VercelResponse } from "@vercel/node";
import { TwitterApi } from "twitter-api-v2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_KEY_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });

  try {
    const tweet = await client.v2.tweet(
      "APIテスト " + new Date().toISOString(),
    );
    return res.status(200).json({ success: true, id: tweet.data.id });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message, code: err.code, data: err.data });
  }
}
