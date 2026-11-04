/** 0x1234567890abcdef... → 0x1234…cdef */
export function shortAddress(address: string) {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** Tên hiển thị: username nếu có, không thì địa chỉ ví rút gọn */
export function displayName(user: { username: string | null; walletAddress: string }) {
  return user.username || shortAddress(user.walletAddress);
}
