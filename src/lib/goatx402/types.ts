export type PaymentFlow =
  | 'ERC20_DIRECT'
  | 'ERC20_3009'
  | 'ERC20_APPROVE_XFER'

export interface Order {
  orderId: string
  flow: PaymentFlow
  tokenSymbol: string
  tokenContract: string
  fromAddress: string
  payToAddress: string
  chainId: number
  amountWei: string
  expiresAt: number
  calldataSignRequest?: CalldataSignRequest
}

export type OrderStatus =
  | 'CHECKOUT_VERIFIED'
  | 'PAYMENT_CONFIRMED'
  | 'INVOICED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface EIP712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}

export interface EIP712Type {
  name: string
  type: string
}

export interface CalldataSignRequest {
  domain: EIP712Domain
  types: Record<string, EIP712Type[]>
  primaryType: string
  message: Eip3009CalldataMessage | Permit2CalldataMessage
}

export interface Eip3009CalldataMessage {
  token: string
  owner: string
  payer: string
  amount: string
  orderId: string
  calldataNonce: string
  deadline: string
  calldataHash: string
}

export interface Permit2CalldataMessage {
  permit2: string
  token: string
  owner: string
  payer: string
  amount: string
  orderId: string
  calldataNonce: string
  deadline: string
  calldataHash: string
}

export interface PaymentResult {
  success: boolean
  txHash?: string
  error?: string
}
