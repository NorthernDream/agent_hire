export interface GoatX402Config {
  baseUrl: string
  apiKey: string
  apiSecret: string
}

export type PaymentFlow =
  | 'ERC20_DIRECT'
  | 'ERC20_3009'
  | 'ERC20_APPROVE_XFER'

export interface CreateOrderParams {
  dappOrderId: string
  chainId: number
  tokenSymbol: string
  tokenContract?: string
  fromAddress: string
  amountWei: string
  callbackCalldata?: string
}

export interface Order {
  orderId: string
  flow: PaymentFlow
  tokenSymbol: string
  tokenContract: string
  payToAddress: string
  fromChainId: number
  payToChainId: number
  amountWei: string
  expiresAt: number
  calldataSignRequest?: CalldataSignRequest
  x402?: X402PaymentRequired
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
  message: {
    token: string
    owner: string
    payer: string
    amount: string
    orderId: string
    calldataNonce: string
    deadline: string
    calldataHash: string
    permit2?: string
  }
}

export interface OrderProof {
  orderId: string
  merchantId: string
  dappOrderId: string
  chainId: number
  tokenContract: string
  tokenSymbol: string
  fromAddress: string
  amountWei: string
  status: OrderStatus
  txHash?: string
  confirmedAt?: string
}

export interface OrderProofResponse {
  payload: {
    order_id: string
    tx_hash: string
    log_index: number
    from_addr: string
    to_addr: string
    amount_wei: string
    chain_id: number
    flow: string
  }
  signature: string
}

export interface MerchantInfo {
  merchantId: string
  name: string
  logo?: string
  receiveType: 'DIRECT' | 'DELEGATE'
  supportedTokens: MerchantToken[]
}

export interface MerchantToken {
  chainId: number
  symbol: string
  tokenContract: string
}

export class GoatX402Error extends Error {
  code?: string
  status?: number
}

export interface X402Resource {
  url: string
  description?: string
  mimeType?: string
}

export interface X402PaymentOption {
  scheme: string
  network: string
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  extra?: {
    flow?: string
    tokenSymbol?: string
    eip712Domain?: EIP712Domain
    eip712Types?: Record<string, EIP712Type[]>
    eip712PrimaryType?: string
    eip712Message?: Record<string, unknown>
    [key: string]: unknown
  }
}

export interface X402GoatExtension {
  destinationChain: string
  expiresAt: number
  signatureEndpoint?: string
  paymentMethod: 'transfer' | 'eip3009-signature'
  receiveType?: 'DIRECT' | 'DELEGATE' | 'VERIFY'
}

export interface X402PaymentRequired {
  x402Version: number
  error?: string
  resource: X402Resource
  accepts: X402PaymentOption[]
  extensions?: {
    goatx402?: X402GoatExtension
    [key: string]: unknown
  }
  order_id: string
  flow: string
  token_symbol: string
  calldata_sign_request?: CalldataSignRequest
}

export function toCAIP2(chainId: number): string {
  return `eip155:${chainId}`
}

export function fromCAIP2(network: string): number {
  const match = network.match(/^eip155:(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

export function parseX402Header(headerValue: string): X402PaymentRequired | null {
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8')
    return JSON.parse(decoded) as X402PaymentRequired
  } catch {
    return null
  }
}
