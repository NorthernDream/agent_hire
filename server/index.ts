import cors from 'cors'
import express from 'express'
import { GoatX402Client } from './lib/goatx402-server/index.js'
import 'dotenv/config'

interface MerchantToken {
  chainId: number
  symbol: string
  tokenContract: string
}

interface AgentDefinition {
  id: string
  name: string
  role: string
  identity: string
  identityStatus: string
  identityExplorer?: string
  pitchPrefix: string
  pricingMultiplier: number
  turnaroundMinutes: number
}

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

const app = express()
const port = Number(process.env.PORT || 3003)

app.use(cors())
app.use(express.json())

const goatx402Client = new GoatX402Client({
  baseUrl: process.env.GOATX402_API_URL || 'http://localhost:8286',
  apiKey: process.env.GOATX402_API_KEY || '',
  apiSecret: process.env.GOATX402_API_SECRET || '',
})

const merchantId = process.env.GOATX402_MERCHANT_ID || 'agent_hire'
const tasks = new Map<string, TaskRecord>()

const agents: AgentDefinition[] = [
  {
    id: 'agent-search-alpha',
    name: 'Agent A / Search Scout',
    role: 'Search Specialist',
    identity: 'ERC-8004 Agent ID #177',
    identityStatus: 'Registered',
    identityExplorer:
      'https://explorer.testnet3.goat.network/tx/0xbfdb74d56d282c0ae5a308428e77f96853fe6096fd9401315ed12cad5cb7303c',
    pitchPrefix: 'I will search, extract signals, and deliver a structured list of findings.',
    pricingMultiplier: 0.62,
    turnaroundMinutes: 6,
  },
  {
    id: 'agent-summary-beta',
    name: 'Agent B / Summary Smith',
    role: 'Summary Specialist',
    identity: 'ERC-8004 Agent ID pending',
    identityStatus: 'Pending registration',
    pitchPrefix: 'I will compress the task into an executive-ready output with tighter storytelling.',
    pricingMultiplier: 0.84,
    turnaroundMinutes: 4,
  },
]

async function loadMerchant() {
  return goatx402Client.getMerchant(merchantId)
}

async function getPreferredToken(): Promise<MerchantToken> {
  const merchant = await loadMerchant()
  const tokens = merchant.supportedTokens as MerchantToken[]
  const preferred = tokens.find((token) => token.chainId === 48816) || tokens[0]

  if (!preferred) {
    throw new Error('Merchant has no supported tokens configured')
  }

  return preferred
}

function toAmount(value: number) {
  return value.toFixed(2).replace(/\.00$/, '')
}

function buildQuotes(description: string, budget: number, paymentToken: MerchantToken): AgentQuote[] {
  const safeBudget = Math.max(Number.isFinite(budget) ? budget : 0, 0.5)
  const demoPaymentPrice = 0.01

  return agents.map((agent) => {
    const quotedPrice = Math.max(0.2, Math.min(safeBudget, safeBudget * agent.pricingMultiplier))
    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      identity: agent.identity,
      identityStatus: agent.identityStatus,
      identityExplorer: agent.identityExplorer,
      price: toAmount(quotedPrice),
      paymentPrice: toAmount(demoPaymentPrice),
      pitch: `${agent.pitchPrefix} Scope detected: ${description.slice(0, 120)}${description.length > 120 ? '...' : ''}`,
      turnaroundMinutes: agent.turnaroundMinutes,
      chainId: paymentToken.chainId,
      tokenSymbol: paymentToken.symbol,
      tokenContract: paymentToken.tokenContract,
    }
  })
}

function getTaskOrThrow(taskId: string) {
  const task = tasks.get(taskId)
  if (!task) {
    throw new Error('Task not found')
  }

  return task
}

function selectedQuoteOrThrow(task: TaskRecord) {
  const quote = task.quotes.find((item) => item.agentId === task.selectedQuoteId)
  if (!quote) {
    throw new Error('Selected quote not found')
  }

  return quote
}

async function syncSettlement(task: TaskRecord) {
  if (!task.orderId) {
    return task
  }

  const order = await goatx402Client.getOrderStatus(task.orderId)
  task.settlement = {
    orderId: order.orderId,
    status: order.status,
    txHash: order.txHash,
    confirmedAt: order.confirmedAt,
    chainId: order.chainId,
    tokenSymbol: order.tokenSymbol,
    amountWei: order.amountWei,
  }

  if (order.status === 'PAYMENT_CONFIRMED' && task.status === 'PAYMENT_PENDING') {
    task.status = 'PAID'
  }

  return task
}

function runAgent(task: TaskRecord, quote: AgentQuote): ExecutionResult {
  const keywords = task.description
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((word) => word.replace(/[^\w-]/g, ''))
    .filter(Boolean)

  if (quote.agentId === 'agent-search-alpha') {
    return {
      agentId: quote.agentId,
      agentName: quote.agentName,
      completedAt: new Date().toISOString(),
      report: [
        `Search run for: ${task.title}`,
        `1. Market signal: projects discussing ${keywords[0] || 'the topic'} are prioritizing fast execution and verifiable settlement.`,
        '2. Supply signal: teams increasingly separate research agents from summary agents to improve demo clarity.',
        '3. Delivery signal: buyers want a short final artifact they can forward internally without editing.',
      ].join('\n'),
      highlights: [
        `Primary keyword cluster: ${keywords.join(', ') || 'general research'}`,
        'Recommended deliverable: a 5-point opportunity map plus one action memo.',
        'Suggested next hire: add a follow-up execution agent after payment confirmation.',
      ],
    }
  }

  return {
    agentId: quote.agentId,
    agentName: quote.agentName,
    completedAt: new Date().toISOString(),
    report: [
      `Executive summary for: ${task.title}`,
      'The demand pattern is clear: buyers prefer specialized agents with transparent pricing and immediate settlement.',
      `Your task should be positioned as a ${keywords[0] || 'focused'} analysis with a concise decision memo at the end.`,
      'For the next iteration, add persistent history and real external search to replace the mocked execution layer.',
    ].join('\n\n'),
    highlights: [
      'Narrative optimized for founder or operator updates.',
      `Budget-to-output fit is strongest below ${task.budget} ${quote.tokenSymbol}.`,
      'The current marketplace flow is demo-ready and can be extended into multi-agent routing.',
    ],
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/config', async (_req, res) => {
  try {
    const merchant = await loadMerchant()
    const chains: Record<number, { chainId: number; name: string; tokens: Array<{ symbol: string; contract: string }> }> = {}
    const chainNames: Record<number, string> = {
      97: 'BSC Testnet',
      56: 'BSC Mainnet',
      48816: 'Goat Testnet',
      1: 'Ethereum',
      137: 'Polygon',
    }

    for (const token of merchant.supportedTokens as MerchantToken[]) {
      if (!chains[token.chainId]) {
        chains[token.chainId] = {
          chainId: token.chainId,
          name: chainNames[token.chainId] || `Chain ${token.chainId}`,
          tokens: [],
        }
      }

      chains[token.chainId].tokens.push({
        symbol: token.symbol,
        contract: token.tokenContract,
      })
    }

    res.json({
      merchantId: merchant.merchantId,
      merchantName: merchant.name,
      chains: Object.values(chains),
    })
  } catch (error) {
    console.error('Get config error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load merchant config',
    })
  }
})

app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, budget } = req.body as {
      title?: string
      description?: string
      budget?: string
    }

    if (!title?.trim() || !description?.trim() || !budget || Number(budget) <= 0) {
      return res.status(400).json({ error: 'title, description, and positive budget are required' })
    }

    const paymentToken = await getPreferredToken()
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const task: TaskRecord = {
      taskId,
      title: title.trim(),
      description: description.trim(),
      budget,
      status: 'BIDDING',
      createdAt: new Date().toISOString(),
      quotes: buildQuotes(description.trim(), Number(budget), paymentToken),
    }

    tasks.set(taskId, task)
    res.json(task)
  } catch (error) {
    console.error('Create task error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create task',
    })
  }
})

app.get('/api/tasks/:taskId', async (req, res) => {
  try {
    const task = getTaskOrThrow(req.params.taskId)
    await syncSettlement(task)
    res.json(task)
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Task not found',
    })
  }
})

app.post('/api/tasks/:taskId/select', (req, res) => {
  try {
    const task = getTaskOrThrow(req.params.taskId)
    const { agentId } = req.body as { agentId?: string }
    const quote = task.quotes.find((item) => item.agentId === agentId)

    if (!quote) {
      return res.status(400).json({ error: 'Invalid agent selection' })
    }

    task.selectedQuoteId = quote.agentId
    task.status = 'AWAITING_PAYMENT'
    res.json(task)
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Task not found',
    })
  }
})

app.post('/api/tasks/:taskId/execute', async (req, res) => {
  try {
    const task = getTaskOrThrow(req.params.taskId)
    if (!task.orderId) {
      return res.status(400).json({ error: 'Task has not been paid yet' })
    }

    await syncSettlement(task)
    if (task.settlement?.status !== 'PAYMENT_CONFIRMED') {
      return res.status(400).json({ error: 'Payment is not confirmed yet' })
    }

    const quote = selectedQuoteOrThrow(task)
    task.execution = runAgent(task, quote)
    task.status = 'COMPLETED'
    res.json(task)
  } catch (error) {
    console.error('Execute task error:', error)
    const message = error instanceof Error ? error.message : 'Failed to execute task'
    res.status(message === 'Task not found' ? 404 : 500).json({ error: message })
  }
})

app.post('/api/orders', async (req, res) => {
  try {
    const {
      chainId,
      tokenSymbol,
      tokenContract,
      fromAddress,
      amountWei,
      callbackCalldata,
      taskId,
      agentId,
    } = req.body as {
      chainId?: number
      tokenSymbol?: string
      tokenContract?: string
      fromAddress?: string
      amountWei?: string
      callbackCalldata?: string
      taskId?: string
      agentId?: string
    }

    if (!chainId || !tokenSymbol || !tokenContract || !fromAddress || !amountWei) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (taskId) {
      const task = getTaskOrThrow(taskId)
      if (!task.selectedQuoteId || task.selectedQuoteId !== agentId) {
        return res.status(400).json({ error: 'Task does not match selected agent' })
      }
    }

    const order = await goatx402Client.createOrder({
      dappOrderId: `agent-hire-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      chainId,
      tokenSymbol,
      tokenContract,
      fromAddress,
      amountWei,
      callbackCalldata,
    })

    if (taskId) {
      const task = getTaskOrThrow(taskId)
      task.orderId = order.orderId
      task.status = 'PAYMENT_PENDING'
    }

    res.json({
      orderId: order.orderId,
      flow: order.flow,
      payToAddress: order.payToAddress,
      expiresAt: order.expiresAt,
      calldataSignRequest: order.calldataSignRequest,
      chainId,
      tokenSymbol,
      tokenContract,
      fromAddress,
      amountWei,
    })
  } catch (error: unknown) {
    console.error('Create order error:', error)
    const errObj = error as { status?: number; responseBody?: unknown }
    res.status(errObj.status || 500).json({
      error: error instanceof Error ? error.message : 'Failed to create order',
      details: errObj.responseBody,
    })
  }
})

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await goatx402Client.getOrderStatus(req.params.orderId)
    res.json(order)
  } catch (error: unknown) {
    console.error('Get order error:', error)
    res.status((error as { status?: number }).status || 500).json({
      error: error instanceof Error ? error.message : 'Failed to get order',
    })
  }
})

app.post('/api/orders/:orderId/signature', async (req, res) => {
  try {
    const { signature } = req.body as { signature?: string }
    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' })
    }

    await goatx402Client.submitCalldataSignature(req.params.orderId, signature)
    res.json({ success: true })
  } catch (error: unknown) {
    console.error('Submit signature error:', error)
    res.status((error as { status?: number }).status || 500).json({
      error: error instanceof Error ? error.message : 'Failed to submit signature',
    })
  }
})

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Agent Hire server running at http://localhost:${port}`)
  })
}

export default app
