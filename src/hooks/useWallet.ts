import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'

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

export interface WalletState {
  isConnected: boolean
  address: string | null
  chainId: number | null
  signer: ethers.Signer | null
  provider: ethers.BrowserProvider | null
}

const CHAIN_CONFIG: Record<number, {
  chainName: string
  rpcUrls: string[]
  blockExplorerUrls: string[]
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}> = {
  48816: {
    chainName: 'GOAT Testnet3',
    rpcUrls: ['https://rpc.testnet3.goat.network'],
    blockExplorerUrls: ['https://explorer.testnet3.goat.network'],
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 18,
    },
  },
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    signer: null,
    provider: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const network = await provider.getNetwork()

      setState({
        isConnected: true,
        address,
        chainId: Number(network.chainId),
        signer,
        provider,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      address: null,
      chainId: null,
      signer: null,
      provider: null,
    })
  }, [])

  const switchChain = useCallback(async (chainId: number) => {
    if (!window.ethereum) {
      setError('MetaMask is not installed')
      return false
    }

    setError(null)

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })
      return true
    } catch (err: unknown) {
      const errorCode = (err as { code?: number })?.code
      if (errorCode === 4902) {
        const chainConfig = CHAIN_CONFIG[chainId]
        if (!chainConfig) {
          setError(`Chain ${chainId} is not configured for wallet_addEthereumChain`)
          return false
        }

        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${chainId.toString(16)}`,
              chainName: chainConfig.chainName,
              rpcUrls: chainConfig.rpcUrls,
              blockExplorerUrls: chainConfig.blockExplorerUrls,
              nativeCurrency: chainConfig.nativeCurrency,
            }],
          })
          return true
        } catch (addErr) {
          setError(addErr instanceof Error ? addErr.message : `Failed to add chain ${chainId}`)
          return false
        }
      }

      setError(err instanceof Error ? err.message : `Failed to switch to chain ${chainId}`)
      return false
    }
  }, [])

  useEffect(() => {
    if (!window.ethereum?.on) {
      return
    }

    const handleAccountsChanged = async (accounts: unknown) => {
      const list = accounts as string[]
      if (list.length === 0) {
        disconnect()
        return
      }

      if (state.isConnected) {
        const provider = new ethers.BrowserProvider(window.ethereum!)
        const signer = await provider.getSigner()
        setState((prev) => ({
          ...prev,
          address: list[0],
          signer,
          provider,
        }))
      }
    }

    const handleChainChanged = async (chainIdHex: unknown) => {
      if (!state.isConnected || !window.ethereum) {
        return
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      setState((prev) => ({
        ...prev,
        chainId: parseInt(chainIdHex as string, 16),
        signer,
        provider,
      }))
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [disconnect, state.isConnected])

  return {
    ...state,
    loading,
    error,
    connect,
    disconnect,
    switchChain,
  }
}
