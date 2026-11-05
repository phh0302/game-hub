/** 0x1234567890abcdef... → 0x1234…cdef */
export function shortAddress(address: string) {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** Tên hiển thị: username → địa chỉ ví rút gọn → "Player-xxxx" */
export function displayName(user: { id: string; username: string | null; walletAddress: string | null }) {
  if (user.username) return user.username;
  if (user.walletAddress) return shortAddress(user.walletAddress);
  return `Player-${user.id.slice(-4)}`;
}

/** BigInt từ DB → number để trả JSON (điểm vượt 2^53 là không thực tế) */
export function toNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}
