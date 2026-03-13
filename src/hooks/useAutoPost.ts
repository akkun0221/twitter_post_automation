import { useState, useEffect, useCallback, useRef } from "react";
import { readFileAsDataURL } from "../utils/imageUtils";
import type { ImageFile } from "../utils/imageUtils";
import type { PostGroup } from "../components/StatusMonitor";
import type { PostHistoryItem } from "../components/HistoryGrid";
import { postTweet } from "../services/api";
import { format } from "date-fns";

const HISTORY_KEY = "x_auto_post_history";
const MAX_HISTORY = 100;
const ERROR_TIMEOUT_SEC = 30; // エラー後にボタンが再活性化するまでの秒数

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Helper to resize thumbnail to < 100KB (Simple canvas impl)
const resizeThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const maxSize = 300; // Small thumbnail

      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
};

export const useAutoPost = () => {
  const [isPosting, setIsPosting] = useState(false);
  const [groups, setGroups] = useState<PostGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [errorCountdown, setErrorCountdown] = useState<number>(0); // 0 = タイムアウトなし
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [history, setHistory] = useState<PostHistoryItem[]>(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
    return [];
  });

  // Save history on change
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // カウントダウンが 0 になったらタイマーをクリア
  useEffect(() => {
    if (errorCountdown <= 0 && countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, [errorCountdown]);

  // エラー時のカウントダウン開始
  const startErrorCountdown = useCallback((seconds: number) => {
    // 既存タイマーがあればクリア
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setErrorCountdown(seconds);
    countdownTimerRef.current = setInterval(() => {
      setErrorCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!);
          countdownTimerRef.current = null;
          setIsPosting(false); // ← カウントダウン終了でボタン再活性化
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const addToHistory = useCallback((item: PostHistoryItem) => {
    setHistory((prev) => {
      const newHistory = [item, ...prev];
      return newHistory.slice(0, MAX_HISTORY);
    });
  }, []);

  const deleteHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const createGroups = useCallback((images: ImageFile[]): PostGroup[] => {
    const newGroups: PostGroup[] = [];
    for (let i = 0; i < images.length; i += 4) {
      const chunk = images.slice(i, i + 4);
      newGroups.push({
        id: crypto.randomUUID(),
        images: chunk.map((img) => img.preview),
        status: "pending",
        retryCount: 0,
      });
    }
    return newGroups;
  }, []);

  // Main Posting Logic
  const processGroups = useCallback(
    async (
      currentGroups: PostGroup[],
      baseText: string,
      allImages: ImageFile[]
    ) => {
      const activeGroups = [...currentGroups];
      let hasAnyError = false;

      for (let i = 0; i < activeGroups.length; i++) {
        setCurrentGroupIndex(i);

        // Update status to posting
        activeGroups[i] = {
          ...activeGroups[i],
          status: "posting",
          error: undefined,
        };
        setGroups([...activeGroups]);

        // Prepare data
        const groupImages = allImages.slice(i * 4, i * 4 + 4);
        const now = new Date();
        const timeStr = format(now, "yyyy-MM-dd HH:mm:ss");
        const postBody = `${baseText}\n\n${timeStr}`;

        try {
          // Convert images to base64
          const base64Images = await Promise.all(
            groupImages.map((img) => readFileAsDataURL(img.file))
          );

          // Call API
          const response = await postTweet(postBody, base64Images);

          // Success
          activeGroups[i] = { ...activeGroups[i], status: "success" };
          setGroups([...activeGroups]);

          // Add to history
          const thumbnail = await resizeThumbnail(groupImages[0].file);

          addToHistory({
            id: response.postId,
            text: postBody,
            timestamp: now.toISOString(),
            postUrl: response.postUrl,
            thumbnail: thumbnail,
          });
        } catch (error: unknown) {
          const err = error as Error;
          console.error(err);
          hasAnyError = true;

          // Retry logic
          if (activeGroups[i].retryCount < 5) {
            console.log(
              `Retrying group ${i}... attempt ${activeGroups[i].retryCount + 1}`
            );
            activeGroups[i].retryCount += 1;
            i--; // Stay on this index
            setGroups([...activeGroups]);
            await delay(1000 * Math.pow(2, activeGroups[i].retryCount)); // Exponential backoff
            continue; // Retry loop
          } else {
            // Failed after retries
            activeGroups[i] = {
              ...activeGroups[i],
              status: "failed",
              error: err.message || "Unknown error",
            };
            setGroups([...activeGroups]);
          }
        }

        // Wait 5 seconds before next group
        if (i < activeGroups.length - 1) {
          await delay(5000);
        }
      }

      // 全グループ処理完了後
      const allFailed = activeGroups.every((g) => g.status === "failed");
      const anyFailed = activeGroups.some((g) => g.status === "failed");

      if (allFailed || (hasAnyError && anyFailed)) {
        // エラーがあった場合はカウントダウン後にボタン再活性化
        // isPosting は true のまま維持し、カウントダウン終了時に false にする
        startErrorCountdown(ERROR_TIMEOUT_SEC);
      } else {
        // 全て成功 or エラーなしで完了
        setIsPosting(false);
      }
    },
    [addToHistory, startErrorCountdown]
  );

  const startPosting = useCallback(
    async (text: string, images: ImageFile[]) => {
      if (images.length === 0) return;

      // 既存のカウントダウンがあればクリア
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setErrorCountdown(0);

      const initialGroups = createGroups(images);
      setGroups(initialGroups);
      setCurrentGroupIndex(0);

      setIsPosting(true);
      // Start the process immediately
      processGroups(initialGroups, text, images);
    },
    [createGroups, processGroups]
  );

  return {
    isPosting,
    groups,
    currentGroupIndex,
    history,
    errorCountdown,
    startPosting,
    deleteHistory,
    clearHistory,
  };
};
