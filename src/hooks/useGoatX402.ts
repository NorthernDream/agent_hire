declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

import { useState, useCallback, useMemo } from 'react'
import { ethers } from 'ethers'
import { PaymentHelper, formatUnits } from '../lib/goatx402/index.js'
import type { Order, PaymentResult } from '../lib/goatx402/index.js'
import { config } from '../config'

interface OrderResponse {
  orderId: string
  flow: Order['flow']
  payToAddress: string
  expiresAt: number
  calldataSignRequest?: Order['calldataSignRequest']
  chainId: number
  tokenSymbol: string
  tokenContract: string
  fromAddress: string
  amountWei: string
}

interface OrderProof {
  orderId: string
  merchantId: string
  dappOrderId: string
  chainId: number
  tokenContract: string
  tokenSymbol: string
  fromAddress: string
  amountWei: string
  status: string
  txHash?: string
  confirmedAt?: string
}

export interface PaymentParams {
  chainId: number
  tokenContract: string
  tokenSymbol: string
  amount: string
  callbackCalldata?: string
  taskId?: string
  agentId?: string
}

async function switchChain(chainId: number): Promise<void> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed')
  }

  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: `0x${chainId.toString(16)}` }],
  })
  await new Promise((resolve) => setTimeout(resolve, 500))
}

async function getFreshSigner(): Promise<ethers.Signer> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  return provider.getSigner()
}

export function useGoatX402(signer: ethers.Signer | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [orderStatus, setOrderStatus] = useState<OrderProof | null>(null)

  const paymentHelper = useMemo(() => {
    if (!signer) {
      return null
    }

    return new PaymentHelper(signer)
  }, [signer])

  const createOrder = useCallback(
    async (params: {
      chainId: number
      tokenSymbol: string
      tokenContract: string
      fromAddress: string
      amountWei: string
      callbackCalldata?: string
      taskId?: string
      agentId?: string
    }): Promise<OrderResponse> => {
      const response = await fetch(`${config.apiUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || `HTTP ${response.status}`)
      }

      return response.json()
    },
    []
  )

  const getOrderStatus = useCallback(async (orderId: string): Promise<OrderProof> => {
    const response = await fetch(`${config.apiUrl}/orders/${orderId}`)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody.error || `HTTP ${response.status}`)
    }

    return response.json()
  }, [])

  const submitSignature = useCallback(async (orderId: string, signature: string): Promise<void> => {
    const response = await fetch(`${config.apiUrl}/orders/${orderId}/signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody.error || `HTTP ${response.status}`)
    }
  }, [])

  const pollForConfirmation = useCallback(
    async (orderId: string) => {
      const startTime = Date.now()
      const timeoutMs = 2 * 60 * 1000

      while (Date.now() - startTime < timeoutMs) {
        try {
          const status = await getOrderStatus(orderId)
          setOrderStatus(status)

          if (
            status.status === 'PAYMENT_CONFIRMED' ||
            status.status === 'PAYMENT_FAILED' ||
            status.status === 'EXPIRED'
          ) {
            return status
          }
        } catch {
          // retry
        }

        await new Promise((resolve) => setTimeout(resolve, 3000))
      }

      throw new Error('Timeout waiting for confirmation')
    },
    [getOrderStatus]
  )

  const pay = useCallback(
    async (params: PaymentParams) => {
      if (!paymentHelper || !signer) {
        setError('Wallet not connected')
        return null
      }

      setLoading(true)
      setError(null)
      setPaymentResult(null)
      setOrderStatus(null)

      try {
        const fromAddress = await signer.getAddress()
        const erc20Contract = new ethers.Contract(
          params.tokenContract,
          ['function decimals() view returns (uint8)'],
          signer
        )
        const decimals = await erc20Contract.decimals()
        const amountWei = ethers.parseUnits(params.amount, decimals).toString()

        const orderResponse = await createOrder({
          chainId: params.chainId,
          tokenSymbol: params.tokenSymbol,
          tokenContract: params.tokenContract,
          fromAddress,
          amountWei,
          callbackCalldata: params.callbackCalldata,
          taskId: params.taskId,
          agentId: params.agentId,
        })

        const newOrder: Order = {
          orderId: orderResponse.orderId,
          flow: orderResponse.flow,
          tokenSymbol: orderResponse.tokenSymbol,
          tokenContract: orderResponse.tokenContract,
          fromAddress: orderResponse.fromAddress,
          payToAddress: orderResponse.payToAddress,
          chainId: orderResponse.chainId,
          amountWei: orderResponse.amountWei,
          expiresAt: orderResponse.expiresAt,
          calldataSignRequest: orderResponse.calldataSignRequest,
        }

        setOrder(newOrder)

        let activePaymentHelper = paymentHelper
        if (newOrder.calldataSignRequest) {
          const calldataChainId = newOrder.calldataSignRequest.domain.chainId
          if (calldataChainId !== newOrder.chainId) {
            await switchChain(calldataChainId)
            const targetSigner = await getFreshSigner()
            const signature = await new PaymentHelper(targetSigner).signCalldata(newOrder)
            await submitSignature(newOrder.orderId, signature)
            await switchChain(newOrder.chainId)
            activePaymentHelper = new PaymentHelper(await getFreshSigner())
          } else {
            const signature = await paymentHelper.signCalldata(newOrder)
            await submitSignature(newOrder.orderId, signature)
          }
        }

        const result = await activePaymentHelper.pay(newOrder)
        setPaymentResult(result)

        if (result.success) {
          await pollForConfirmation(newOrder.orderId)
        }

        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed'
        setError(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [createOrder, paymentHelper, pollForConfirmation, signer, submitSignature]
  )

  const getBalance = useCallback(
    async (tokenContract: string): Promise<string | null> => {
      if (!paymentHelper || !signer) {
        return null
      }

      try {
        const contract = new ethers.Contract(
          tokenContract,
          ['function decimals() view returns (uint8)'],
          signer
        )
        const decimals = await contract.decimals()
        const balance = await paymentHelper.getTokenBalance(tokenContract)
        return formatUnits(balance, decimals)
      } catch {
        return null
      }
    },
    [paymentHelper, signer]
  )

  const reset = useCallback(() => {
    setOrder(null)
    setPaymentResult(null)
    setOrderStatus(null)
    setError(null)
  }, [])

  return {
    loading,
    error,
    order,
    paymentResult,
    orderStatus,
    pay,
    getBalance,
    reset,
  }
}

