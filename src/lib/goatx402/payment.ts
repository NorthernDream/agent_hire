import { ethers } from 'ethers'
import { ERC20Token } from './contracts/erc20.js'
import { signTypedData } from './eip712/index.js'
import type { Order, PaymentResult } from './types.js'

export class PaymentHelper {
  private signer: ethers.Signer

  constructor(signer: ethers.Signer) {
    this.signer = signer
  }

  async getAddress(): Promise<string> {
    return this.signer.getAddress()
  }

  async pay(order: Order): Promise<PaymentResult> {
    try {
      return await this.transfer(order)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      }
    }
  }

  private async transfer(order: Order): Promise<PaymentResult> {
    const token = new ERC20Token(order.tokenContract, this.signer)
    const amount = BigInt(order.amountWei)
    const address = await this.getAddress()
    const balance = await token.balanceOf(address)
    if (balance < amount) {
      throw new Error(`Insufficient balance: have ${balance.toString()}, need ${amount.toString()}`)
    }

    const tx = await token.transfer(order.payToAddress, amount)
    const receipt = await tx.wait()
    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed')
    }

    return {
      success: true,
      txHash: receipt.hash,
    }
  }

  async signCalldata(order: Order): Promise<string> {
    if (!order.calldataSignRequest) {
      throw new Error('Order does not require calldata signature')
    }

    return signTypedData(this.signer, order.calldataSignRequest)
  }

  async getTokenBalance(tokenContract: string): Promise<bigint> {
    const token = new ERC20Token(tokenContract, this.signer)
    const address = await this.getAddress()
    return token.balanceOf(address)
  }

  async getTokenAllowance(tokenContract: string, spender: string): Promise<bigint> {
    const token = new ERC20Token(tokenContract, this.signer)
    const address = await this.getAddress()
    return token.allowance(address, spender)
  }

  async approveToken(
    tokenContract: string,
    spender: string,
    amount: bigint = ethers.MaxUint256
  ): Promise<ethers.TransactionResponse> {
    const token = new ERC20Token(tokenContract, this.signer)
    return token.approve(spender, amount)
  }

  async transferToken(
    tokenContract: string,
    to: string,
    amount: bigint
  ): Promise<ethers.TransactionResponse> {
    const token = new ERC20Token(tokenContract, this.signer)
    return token.transfer(to, amount)
  }
}
