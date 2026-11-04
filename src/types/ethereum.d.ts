// Kiểu tối thiểu cho provider EIP-1193 mà MetaMask gắn vào window.ethereum
interface EthereumProvider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: "accountsChanged", handler: (accounts: string[]) => void): void;
  on(event: "chainChanged", handler: (chainId: string) => void): void;
  removeListener(event: "accountsChanged", handler: (accounts: string[]) => void): void;
  removeListener(event: "chainChanged", handler: (chainId: string) => void): void;
}

interface Window {
  ethereum?: EthereumProvider;
}
