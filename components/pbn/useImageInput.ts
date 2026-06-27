import { useCallback, useEffect, useRef } from "react";
import { EXAMPLE_IMAGE } from "./constants";

/**
 * Owns the input canvas and the ways an image gets onto it: the default example,
 * clipboard paste and the file picker. Keeps a pristine snapshot of the loaded
 * image in `originalImageRef` because the input canvas is overwritten in-place by
 * the processing pipeline (k-means) and the before/after comparator needs the
 * untouched original.
 */
export function useImageInput(log: (msg: string) => void) {
  const inputCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalImageRef = useRef<string | null>(null);

  const drawImageToInput = useCallback((img: HTMLImageElement) => {
    const c = inputCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0);
    // snapshot the pristine image before any processing overwrites the canvas
    originalImageRef.current = c.toDataURL();
  }, []);

  const loadExample = useCallback(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => drawImageToInput(img);
    img.onerror = () => log("Unable to load example image");
    img.src = EXAMPLE_IMAGE;
  }, [drawImageToInput, log]);

  // load a default example & wire up clipboard paste
  useEffect(() => {
    loadExample();

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            drawImageToInput(img);
            URL.revokeObjectURL(url);
          };
          img.src = url;
          e.preventDefault();
          return;
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [loadExample, drawImageToInput]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => drawImageToInput(img);
        img.onerror = () => alert("Unable to load image");
        img.src = reader.result as string;
      };
      reader.readAsDataURL(files[0]);
    },
    [drawImageToInput],
  );

  return { inputCanvasRef, fileInputRef, originalImageRef, onFileChange };
}
