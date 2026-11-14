/* 브라우저에서 그림 줄이기 : 긴 변 max px, JPEG. 올리기 전에 써서 용량과 시간을 줄인다 */
export async function shrinkImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("shrink_failed"))), "image/jpeg", quality));
}
