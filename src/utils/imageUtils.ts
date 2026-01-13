export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

export const validateFile = (file: File): string | null => {
  if (
    !file.type.startsWith("image/jpeg") &&
    !file.type.startsWith("image/png")
  ) {
    return "JPGまたはPNG形式の画像のみアップロード可能です。";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "ファイルサイズは1枚あたり5MB以下にしてください。";
  }
  return null;
};

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
