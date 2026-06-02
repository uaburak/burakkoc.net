import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export type UploadProgress = {
  percent: number;
  downloadURL?: string;
  error?: string;
};

/**
 * Upload a file to Firebase Storage and return its public download URL.
 *
 * @param file     The File object to upload.
 * @param path     Storage path, e.g. "projects/my-slug/image.png"
 * @param onProgress Optional callback for upload progress (0–100).
 */
export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(pct);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      },
    );
  });
}

/**
 * Generate a deterministic storage path for a block's media file.
 * e.g. "projects/my-slug/blocks/abc123/image.png"
 */
export function blockStoragePath(projectSlug: string, blockId: string, file: File): string {
  const ext = file.name.split(".").pop() ?? "bin";
  return `projects/${projectSlug}/blocks/${blockId}/${Date.now()}.${ext}`;
}
