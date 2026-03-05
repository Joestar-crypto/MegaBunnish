import { CATEGORY } from './config.js';

// Internal methodId mapping for fast classification.
// Keys are 4-byte function selectors.
export const KNOWN_METHODS = {
  // --- DEX / swaps ---
  '0x38ed1739': { name: 'swapExactTokensForTokens', category: CATEGORY.dex },
  '0x18cbafe5': { name: 'swapExactETHForTokens', category: CATEGORY.dex },
  '0x7ff36ab5': { name: 'swapExactETHForTokensSupportingFeeOnTransferTokens', category: CATEGORY.dex },
  '0x4a25d94a': { name: 'swapTokensForExactETH', category: CATEGORY.dex },
  '0x414bf389': { name: 'exactInputSingle', category: CATEGORY.dex },
  '0x04e45aaf': { name: 'exactInput', category: CATEGORY.dex },
  '0x09b81346': { name: 'exactOutputSingle', category: CATEGORY.dex },

  // --- Lending / borrowing ---
  '0xe8eda9df': { name: 'deposit', category: CATEGORY.lending },
  '0xf2b9fdb8': { name: 'withdraw', category: CATEGORY.lending },
  '0xa415bcad': { name: 'borrow', category: CATEGORY.lending },
  '0x573ade81': { name: 'repayBorrow', category: CATEGORY.lending },
  '0xc5ebeaec': { name: 'repay', category: CATEGORY.lending },

  // --- Token ops ---
  '0xa9059cbb': { name: 'transfer', category: CATEGORY.token },
  '0x23b872dd': { name: 'transferFrom', category: CATEGORY.token },
  '0x095ea7b3': { name: 'approve', category: CATEGORY.token },

  // --- NFT ops ---
  '0x42842e0e': { name: 'safeTransferFrom(address,address,uint256)', category: CATEGORY.nft },
  '0xb88d4fde': { name: 'safeTransferFrom(address,address,uint256,bytes)', category: CATEGORY.nft },
  '0xf242432a': { name: 'safeTransferFrom(ERC1155)', category: CATEGORY.nft },
  '0x2eb2c2d6': { name: 'safeBatchTransferFrom(ERC1155)', category: CATEGORY.nft },
  '0x40c10f19': { name: 'mint(address,uint256)', category: CATEGORY.nft },
  '0x6a627842': { name: 'mint(address,uint256)', category: CATEGORY.nft }
};
