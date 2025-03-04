"use client";
import { VersionedTransaction, Connection, PublicKey, Keypair } from "@solana/web3.js";
import bs58 from 'bs58'

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

export interface TradeRequest {
    action: "buy" | "sell";
    mint: string;
    amount: number;
    denominatedInSol: "true" | "false";
    slippage: number;
    priorityFee: number;
    pool: "pump" | "raydium" | "auto";
}




export interface PhantomWallet {
    isPhantom: boolean;
    connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
    publicKey?: { toString: () => string };
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
    signAndSendTransaction: (tx : VersionedTransaction) => Promise<string>;
}


export class WebSocketClientOP {
    private ws: WebSocket | null = null;
    private messageQueue: { method: SubscriptionMethod; keys?: string[] }[] = [];
    private listeners: ((data: TokenEvent) => void)[] = [];
    private isConnected = false;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private metadataCache: Record<string, TokenMetadata> = {};
    private readonly RPC_URL = "https://api.devnet.solana.com";
    private connection: Connection = new Connection(this.RPC_URL, "confirmed");

    constructor(private readonly url: string) { }

    async connect(): Promise<void> {
        if (
            this.ws &&
            (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)
        ) {
            return;
        }
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.processMessageQueue();
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
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => {
                    this.reconnectAttempts++;
                    this.connect();
                }, Math.min(1000 * this.reconnectAttempts, 5000));
            }
        };
    }

    addListener(callback: (data: TokenEvent) => void): void {
        this.listeners.push(callback);
    }

    removeListener(callback: (data: TokenEvent) => void): void {
        this.listeners = this.listeners.filter((listener) => listener !== callback);
    }

    private async fetchMetadata(uri: string): Promise<TokenMetadata | null> {
        if (this.metadataCache[uri]) {
            return this.metadataCache[uri];
        }
        try {
            const response = await fetch(uri);
            const data = await response.json();
            this.metadataCache[uri] = data;
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
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify(payload));
        } else {
            this.messageQueue.push(payload);
        }
    }

    private processMessageQueue(): void {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            if (message && this.ws) {
                this.ws.send(JSON.stringify(message));
            }
        }
    }

    /**
     * Sends a transaction request using the pump fun API.
     * If a Phantom wallet is provided, it will ask the wallet to sign the transaction.
     *
     * @param request Trade details.
     * @param phantomWallet Optional Phantom wallet object (window.solana).
     */
    async sendPumpTransaction(request: TradeRequest, phantomWallet?: PhantomWallet): Promise<void> {
        // Use the wallet's public key if connected
        const publicKey = phantomWallet?.publicKey?.toString();
        if (!publicKey) {
            console.error("No wallet connected. Please connect your Phantom wallet.");
            return;
        }

        const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                publicKey,
                action: request.action,
                mint: request.mint,
                denominatedInSol: request.denominatedInSol,
                amount: request.amount,
                slippage: request.slippage,
                priorityFee: request.priorityFee,
                pool: request.pool,
            }),
        });

        if (response.ok) {
            const data = await response.arrayBuffer();
            const tx = VersionedTransaction.deserialize(new Uint8Array(data));
            // Set the fee payer to the connected wallet
            // @ts-expect-error - feePayer is not exposed in the type definition
            tx.message.feePayer = new PublicKey(publicKey);
            try {
                // Ask Phantom wallet to sign the transaction
                const signedTx = await phantomWallet!.signTransaction(tx);
                const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
                    preflightCommitment: "processed",
                });
                console.log("Transaction submitted: https://solscan.io/tx/" + signature);
            } catch (e: unknown) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.error("Error signing or sending transaction:", error.message);
            }
        } else {
            console.error("Error generating transaction:", response.statusText);
        }
    }

    async sendLightTransaction(request: TradeRequest) {
        try {
            // Use environment variable for API key
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                throw new Error("API_KEY environment variable is not set");
            }

            const response = await fetch(`https://pumpportal.fun/api/trade?api-key=${apiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: request.action,
                    mint: request.mint,
                    amount: request.amount,
                    denominatedInSol: request.denominatedInSol,
                    slippage: request.slippage,
                    priorityFee: request.priorityFee,
                    pool: request.pool
                })
            });

            if (response.status === 200) {
                const data = await response.arrayBuffer();
                const tx = VersionedTransaction.deserialize(new Uint8Array(data));
                
                // Use environment variable for private key
                const privateKey = process.env.WALLET_PRIVATE_KEY;
                if (!privateKey) {
                    throw new Error("WALLET_PRIVATE_KEY environment variable is not set");
                }
                
                const signerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKey));
                tx.sign([signerKeyPair]);
                const signature = await this.connection.sendTransaction(tx);
                console.log("Transaction: https://solscan.io/tx/" + signature);
            } else {
                console.error("Error generating transaction:", response.statusText);
            }
        } catch (error) {
            console.error("Error sending light transaction:", error);
        }
    }

    async fetchWalletBalance(publicKey: string): Promise<number> {
        try {
            const balance = await this.connection.getBalance(new PublicKey(publicKey));
            return balance / 10 ** 9;
        } catch (error) {
            console.error("Error fetching wallet balance:", error);
            return 0;
        }
    }

    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
