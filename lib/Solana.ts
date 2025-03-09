import {
    Connection,
    PublicKey,
    ParsedAccountData,
    ConfirmedSignatureInfo,
    ParsedTransactionWithMeta,
} from "@solana/web3.js";

interface TokenBalance {
    account: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
    amount: number;
    decimals: number;
    transactions?: TokenTransaction[];
}

interface TokenTransaction {
    signature: string;
    blockTime: number;
    type: 'buy' | 'sell' | 'transfer' | 'unknown';
    amount: number;
    solAmount?: number;
    counterparty?: string;
    timestamp: Date;
}

interface Trade {
    signature: string;
    blockTime: number;
    price: number;
    buyer: PublicKey;
    seller: PublicKey;
    amount: number;
    timestamp: Date;
    minutesAgo: number;
    tradeType: 'buy' | 'sell' | 'swap';
}

interface Sniper {
    address: PublicKey;
    transactions: TokenTransaction[];
    totalBuys: number;
    totalSells: number;
    averageResponseTime: number;
    firstBuyTimestamp?: Date;
    profitLoss: number;
}

export class SolanaTokenData {
    private readonly connection: Connection;
    private sniperCache: Map<string, Sniper> = new Map();
    private tokenHolderCache: Map<string, TokenBalance[]> = new Map();
    private tokenCreationTimes: Map<string, number> = new Map();

    constructor(rpcUrl: string) {
        this.connection = new Connection(rpcUrl, "confirmed");
    }

    async getTokenHolders(
        mintAddress: PublicKey, 
        includeTransactions: boolean = false,
        transactionLimit: number = 10
    ): Promise<TokenBalance[]> {
        const mintKey = mintAddress.toBase58();
        
        if (this.tokenHolderCache.has(mintKey) && !includeTransactions) {
            return this.tokenHolderCache.get(mintKey)!;
        }

        const tokenAccounts = await this.connection.getParsedProgramAccounts(
            new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuB6Wxvzh5VeAa22"),
            {
                filters: [
                    { dataSize: 165 },
                    {
                        memcmp: {
                            offset: 0,
                            bytes: mintKey,
                        },
                    },
                ],
            }
        );

        const holders: TokenBalance[] = tokenAccounts.map((account) => {
            const accountData = account.account.data as ParsedAccountData;
            const parsedInfo = accountData.parsed?.info;

            return {
                account: account.pubkey,
                mint: new PublicKey(parsedInfo.mint),
                owner: new PublicKey(parsedInfo.owner),
                amount: parsedInfo.tokenAmount.uiAmount,
                decimals: parsedInfo.tokenAmount.decimals,
            };
        });

        this.tokenHolderCache.set(mintKey, holders);

        if (includeTransactions) {
            await Promise.all(
                holders.map(async (holder) => {
                    holder.transactions = await this.getHolderTransactions(
                        holder.owner,
                        mintAddress,
                        transactionLimit
                    );
                })
            );
        }

        return holders;
    }

    async getHolderTransactions(
        ownerAddress: PublicKey,
        mintAddress: PublicKey,
        limit: number = 10
    ): Promise<TokenTransaction[]> {
        const signatures = await this.connection.getSignaturesForAddress(
            ownerAddress,
            { limit }
        );

        const transactions: TokenTransaction[] = [];

        for (const sigInfo of signatures) {
            try {
                const tx = await this.connection.getParsedTransaction(
                    sigInfo.signature,
                    "confirmed"
                );

                if (!tx || tx.meta?.err !== null) continue;

                const tokenTx = this.extractTokenTransaction(
                    tx,
                    ownerAddress,
                    mintAddress,
                    sigInfo
                );

                if (tokenTx) {
                    transactions.push(tokenTx);
                }
            } catch (error) {
                console.error(`Error processing transaction ${sigInfo.signature}:`, error);
            }
        }

        return transactions;
    }

    async getLatestTrades(mintAddress: PublicKey, limit: number = 10): Promise<Trade[]> {
        const signatures = await this.connection.getSignaturesForAddress(mintAddress, {
            limit: limit,
        });
        const trades: Trade[] = [];

        if (!this.tokenCreationTimes.has(mintAddress.toBase58())) {
            const firstTx = signatures[signatures.length - 1];
            if (firstTx) {
                const tx = await this.connection.getParsedTransaction(
                    firstTx.signature,
                    { maxSupportedTransactionVersion: 0 }
                );
                if (tx && tx.blockTime) {
                    this.tokenCreationTimes.set(mintAddress.toBase58(), tx.blockTime);
                }
            }
        }

        for (const signatureInfo of signatures) {
            try {
                const transaction = await this.connection.getParsedTransaction(
                    signatureInfo.signature,
                    { 
                        commitment: "confirmed",
                        maxSupportedTransactionVersion: 0 
                    }
                );

                if (transaction && transaction.meta?.err === null) {
                    const blockTime = transaction.blockTime || 0;
                    const trade = this.extractTradeDetails(transaction, mintAddress);

                    if (trade) {
                        const now = new Date();
                        const txTime = new Date(blockTime * 1000);
                        const minutesAgo = Math.floor((now.getTime() - txTime.getTime()) / (1000 * 60));
                        
                        let tradeType = "unknown";
                        if (trade.buyer && !trade.seller) {
                            tradeType = "buy";
                        } else if (!trade.buyer && trade.seller) {
                            tradeType = "sell";
                        } else if (trade.buyer && trade.seller) {
                            const isActualSwap = this.isSwapTransaction(transaction);
                            tradeType = isActualSwap ? "swap" : 
                                       (trade.amount > 0 ? "buy" : "sell");
                        }
                        
                        trades.push({
                            signature: signatureInfo.signature,
                            blockTime: blockTime,
                            price: trade.price,
                            buyer: trade.buyer,
                            seller: trade.seller,
                            amount: trade.amount,
                            timestamp: txTime,
                            minutesAgo: minutesAgo,
                            tradeType: tradeType as "buy" | "sell" | "swap"
                        });
                    }
                }
            } catch (error) {
                console.error(`Error processing transaction ${signatureInfo.signature}:`, error);
            }
        }

        return trades;
    }
    
    private isSwapTransaction(transaction: ParsedTransactionWithMeta): boolean {
        if (!transaction.transaction?.message?.instructions) {
            return false;
        }
        
        const instructions = transaction.transaction.message.instructions;
        
        const swapProgramIds = [
            "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
            "9qvG1zUp8xF1Bi4m6UdRNby1BAAuaDrUxSpv4CmRRMjL",
        ];
        
        for (const ix of instructions) {
            if (typeof ix === 'object' && 'programId' in ix) {
                const programId = (ix as any).programId?.toString();
                if (programId && swapProgramIds.includes(programId)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    async identifySnipers(
        mintAddress: PublicKey,
        timeThresholdSeconds: number = 60,
        minBuyAmount: number = 0.01
    ): Promise<Sniper[]> {
        const mintKey = mintAddress.toBase58();
        
        let creationTime = this.tokenCreationTimes.get(mintKey);
        if (!creationTime) {
            const signatures = await this.connection.getSignaturesForAddress(mintAddress, {
                limit: 100,
            });
            
            if (signatures.length > 0) {
                const oldestSig = signatures[signatures.length - 1];
                const tx = await this.connection.getParsedTransaction(oldestSig.signature);
                if (tx && tx.blockTime) {
                    creationTime = tx.blockTime;
                    this.tokenCreationTimes.set(mintKey, creationTime);
                }
            }
        }

        if (!creationTime) {
            throw new Error("Could not determine token creation time");
        }

        const endTime = creationTime + timeThresholdSeconds;
        const signatures = await this.connection.getSignaturesForAddress(
            mintAddress,
            { until: endTime.toString() }
        );

        const potentialSnipers: Map<string, Sniper> = new Map();

        for (const sigInfo of signatures) {
            try {
                const tx = await this.connection.getParsedTransaction(sigInfo.signature);
                if (!tx || tx.meta?.err !== null || !tx.blockTime) continue;

                if (tx.blockTime <= creationTime) continue;

                const tradeInfo = this.extractTradeDetails(tx, mintAddress);
                if (!tradeInfo || tradeInfo.amount < minBuyAmount) continue;

                const buyerKey = tradeInfo.buyer.toBase58();
                const responseTime = (tx.blockTime - creationTime) * 1000;

                if (!potentialSnipers.has(buyerKey)) {
                    potentialSnipers.set(buyerKey, {
                        address: tradeInfo.buyer,
                        transactions: [],
                        totalBuys: 0,
                        totalSells: 0,
                        averageResponseTime: responseTime,
                        firstBuyTimestamp: new Date(tx.blockTime * 1000),
                        profitLoss: 0
                    });
                }

                const sniper = potentialSnipers.get(buyerKey)!;
                sniper.totalBuys++;
                sniper.transactions.push({
                    signature: sigInfo.signature,
                    blockTime: tx.blockTime,
                    type: 'buy',
                    amount: tradeInfo.amount,
                    solAmount: tradeInfo.price * tradeInfo.amount,
                    timestamp: new Date(tx.blockTime * 1000)
                });
                
                // Update average response time
                sniper.averageResponseTime = (sniper.averageResponseTime * (sniper.totalBuys - 1) + responseTime) / sniper.totalBuys;
                
                // Update profit/loss calculation
                sniper.profitLoss -= (tradeInfo.price * tradeInfo.amount);
            } catch (error) {
                console.error(`Error processing transaction ${sigInfo.signature}:`, error);
            }
        }

        // Get subsequent sell transactions for these snipers to calculate profit/loss
        for (const [address, sniper] of potentialSnipers.entries()) {
            const sellerSigs = await this.connection.getSignaturesForAddress(
                sniper.address,
                { limit: 50 }
            );

            for (const sigInfo of sellerSigs) {
                try {
                    const tx = await this.connection.getParsedTransaction(sigInfo.signature);
                    if (!tx || tx.meta?.err !== null || !tx.blockTime) continue;
                    
                    // Skip transactions before first buy
                    if (sniper.firstBuyTimestamp && tx.blockTime * 1000 < sniper.firstBuyTimestamp.getTime()) continue;

                    const tradeInfo = this.extractTradeDetails(tx, mintAddress);
                    if (!tradeInfo || tradeInfo.seller.toBase58() !== address) continue;

                    sniper.totalSells++;
                    sniper.transactions.push({
                        signature: sigInfo.signature,
                        blockTime: tx.blockTime,
                        type: 'sell',
                        amount: tradeInfo.amount,
                        solAmount: tradeInfo.price * tradeInfo.amount,
                        timestamp: new Date(tx.blockTime * 1000)
                    });
                    
                    // Update profit/loss
                    sniper.profitLoss += (tradeInfo.price * tradeInfo.amount);
                } catch (error) {
                    console.error(`Error processing transaction ${sigInfo.signature}:`, error);
                }
            }
        }

        // Cache the results
        for (const [address, sniper] of potentialSnipers.entries()) {
            this.sniperCache.set(`${mintKey}:${address}`, sniper);
        }

        return Array.from(potentialSnipers.values());
    }

    /**
     * Extracts token transaction details from a parsed transaction.
     */
    private extractTokenTransaction(
        transaction: ParsedTransactionWithMeta,
        ownerAddress: PublicKey,
        mintAddress: PublicKey,
        sigInfo: ConfirmedSignatureInfo
    ): TokenTransaction | null {
        if (!transaction.blockTime) return null;

        const ownerKey = ownerAddress.toBase58();
        const mintKey = mintAddress.toBase58();
        
        // Check if any instruction involves the token mint
        let tokenInvolved = false;
        let txType: 'buy' | 'sell' | 'transfer' | 'unknown' = 'unknown';
        let amount = 0;
        let solAmount = 0;
        let counterparty: string | undefined;

        if (transaction.meta && transaction.transaction.message.instructions) {
            for (const instruction of transaction.transaction.message.instructions) {
                // Check for token program instructions
                if ('programId' in instruction && 
                    instruction.programId.toString() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' && 
                    'parsed' in instruction) {
                    
                    const parsed = instruction.parsed;
                    if (parsed.type === 'transfer' && 
                        parsed.info.mint === mintKey) {
                        
                        tokenInvolved = true;
                        amount = parsed.info.amount;
                        
                        if (parsed.info.source === ownerKey) {
                            txType = 'sell';
                            counterparty = parsed.info.destination;
                        } else if (parsed.info.destination === ownerKey) {
                            txType = 'buy';
                            counterparty = parsed.info.source;
                        } else {
                            txType = 'transfer';
                        }
                    }
                }
                
                // For DEX transactions, we'd need to check for specific DEX program IDs
                // and decode their instructions accordingly
            }
        }

        if (!tokenInvolved) return null;

        return {
            signature: sigInfo.signature,
            blockTime: transaction.blockTime,
            type: txType,
            amount: amount,
            solAmount: solAmount > 0 ? solAmount : undefined,
            counterparty: counterparty,
            timestamp: new Date(transaction.blockTime * 1000)
        };
    }

    /**
     * Extracts trade details from a transaction.
     * This implementation needs to be customized based on the specific DEX being used.
     */
    private extractTradeDetails(transaction: ParsedTransactionWithMeta, mintAddress: PublicKey): {
        price: number;
        buyer: PublicKey;
        seller: PublicKey;
        amount: number;
    } | null {
        // This is a placeholder implementation that needs to be customized
        // based on the specific DEX (Raydium, Orca, Jupiter, etc.)
        
        // For demonstration purposes, we'll return a mock trade
        // In a real implementation, you would:
        // 1. Identify the DEX program ID in the transaction
        // 2. Parse the specific instruction format for that DEX
        // 3. Extract buyer, seller, amount, and price information
        
        // Mock implementation
        if (transaction.blockTime && transaction.transaction.signatures.length > 0) {
            // This is just a placeholder - real implementation would extract actual data
            return {
                price: 0.01, // Mock price
                buyer: new PublicKey("11111111111111111111111111111111"), // Mock buyer
                seller: new PublicKey("11111111111111111111111111111111"), // Mock seller
                amount: 100, // Mock amount
            };
        }
        
        return null;
    }
}