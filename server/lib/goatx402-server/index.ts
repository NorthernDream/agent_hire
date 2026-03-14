export { GoatX402Client } from './client.js'
export { calculateSignature, signRequest } from './signature.js'
export { toCAIP2, fromCAIP2, parseX402Header } from './types.js'

export type {
  GoatX402Config,
  CreateOrderParams,
  Order,
  OrderProof,
  OrderProofResponse,
  OrderStatus,
  PaymentFlow,
  MerchantInfo,
  MerchantToken,
  CalldataSignRequest,
  EIP712Domain,
  EIP712Type,
  GoatX402Error,
  X402PaymentRequired,
  X402PaymentOption,
  X402Resource,
  X402GoatExtension,
} from './types.js'
