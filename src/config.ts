export const config = {
  apiUrl: '/api',
  chains: {
    1: { name: 'Ethereum', explorerUrl: 'https://etherscan.io' },
    56: { name: 'BSC Mainnet', explorerUrl: 'https://bscscan.com' },
    97: { name: 'BSC Testnet', explorerUrl: 'https://testnet.bscscan.com' },
    137: { name: 'Polygon', explorerUrl: 'https://polygonscan.com' },
    48816: { name: 'Goat Testnet', explorerUrl: 'https://explorer.testnet3.goat.network' },
  } as Record<number, { name: string; explorerUrl: string }>,
}
