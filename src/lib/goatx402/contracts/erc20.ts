import { ethers } from 'ethers'

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
]

export class ERC20Token {
  private contract: ethers.Contract

  constructor(tokenAddress: string, signerOrProvider: ethers.Signer | ethers.Provider) {
    this.contract = new ethers.Contract(tokenAddress, ERC20_ABI, signerOrProvider)
  }

  async balanceOf(address: string): Promise<bigint> {
    return this.contract.balanceOf(address)
  }

  async allowance(owner: string, spender: string): Promise<bigint> {
    return this.contract.allowance(owner, spender)
  }

  async decimals(): Promise<number> {
    return this.contract.decimals()
  }

  async symbol(): Promise<string> {
    return this.contract.symbol()
  }

  async approve(spender: string, amount: bigint): Promise<ethers.TransactionResponse> {
    return this.contract.approve(spender, amount)
  }

  async transfer(to: string, amount: bigint): Promise<ethers.TransactionResponse> {
    return this.contract.transfer(to, amount)
  }
}

export function parseUnits(amount: string, decimals: number): bigint {
  return ethers.parseUnits(amount, decimals)
}

export function formatUnits(amount: bigint, decimals: number): string {
  return ethers.formatUnits(amount, decimals)
}
