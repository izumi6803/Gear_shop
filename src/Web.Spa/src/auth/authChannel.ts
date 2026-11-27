// Đồng bộ phiên giữa các tab.
//
// sessionStorage là per-tab, nên nếu tab A đang là admin còn tab B đăng nhập
// sales, tab A vẫn hiển thị admin mãi → người dùng thấy "vẫn là admin".
// Mỗi tab phát/thu một message: tab nào đăng nhập bằng tài khoản KHÁC thì các
// tab còn lại tự kết thúc phiên của mình (giữ nguyên tính tab-scoped của token).
const CHANNEL = 'stockflow-auth';

export type AuthEventKind = 'login' | 'logout';

export interface AuthEventMessage {
  tabId: string;
  kind: AuthEventKind;
  username?: string;
}

export const TAB_ID = Math.random().toString(36).slice(2, 10);

const supported = typeof BroadcastChannel !== 'undefined';

export function broadcastAuth(kind: AuthEventKind, username?: string): void {
  if (!supported) {
    return;
  }
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ tabId: TAB_ID, kind, username } satisfies AuthEventMessage);
    channel.close();
  } catch {
    // trình duyệt chặn BroadcastChannel: bỏ qua, phiên vẫn đúng trong tab này
  }
}

/** Trả về hàm unsubscribe. */
export function subscribeAuth(onMessage: (message: AuthEventMessage) => void): () => void {
  if (!supported) {
    return () => {};
  }
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<AuthEventMessage>) => {
    const data = event.data;
    if (data && data.tabId !== TAB_ID) {
      onMessage(data);
    }
  };
  return () => channel.close();
}
