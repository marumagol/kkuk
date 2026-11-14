/*
  화면에서 서버 동작(저장, 삭제)을 부를 때 감싸는 도구
  인터넷이 끊겨 요청이 실패하면 오류 문구를 돌려줘서, 입력한 내용은 그대로 두고 안내만 보여 준다
  (페이지 이동 같은 다른 오류는 그대로 던진다)
*/
export const OFFLINE_MESSAGE = "인터넷 연결을 확인해 주세요. 입력한 내용은 그대로 있어요";

export async function safeCall<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { error: OFFLINE_MESSAGE };
  try {
    return await fn();
  } catch (e) {
    if ((typeof navigator !== "undefined" && navigator.onLine === false) || e instanceof TypeError) return { error: OFFLINE_MESSAGE };
    throw e;
  }
}
