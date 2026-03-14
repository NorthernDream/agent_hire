import { useState, useEffect } from 'react'
import { config } from '../config'

export interface TokenInfo {
  symbol: string
  contract: string
}

export interface ChainInfo {
  chainId: number
  name: string
  tokens: TokenInfo[]
}

export interface MerchantConfig {
  merchantId: string
  merchantName: string
  chains: ChainInfo[]
}

export function useConfig() {
  const [merchantConfig, setMerchantConfig] = useState<MerchantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${config.apiUrl}/config`)
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || `HTTP ${response.status}`)
        }

        setMerchantConfig(await response.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load config')
      } finally {
        setLoading(false)
      }
    }

    void fetchConfig()
  }, [])

  return {
    merchantConfig,
    loading,
    error,
  }
}
