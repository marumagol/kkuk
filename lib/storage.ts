/* 공개 저장소 주소 (서버, 브라우저 둘 다) */
/* 프로필 사진 (공개 저장소 avatars, <내 id>/<그림 id>.jpg) */
export const AVATAR_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
export const avatarUrl = (path?: string | null) => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return path && base && AVATAR_PATH.test(path) ? `${base}/storage/v1/object/public/avatars/${path}` : null;
};
