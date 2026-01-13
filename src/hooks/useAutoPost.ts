import { useState, useEffect, useCallback } from "react";
import { readFileAsDataURL } from "../utils/imageUtils";
import type { ImageFile } from "../utils/imageUtils";
import type { PostGroup } from "../components/StatusMonitor";
import type { PostHistoryItem } from "../components/HistoryGrid";
import { postTweet } from "../services/api";
import { format } from "date-fns";

const HISTORY_KEY = "x_auto_post_history";
const MAX_HISTORY = 100;

export const useAutoPost = () => {
  const [isPosting, setIsPosting] = useState(false);
  const [groups, setGroups] = useState<PostGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [history, setHistory] = useState<PostHistoryItem[]>([]);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history on change
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const addToHistory = (item: PostHistoryItem) => {
    setHistory((prev) => {
      const newHistory = [item, ...prev];
      return newHistory.slice(0, MAX_HISTORY);
    });
  };

  const deleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const createGroups = (images: ImageFile[]): PostGroup[] => {
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
  };

  // Main Posting Logic
  const startPosting = useCallback(
    async (text: string, images: ImageFile[]) => {
      if (images.length === 0) return;

      setIsPosting(true);
      const initialGroups = createGroups(images);
      setGroups(initialGroups);
      setCurrentGroupIndex(0);

      // Start the process
      processGroups(initialGroups, text, images);
    },
    []
  );

  const processGroups = async (
    currentGroups: PostGroup[],
    baseText: string,
    allImages: ImageFile[]
  ) => {
    let activeGroups = [...currentGroups];

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

    setIsPosting(false);
  };

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

  return {
    isPosting,
    groups,
    currentGroupIndex,
    history,
    startPosting,
    deleteHistory,
    clearHistory,
  };
};
