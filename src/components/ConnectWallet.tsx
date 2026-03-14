interface ConnectWalletProps {
  isConnected: boolean
  address: string | null
  chainId: number | null
  loading: boolean
  error: string | null
  onConnect: () => void
  onDisconnect: () => void
}

export function ConnectWallet({
  isConnected,
  address,
  chainId,
  loading,
  error,
  onConnect,
  onDisconnect,
}: ConnectWalletProps) {
  const formatAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-100">Wallet</h2>
          {isConnected && address && (
            <div className="mt-1">
              <p className="font-mono text-sm text-stone-300">{formatAddress(address)}</p>
              <p className="text-xs text-stone-400">Chain ID: {chainId}</p>
            </div>
          )}
        </div>

        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-rose-200 transition hover:bg-rose-500/20"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={loading}
            className="rounded-full bg-amber-400 px-4 py-2 font-medium text-stone-950 transition hover:bg-amber-300 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  )
}
