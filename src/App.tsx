import { useEffect, useMemo, useState } from 'react'
import { ConnectWallet } from './components/ConnectWallet'
import { config } from './config'
import { useConfig } from './hooks/useConfig'
import { useGoatX402 } from './hooks/useGoatX402'
import { useWallet } from './hooks/useWallet'
import { PresentationPage } from './PresentationPage'

interface AgentQuote {
  agentId: string
  agentName: string
  role: string
  identity: string
  identityStatus: string
  identityExplorer?: string
  price: string
  paymentPrice: string
  pitch: string
  turnaroundMinutes: number
  chainId: number
  tokenSymbol: string
  tokenContract: string
}

interface ExecutionResult {
  agentId: string
  agentName: string
  completedAt: string
  report: string
  highlights: string[]
}

interface SettlementRecord {
  orderId: string
  status: string
  txHash?: string
  confirmedAt?: string
  chainId: number
  tokenSymbol: string
  amountWei: string
}

interface TaskRecord {
  taskId: string
  title: string
  description: string
  budget: string
  status: string
  createdAt: string
  quotes: AgentQuote[]
  selectedQuoteId?: string
  orderId?: string
  execution?: ExecutionResult
  settlement?: SettlementRecord
}

function App() {
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/'

  if (currentPath === '/presentation') {
    return <PresentationPage />
  }
  const wallet = useWallet()
  const goatx402 = useGoatX402(wallet.signer)
  const { merchantConfig, loading: configLoading, error: configError } = useConfig()

  const [title, setTitle] = useState('Research and summarize the latest Bitcoin L2 hiring trends')
  const [description, setDescription] = useState(
    'Find current hiring patterns for Bitcoin L2 projects and return a concise summary for a founder update.'
  )
  const [budget, setBudget] = useState('5')
  const [task, setTask] = useState<TaskRecord | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [loadingTask, setLoadingTask] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)

  const selectedQuote = useMemo(() => {
    if (!task?.selectedQuoteId) {
      return null
    }

    return task.quotes.find((quote) => quote.agentId === task.selectedQuoteId) || null
  }, [task])

  const isWrongChain = !!selectedQuote && wallet.chainId !== null && wallet.chainId !== selectedQuote.chainId

  useEffect(() => {
    const fetchBalance = async () => {
      if (!wallet.isConnected || !selectedQuote || isWrongChain) {
        setBalance(null)
        return
      }

      setBalance(await goatx402.getBalance(selectedQuote.tokenContract))
    }

    void fetchBalance()
  }, [goatx402, isWrongChain, selectedQuote, wallet.isConnected])

  const createTask = async () => {
    try {
      setLoadingTask(true)
      setTaskError(null)
      goatx402.reset()

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          budget,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      setTask(data)
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setLoadingTask(false)
    }
  }

  const selectAgent = async (agentId: string) => {
    if (!task) {
      return
    }

    try {
      setTaskError(null)
      goatx402.reset()

      const response = await fetch(`/api/tasks/${task.taskId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      setTask(data)
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Failed to select agent')
    }
  }

  const executeTask = async () => {
    if (!task) {
      return
    }

    try {
      setExecuting(true)
      setTaskError(null)

      const response = await fetch(`/api/tasks/${task.taskId}/execute`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      setTask(data)
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Failed to execute task')
    } finally {
      setExecuting(false)
    }
  }

  const payForSelectedAgent = async () => {
    if (!task || !selectedQuote) {
      return
    }

    if (wallet.chainId !== selectedQuote.chainId) {
      await wallet.switchChain(selectedQuote.chainId)
      return
    }

    const result = await goatx402.pay({
      chainId: selectedQuote.chainId,
      tokenContract: selectedQuote.tokenContract,
      tokenSymbol: selectedQuote.tokenSymbol,
      amount: selectedQuote.paymentPrice,
      taskId: task.taskId,
      agentId: selectedQuote.agentId,
    })

    if (result?.success) {
      await executeTask()
    }
  }

  const resetFlow = () => {
    setTask(null)
    setTaskError(null)
    setBalance(null)
    goatx402.reset()
  }

  const settlementExplorer =
    task?.settlement?.txHash && task.settlement.chainId in config.chains
      ? `${config.chains[task.settlement.chainId].explorerUrl}/tx/${task.settlement.txHash}`
      : null

  return (
    <div className="min-h-screen px-4 py-8 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur">
            <p className="mb-3 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-amber-200">
              Agent Hire Market
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white">
              发布任务等待 AI 接单
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
              平台会根据任务内容返回候选 Agent 报价。支付走 x402，执行结果和结算记录保存在内存中，适合 3 分钟演示。
            </p>
            <div className="mt-6 grid gap-3 text-sm text-stone-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-stone-900/70 p-4">
                <div className="text-stone-500">Merchant</div>
                <div className="mt-1 font-medium text-stone-100">
                  {merchantConfig?.merchantName || 'agent_hire'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-stone-900/70 p-4">
                <div className="text-stone-500">Network</div>
                <div className="mt-1 font-medium text-stone-100">GOAT Bitcoin L2 Testnet</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-stone-900/70 p-4">
                <div className="text-stone-500">Settlement</div>
                <div className="mt-1 font-medium text-stone-100">x402 Direct Transfer</div>
              </div>
            </div>
          </div>

          <ConnectWallet
            isConnected={wallet.isConnected}
            address={wallet.address}
            chainId={wallet.chainId}
            loading={wallet.loading}
            error={wallet.error}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </section>

        {(configError || taskError || goatx402.error || wallet.error) && (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {configError || taskError || goatx402.error || wallet.error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">1. 发布任务</h2>
                <p className="text-sm text-stone-400">填写任务和预算后，系统会立即返回候选 Agent 报价。</p>
              </div>
              <button
                onClick={resetFlow}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-stone-300 transition hover:bg-white/5"
              >
                Reset Demo
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-stone-300">任务标题</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-stone-100 outline-none transition focus:border-amber-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-stone-300">任务描述</label>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-stone-100 outline-none transition focus:border-sky-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-stone-300">预算</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 pr-24 text-stone-100 outline-none transition focus:border-emerald-400/60"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                    {task?.quotes[0]?.tokenSymbol || merchantConfig?.chains[0]?.tokens[0]?.symbol || 'TOKEN'}
                  </span>
                </div>
              </div>

              <button
                onClick={createTask}
                disabled={loadingTask || configLoading || !title.trim() || !description.trim() || Number(budget) <= 0}
                className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-semibold text-stone-950 transition hover:bg-amber-300 disabled:opacity-50"
              >
                {loadingTask ? 'Generating bids...' : 'Generate Agent Bids'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="text-2xl font-semibold text-white">2. 选择 Agent</h2>
              <p className="mt-1 text-sm text-stone-400">系统会返回不同策略的候选 Agent 报价。</p>

              {!task && (
                <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-stone-500">
                  还没有任务。先在左侧创建任务，系统会生成候选 Agent 报价。
                </div>
              )}

              {task && (
                <div className="mt-6 grid gap-4">
                  {task.quotes.map((quote) => {
                    const isSelected = task.selectedQuoteId === quote.agentId
                    return (
                      <div
                        key={quote.agentId}
                        className={`rounded-3xl border p-5 transition ${
                          isSelected
                            ? 'border-amber-300 bg-amber-400/10'
                            : 'border-white/10 bg-stone-900/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-semibold text-white">{quote.agentName}</div>
                            <div className="text-sm text-stone-400">{quote.role}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-semibold text-emerald-300">
                              {quote.price} {quote.tokenSymbol}
                            </div>
                            <div className="text-xs text-stone-500">{quote.turnaroundMinutes} min ETA</div>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-6 text-stone-300">{quote.pitch}</p>
                        <div className="mt-4 rounded-2xl bg-black/20 p-3 text-xs text-stone-400">
                          <div>
                            ERC-8004 Identity:{' '}
                            <span className="font-mono text-stone-200">{quote.identity}</span>
                          </div>
                          <div className="mt-2">
                            Status: <span className="text-stone-200">{quote.identityStatus}</span>
                          </div>
                          {quote.identityExplorer && (
                            <a
                              href={quote.identityExplorer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block break-all text-sky-300 hover:underline"
                            >
                              View registration on explorer
                            </a>
                          )}
                        </div>

                        <button
                          onClick={() => selectAgent(quote.agentId)}
                          className={`mt-4 w-full rounded-2xl px-4 py-3 font-medium transition ${
                            isSelected
                              ? 'bg-amber-400 text-stone-950'
                              : 'border border-white/10 bg-white/5 text-stone-100 hover:bg-white/10'
                          }`}
                        >
                          {isSelected ? 'Selected for payment' : 'Choose this Agent'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="text-2xl font-semibold text-white">3. 付款与执行</h2>
              {!selectedQuote ? (
                <p className="mt-4 text-sm text-stone-500">请先选择一个 Agent。</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-stone-900/70 p-4 text-sm text-stone-300">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-white">{selectedQuote.agentName}</div>
                        <div>
                          Network: {config.chains[selectedQuote.chainId]?.name || selectedQuote.chainId}
                        </div>
                        <div>Token: {selectedQuote.tokenSymbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-emerald-300">
                          {selectedQuote.price} {selectedQuote.tokenSymbol}
                        </div>
                        <div className="text-xs text-stone-500">
                          Demo payment: {selectedQuote.paymentPrice} {selectedQuote.tokenSymbol}
                        </div>
                        <div className="text-xs text-stone-500">
                          Balance: {balance ?? '--'} {selectedQuote.tokenSymbol}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isWrongChain && (
                    <p className="text-sm text-amber-200">
                      当前钱包网络不是 GOAT Testnet。点击下面按钮后会尝试切换到链 {selectedQuote.chainId}。
                    </p>
                  )}

                  <button
                    onClick={payForSelectedAgent}
                    disabled={goatx402.loading || executing || !wallet.isConnected}
                    className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-stone-950 transition hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {goatx402.loading
                      ? 'Processing x402 payment...'
                      : isWrongChain
                        ? `Switch wallet to chain ${selectedQuote.chainId}`
                        : `Pay ${selectedQuote.paymentPrice} ${selectedQuote.tokenSymbol}`}
                  </button>

                  {!wallet.isConnected && (
                    <p className="text-sm text-stone-500">连接钱包后才能发起付款。</p>
                  )}

                  {goatx402.order && (
                    <div className="rounded-2xl border border-white/10 bg-stone-900/70 p-4 text-sm text-stone-300">
                      <div className="font-medium text-white">Order</div>
                      <div className="mt-2 break-all font-mono text-xs">{goatx402.order.orderId}</div>
                      <div className="mt-2">Pay To: {goatx402.order.payToAddress}</div>
                      {goatx402.paymentResult?.txHash && (
                        <div className="mt-2 break-all font-mono text-xs">
                          TX: {goatx402.paymentResult.txHash}
                        </div>
                      )}
                      {goatx402.orderStatus && (
                        <div className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-stone-200">
                          {goatx402.orderStatus.status}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-semibold text-white">4. Agent 交付结果</h2>
            {!task?.execution ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-stone-500">
                完成付款后，系统会调用选中的 Agent 并在这里展示执行结果。
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="text-sm text-stone-400">
                  Delivered by <span className="text-white">{task.execution.agentName}</span> at{' '}
                  {new Date(task.execution.completedAt).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap rounded-2xl bg-stone-900/70 p-4 text-sm leading-7 text-stone-200">
                  {task.execution.report}
                </div>
                <div className="grid gap-3">
                  {task.execution.highlights.map((highlight) => (
                    <div key={highlight} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-stone-300">
                      {highlight}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-semibold text-white">5. 链上结算记录</h2>
            {!task?.settlement ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-stone-500">
                付款确认后，这里会显示订单状态、交易哈希和确认时间。
              </div>
            ) : (
              <div className="mt-4 space-y-4 text-sm text-stone-300">
                <div className="rounded-2xl bg-stone-900/70 p-4">
                  <div>Status: {task.settlement.status}</div>
                  <div className="mt-2">Order ID: {task.settlement.orderId}</div>
                  <div className="mt-2">
                    Amount: {selectedQuote?.paymentPrice || '0.01'} {task.settlement.tokenSymbol}
                  </div>
                  {task.settlement.confirmedAt && (
                    <div className="mt-2">
                      Confirmed: {new Date(task.settlement.confirmedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                {task.settlement.txHash && (
                  <a
                    href={settlementExplorer || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 font-mono text-xs text-sky-200"
                  >
                    {task.settlement.txHash}
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App

