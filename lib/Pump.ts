"use client";
import { VersionedTransaction, Connection, PublicKey, Keypair, LAMPORTS_PER_SOL,  SendTransactionError, SystemProgram, TransactionMessage } from "@solana/web3.js";
import bs58 from 'bs58';
import { createWallet, getUserWallet } from '@/server/Auth';
 import { SolanaTokenData } from "./Solana";
import {  PumpFunSDK, TransactionResult } from "pumpdotfun-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  printSOLBalance,

} from "@/lib/utils"
import { fetchmeta } from "@/server/fetchmeta";
export type SubscriptionMethod =
  | "subscribeNewToken"
  | "unsubscribeNewToken"
  | "subscribeTokenTrade"
  | "subscribeAccountTrade";

export type TokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName: boolean;
  createdOn: string;
  twitter: string;
  telegram: string;
  website: string;
};

export type PhantomWallet = {
  isPhantom: boolean | PhantomWallet | undefined;
  publicKey: string;
  connected: boolean;
}

export type TokenEvent = {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: string;
  initialBuy: number;
  solAmount: number;
  boundingCurveKey: string;
  vTokensInBoundingCurve: number;
  marketCapSol: number;
  name: string;
  uri: string;
  pool: string;
  symbol: string;
  metadata: TokenMetadata;
};

export type OwnedToken = {
  mint: string;
  amount: number;
  metadata: {
    createdOn: string;
    description: string;
    image: string;
    name: string;
    showName: boolean;
    symbol: string;
    twitter: string;
  };
};


export interface TradeRequest {
  action: "buy" | "sell";
  mint: string;
  amount: number;
  denominatedInSol: "true" | "false";
  slippage: number;
  priorityFee: number;
  pool: "pump" | "raydium" | "auto";
}
export class PumpFunTokens {
  private ws: WebSocket | null = null;
  private messageQueue: { method: SubscriptionMethod; keys?: string[] }[] = [];
  private listeners: ((data: TokenEvent) => void)[] = [];
  private connectionStatusListeners: ((status: 'connecting' | 'connected' | 'disconnected') => void)[] = [];
  private _isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly RPC_URL_DEV = "https://devnet.helius-rpc.com/?api-key=d0e10f39-15ad-40a1-82f8-9d707783367a";
  private readonly RPC_URL = "https://mainnet.helius-rpc.com/?api-key=d0e10f39-15ad-40a1-82f8-9d707783367a";
  private connection: Connection;
  private solanaTokenData: SolanaTokenData;
  private Provider: AnchorProvider | null = null;
  private Wallet: Keypair | null = null;

  constructor(private readonly url: string) {
    this.connection = new Connection(this.RPC_URL, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000, // 60 seconds timeout
    });
    this.solanaTokenData = new SolanaTokenData(this.RPC_URL);
  }

  private async initProvider() {
    const wallet = await getUserWallet();
    if (!wallet || !wallet.privateKey) {
      return Promise.reject("Phantom Wallet not found");
    }
    this.Wallet = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
     const walletAdapter = {
      publicKey: this.Wallet.publicKey,
      signTransaction: async (transaction: VersionedTransaction) => {
        transaction.sign([this.Wallet!]);
        return transaction;
      },
      signAllTransactions: async (transactions: VersionedTransaction[]) => {
        transactions.forEach(t => t.sign([this.Wallet!]));
        return transactions;
      }
    };
    this.Provider = new AnchorProvider(this.connection, walletAdapter as Wallet, {
      preflightCommitment: "confirmed",
      commitment: "confirmed",
    });
    return this.Provider;
  }


  async getOwnedTokens(): Promise<{ mint: string; amount: number; metadata?: TokenMetadata }[]> {
    try {
      
      if (!this.Provider) {
        await this.initProvider();
        if (!this.Provider) {
          throw new Error("Provider initialization failed");
        }
      }

      if (!this.Wallet) {
        throw new Error("Wallet not initialized");
      }
    
      const walletPublicKey = this.Wallet.publicKey;
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(walletPublicKey, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
      });
  
      const ownedTokens = await Promise.all(tokenAccounts.value.map(async (account) => {
        const mint = account.account.data.parsed.info.mint;
        const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
  
        // Try to fetch metadata if available
        let metadata: TokenMetadata | null = null;
        try {
          const mintAddress = mint.toString();
        
          const res = await fetchmeta(mintAddress);
          metadata = res;
        } catch (error) {
          console.warn(`Could not fetch metadata for token ${mint}:`, error);
        }
        return {
          mint,
          amount,
          metadata: metadata || undefined
        };
      }));
  
      return ownedTokens;
    } catch (error) {
      console.error("Error fetching token balance:", error);
      throw error;
    }
  }

  async Trade(request: TradeRequest) {
    // Initialize provider if not already set
    if (!this.Provider) {
      await this.initProvider();
      if (!this.Provider) {
        throw new Error("Provider initialization failed");
      }
    }
    
    const pumpFunSDK = new PumpFunSDK(this.Provider);
    const mint = new PublicKey(request.mint);
    const walletKey = this.Wallet!.publicKey;
    const priorityFee = { unitLimit: 250000, unitPrice: 250000 };

    // Validate and adjust slippage if necessary
    let slippage = BigInt(Math.round(request.slippage * 10000));
    if (slippage < BigInt(100)) { // Minimum 1% slippage
      console.warn("Slippage too low, setting to minimum 1%");
      slippage = BigInt(100);
    } else if (slippage > BigInt(10000)) { // Maximum 100% slippage
      console.warn("Slippage too high, setting to maximum 100%");
      slippage = BigInt(10000);
    }

    // Convert amount to lamports (1 SOL = 1,000,000,000 lamports)
    const amountInLamports = Math.round(Number(request.amount) * LAMPORTS_PER_SOL);
    const amount = BigInt(amountInLamports);

    // Print current SOL balance
    await printSOLBalance(this.connection, walletKey);

    try {
      let result: TransactionResult;
      if (request.action === 'buy') {
        // First attempt with original slippage
        try {
          result = await pumpFunSDK.buy(
            this.Wallet! as unknown as Keypair,
            mint,
            amount,
            slippage,
            priorityFee,
            'confirmed'
          );
        } catch (error) {
          // If error is due to slippage, increase it by 10% and retry
          if (error instanceof Error && (error.message.includes("TooMuchSolRequired") || error.message.includes("6002"))) {
            console.warn("Slippage error detected, increasing slippage by 25% and retrying");
            const increasedSlippage = slippage + (slippage * BigInt(25)) / BigInt(100);
            try {
              result = await pumpFunSDK.buy(
                this.Wallet! as unknown as Keypair,
                mint,
                amount,
                increasedSlippage,
                priorityFee,
                'confirmed'
              );
            } catch (secondError) {
              // If still failing, increase slippage by 50% and try one last time
              if (secondError instanceof Error && (secondError.message.includes("TooMuchSolRequired") || secondError.message.includes("6002"))) {
                console.warn("Second slippage error detected, increasing slippage by 50% and retrying");
                const finalSlippage = slippage + (slippage * BigInt(50)) / BigInt(100);
                result = await pumpFunSDK.buy(
                  this.Wallet! as unknown as Keypair,
                  mint,
                  amount,
                  finalSlippage,
                  priorityFee,
                  'confirmed'
                );
              } else {
                throw secondError;
              }
            }
          } else {
            throw error;
          }
        }
      } else {
        result = await pumpFunSDK.sell(
          this.Wallet! as unknown as Keypair,
          mint,
          amount,
          slippage,
          priorityFee,
          request.pool === 'auto' ? undefined : 'confirmed'
        );
      }

      // Check if transaction was actually successful on-chain
      if (result.success && result.signature) {
        try {
          const tx = await this.connection.getTransaction(result.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });

          if (!tx) {
            console.warn("Transaction not found on-chain, marking as failed");
            return {
              success: false,
              error: new Error("Transaction not found on-chain")
            };
          }

          if (tx.meta?.err) {
            console.warn("Transaction failed on-chain:", tx.meta.err);
            return {
              success: false,
              error: new Error(`On-chain error: ${JSON.stringify(tx.meta.err)}`)
            };
          }
        } catch (error) {
          console.error("Error verifying transaction:", error);
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }

      console.log(`${request.action} Transaction ${result.success ? 'successful' : 'failed'}`);
      if (!result.success) {
        if (result.error instanceof Error && 'logs' in result.error) {
          const error = result.error as { logs?: string[] };
          console.error("Transaction failed with logs:", error.logs?.join('\n'));
        } else {
          console.error("Error:", result.error);
        }
      }
      return result;
    } catch (error) {
      console.error("Trade error:", error);
      if (error instanceof Error && 'logs' in error) {
        const txError = error as { logs?: string[] };
        console.error("Transaction logs:", txError.logs?.join('\n'));

        // Check for specific slippage error
        if (txError.logs?.some(log => log.includes("TooMuchSolRequired") || log.includes("6002"))) {
          const leftRight = txError.logs.find(log => log.includes("Left:") && log.includes("Right:"));
          if (leftRight) {
            console.error("Slippage mismatch detected:", leftRight);
          }
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  public isConnected(): boolean {
    return this._isConnected;
  }

  public onConnectionStatusChange(callback: (status: 'connecting' | 'connected' | 'disconnected') => void): void {
    this.connectionStatusListeners.push(callback);
  }

  private setConnectionStatus(status: 'connecting' | 'connected' | 'disconnected'): void {
    this._isConnected = status === 'connected';
    this.connectionStatusListeners.forEach(listener => listener(status));
  }

  async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.setConnectionStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setConnectionStatus('connected');
        this.reconnectAttempts = 0;
        this.processMessageQueue();
        console.log("WebSocket connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as TokenEvent;
          this.handleIncomingData(data);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      this.ws.onerror = (error: Event) => {
        console.error("WebSocket error:", error);
        this.ws?.close();
      };

      this.ws.onclose = () => {
        this.setConnectionStatus('disconnected');
        this.handleReconnect();
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.setConnectionStatus('disconnected');
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
      console.error("Maximum reconnection attempts reached");
    }
  }

  async fetchDEVTokenData() {
    try {
      const devnetConnection = new Connection(this.RPC_URL_DEV, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000
      });
      const programId = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"); // Replace with actual program ID
      const programAccounts = await devnetConnection.getProgramAccounts(programId, {
        filters: [{ dataSize: 165 }], // Filter for token accounts
        commitment: "confirmed"
      });
      console.log("DEV token accounts:", programAccounts);
      return programAccounts;

    } catch (error) {
      console.error("Error fetching DEV token data:", error);
      return null;
    }
  }

  async exportFundsToPhantom(amount: number) {
    try {
      // Validate amount
      if (amount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // Initialize provider if not already set
      if (!this.Provider) {
        await this.initProvider();
        if (!this.Provider) {
          throw new Error("Provider initialization failed");
        }
      }

      // Get wallet and validate
      const wallet = await getUserWallet();
      console.log("Phantom Wallet:", wallet);
      if (!wallet?.walletPublicKey) {
        throw new Error("Phantom Wallet not found");
      }

      // Validate Wallet instance
      if (!this.Wallet?.publicKey) {
        throw new Error("Source wallet not initialized");
      }

      // Check source wallet balance
      const fromPubkey = new PublicKey(this.Wallet.publicKey);
      const balance = await this.connection.getBalance(fromPubkey);
      const requiredLamports = Math.round(amount * LAMPORTS_PER_SOL);
      
      if (balance < requiredLamports) {
        throw new Error(`Insufficient funds. Available: ${balance / LAMPORTS_PER_SOL} SOL, Required: ${amount} SOL`);
      }

      // Create public keys
      const walletPublicKey = new PublicKey(wallet.walletPublicKey);

      // Create transfer instruction
      const transfer = SystemProgram.transfer({
        fromPubkey,
        toPubkey: walletPublicKey,
        lamports: requiredLamports
      });

      // Create and sign transaction
      const message = new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
        instructions: [transfer]
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);
      transaction.sign([this.Wallet]);

      try {
        // Send and confirm transaction
        const signature = await this.connection.sendTransaction(transaction);
        const confirmation = await this.connection.confirmTransaction(signature, "confirmed");

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        console.log("Transfer successful:", signature);
        return { success: true, signature };
      } catch (error ) {
        if (error instanceof SendTransactionError) {
          console.error("Transaction simulation failed. Logs:", error.logs);
          throw new Error(`Transaction failed: ${error.message}. See logs for details.`);
        }
        throw error;
      }

    } catch (error) {
      console.error("Export error:", error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  addListener(callback: (data: TokenEvent) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (data: TokenEvent) => void): void {
    this.listeners = this.listeners.filter((listener) => listener !== callback);
  }

  async getTokenHolders(mintAddress: string, includeTransactions: boolean = false) {
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      const holders = await this.solanaTokenData.getTokenHolders(
        mintPublicKey,
        includeTransactions,
        10
      );
      console.log("Token holders:", holders);
      return holders;
    } catch (error) {
      console.error("Error fetching token holders:", error);
    }
  }

  async getLatestTrades(mintAddress: string, limit: number = 10) {
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      const trades = await this.solanaTokenData.getLatestTrades(mintPublicKey, limit);
      console.log("Latest trades:", trades);
      return trades;
    } catch (error) {
      console.error("Error fetching latest trades:", error);
    }
  }

  private async fetchMetadata(uri: string): Promise<TokenMetadata | null> {
    try {
      const response = await fetch(uri);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching metadata:", error);
      return null;
    }
  }
   
   

  private async handleIncomingData(data: TokenEvent): Promise<void> {
    if (!this.validateTokenEvent(data)) {
      console.warn("Received invalid token event:", data);
      return;
    }
    if (data.uri) {
      try {
        const metadata = await this.fetchMetadata(data.uri);
        if (metadata) {
          this.listeners.forEach((listener) => listener({ ...data, metadata }));
        }

      } catch (error) {
        console.error("Error handling metadata:", error);
        this.listeners.forEach((listener) => listener(data));
      }
    } else {
      this.listeners.forEach((listener) => listener(data));
    }
  }

  private validateTokenEvent(data: unknown): data is TokenEvent {
    return (
      !!data &&
      typeof data === 'object' &&
      'signature' in data && typeof data.signature === "string" &&
      'mint' in data && typeof data.mint === "string" &&
      'name' in data && typeof data.name === "string"
    );
  }

  subscribeToNewTokens(): void {
    this.send({ method: "subscribeNewToken" });
  }

  subscribeToAccountTrades(accountKeys: string[]): void {
    this.send({ method: "subscribeAccountTrade", keys: accountKeys });
  }

  unsubscribeNewToken(): void {
    this.send({ method: "unsubscribeNewToken" });
  }

  private send(payload: { method: SubscriptionMethod; keys?: string[] }): void {
    if (this._isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.messageQueue.push(payload);
    }
  }

  private processMessageQueue(): void {
    if (!this._isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Creates a new platform wallet for the user based on their Phantom wallet.
   */
  async CreateUserWallet(phantomWallet: PhantomWallet): Promise<any> {
    if (!phantomWallet || !phantomWallet.publicKey) {
      return Promise.reject("Phantom Wallet not found");
    }

    const newWallet = Keypair.generate();
    const walletPublicKey = newWallet.publicKey.toBase58();
    const walletSecretKey = bs58.encode(newWallet.secretKey);
    const phantomWalletPK = phantomWallet.publicKey.toString();

    try {
      const createdWallet = await createWallet({
        walletPublicKey,
        phantomWalletPK,
        WalletSecretKey: walletSecretKey
      });

      if (!createdWallet) {
        return Promise.reject("Wallet not created");
      }

      return createdWallet;
    } catch (error) {
      console.error("Error creating wallet:", error);
      return Promise.reject("Failed to create wallet: " + error);
    }
  }

  async BallanceOfWallet(walletPublicKey: string): Promise<number> {
    try {
      // Validate the public key
       const balance = await printSOLBalance(this.connection, new PublicKey(walletPublicKey));
      return balance;
    } catch (error) {
      console.error("Error in BallanceOfWallet:", error);
      return 0;
    }
  }



  async close(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      // Only attempt to close if the connection is open
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.setConnectionStatus('disconnected');
  }
}