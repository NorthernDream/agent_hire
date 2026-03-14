import { signRequest } from './signature.js'
import type {
  GoatX402Config,
  CreateOrderParams,
  Order,
  OrderProof,
  OrderProofResponse,
  MerchantInfo,
  GoatX402Error,
  PaymentFlow,
  OrderStatus,
  X402PaymentRequired,
} from './types.js'
import { fromCAIP2 } from './types.js'

export class GoatX402Client {
  private baseUrl: string
  private apiKey: string
  private apiSecret: string

  constructor(config: GoatX402Config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.apiSecret = config.apiSecret
  }

  async createOrder(params: CreateOrderParams): Promise<Order> {
    const x402Response = await this.createOrderRaw(params)
    return this.parseX402ToOrder(x402Response, params)
  }

  async createOrderRaw(params: CreateOrderParams): Promise<X402PaymentRequired> {
    const body: Record<string, unknown> = {
      dapp_order_id: params.dappOrderId,
      chain_id: params.chainId,
      token_symbol: params.tokenSymbol,
      from_address: params.fromAddress,
      amount_wei: params.amountWei,
    }

    if (params.tokenContract) {
      body.token_contract = params.tokenContract
    }
    if (params.callbackCalldata) {
      body.callback_calldata = params.callbackCalldata
    }

    return this.request<X402PaymentRequired>('POST', '/api/v1/orders', body)
  }

  private parseX402ToOrder(x402: X402PaymentRequired, params: CreateOrderParams): Order {
    const opt = x402.accepts?.[0]
    let flow = x402.flow
    if (!flow && opt?.extra?.flow) {
      flow = opt.extra.flow
    }

    let tokenSymbol = x402.token_symbol
    if (!tokenSymbol && opt?.extra?.tokenSymbol) {
      tokenSymbol = opt.extra.tokenSymbol
    }

    let fromChainId = opt ? fromCAIP2(opt.network) : 0
    let payToChainId = x402.extensions?.goatx402?.destinationChain
      ? fromCAIP2(x402.extensions.goatx402.destinationChain)
      : 0

    if (!fromChainId && params.chainId) {
      fromChainId = params.chainId
    }

    return {
      orderId: x402.order_id,
      flow: (flow || 'ERC20_DIRECT') as PaymentFlow,
      tokenSymbol: tokenSymbol || params.tokenSymbol,
      tokenContract: opt?.asset || params.tokenContract || '',
      payToAddress: opt?.payTo || '',
      fromChainId,
      payToChainId,
      amountWei: opt?.amount || params.amountWei,
      expiresAt: x402.extensions?.goatx402?.expiresAt || 0,
      calldataSignRequest: x402.calldata_sign_request,
      x402,
    }
  }

  async getOrderStatus(orderId: string): Promise<OrderProof> {
    const data = await this.request<{
      order_id: string
      merchant_id: string
      dapp_order_id: string
      chain_id: number
      token_contract: string
      token_symbol: string
      from_address: string
      amount_wei: string
      status: string
      tx_hash?: string
      confirmed_at?: string
    }>('GET', `/api/v1/orders/${orderId}`)

    return {
      orderId: data.order_id,
      merchantId: data.merchant_id,
      dappOrderId: data.dapp_order_id,
      chainId: data.chain_id,
      tokenContract: data.token_contract,
      tokenSymbol: data.token_symbol,
      fromAddress: data.from_address,
      amountWei: data.amount_wei,
      status: data.status as OrderStatus,
      txHash: data.tx_hash,
      confirmedAt: data.confirmed_at,
    }
  }

  async getOrderProof(orderId: string): Promise<OrderProofResponse> {
    return this.request('GET', `/api/v1/orders/${orderId}/proof`)
  }

  async submitCalldataSignature(orderId: string, signature: string): Promise<void> {
    await this.request('POST', `/api/v1/orders/${orderId}/calldata-signature`, { signature })
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request('POST', `/api/v1/orders/${orderId}/cancel`, {})
  }

  async getMerchant(merchantId: string): Promise<MerchantInfo> {
    const data = await this.publicRequest<{
      merchant_id: string
      name?: string
      logo?: string
      receive_type: string
      wallets: Array<{
        address: string
        chain_id: number
        token_symbol: string
        token_contract: string
      }>
    }>(`/merchants/${merchantId}`)

    return {
      merchantId: data.merchant_id,
      name: data.name || data.merchant_id,
      logo: data.logo,
      receiveType: data.receive_type as 'DIRECT' | 'DELEGATE',
      supportedTokens:
        data.wallets?.map((w) => ({
          chainId: w.chain_id,
          symbol: w.token_symbol,
          tokenContract: w.token_contract,
        })) || [],
    }
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const authHeaders = signRequest(body || {}, this.apiKey, this.apiSecret)

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const responseText = await response.text()
    let data: Record<string, unknown> = {}
    try {
      data = JSON.parse(responseText) as Record<string, unknown>
    } catch {
      // noop
    }

    if (!response.ok && response.status !== 402) {
      const errorMessage =
        (data.error as string) ||
        (data.message as string) ||
        (Object.keys(data).length > 0 ? JSON.stringify(data) : null) ||
        responseText ||
        `HTTP ${response.status}`
      const error = new Error(errorMessage) as GoatX402Error & { responseBody?: string }
      error.name = 'GoatX402Error'
      error.code = data.code as string | undefined
      error.status = response.status
      error.responseBody = responseText
      throw error
    }

    return data as T
  }

  private async publicRequest<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      const error = new Error((data.error as string) || `HTTP ${response.status}`) as GoatX402Error
      error.name = 'GoatX402Error'
      error.code = data.code as string | undefined
      error.status = response.status
      throw error
    }

    return data as T
  }
}
