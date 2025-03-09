import { Connection } from "@solana/web3.js";
import { subscriptionQuery, tradeQuery } from "./queries/bitquery";

interface TokenMetadata {
  name: string;
  symbol: string;
  image: string;
  website: string;
  twitter: string;
  telegram: string;
  description: string;
}

interface TradeData {
  traded_volume: number;
  traded_volume_5min: number;
  buy_volume: number;
  sell_volume: number;
  trades: number;
  makers: number;
}

interface TokenData {
  data: any; // Replace with specific type if known
  metadata: TokenMetadata;
  tradeData: TradeData | null;
}

export class PumpFunTokensGraphQL {
  private readonly RPC_URL = "https://api.devnet.solana.com";
  private connection: Connection = new Connection(this.RPC_URL, "confirmed");
  private client: WebSocket | null = null;
  private token = "ory_at_Dk57DxCNTjfdQWRkwIe575tJeDEJWj8hUEzwrbZW6P4._n3pyq9RK_mtFe2plYzEgO4Ihq4CeYan6to-MsWXvDA";
  public onNewToken: ((token: TokenData) => void) | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.client = new WebSocket(
        `wss://streaming.bitquery.io/eap?token=${this.token}`,
        ["graphql-ws"]
      );
      this.setupConnection();
    }
  }

  private setupConnection() {
    if (!this.client) return;

    this.client.onopen = () => {
      console.log("WebSocket connected to Bitquery.");
      const initMessage = JSON.stringify({
        type: "connection_init",
        payload: { token: this.token },
      });
      this.client!.send(initMessage);
    };

    this.client.onerror = (event) => {
      console.error("WebSocket error event:", event);
    };

    this.client.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }

  private sendGraphQLRequest(query: string, variables: Record<string, unknown> = {}, id: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.client || this.client.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket is not open"));
      }

      const handler = (message: MessageEvent) => {
        let data;
        try {
          data = JSON.parse(message.data);
        } catch (err) {
          console.error("Error parsing message:", err);
          return;
        }
        if (data.id !== id) return;

        if (data.type === "data") {
          this.client!.removeEventListener("message", handler);
          resolve(data.payload);
        } else if (data.type === "error") {
          this.client!.removeEventListener("message", handler);
          reject(data.payload.errors);
        }
      };

      this.client.addEventListener("message", handler);
      this.client.send(
        JSON.stringify({
          type: "start",
          id: id,
          payload: { query, variables },
        })
      );
    });
  }

  async fetchRTTokenData(): Promise<boolean> {
    if (!this.client) {
      throw new Error("WebSocket not available in this environment");
    }

    return new Promise((resolve, reject) => {
      let isResolved = false;
      const waitForOpen = () => {
        if (this.client!.readyState === WebSocket.OPEN) {
          const subscriptionMessage = JSON.stringify({
            type: "start",
            id: "1",
            payload: { query: subscriptionQuery },
          });
          this.client!.send(subscriptionMessage);
          console.log("Subscription message sent.");
        } else {
          setTimeout(waitForOpen, 100);
        }
      };

      this.client!.onmessage = (event) => {
        let response;
        try {
          response = JSON.parse(event.data);
        } catch (err) {
          console.error("Error parsing message:", err);
          return;
        }

        if (response.type === "connection_ack") {
          console.log("Connection acknowledged by server.");
          waitForOpen();
          if (!isResolved) {
            isResolved = true;
            resolve(true);
          }
        } else if (response.type === "data") {
          this.latestTokenData(response.payload.data)
            .then((data) => {
              if (data) {
                if (this.onNewToken) this.onNewToken(data);
              }
            })
            .catch(reject);
        } else if (response.type === "error") {
          reject(response.payload.errors);
        }
      };

      this.client!.onerror = (event) => reject(event);
      this.client!.onclose = () => {
        if (!isResolved) reject(new Error("WebSocket closed prematurely"));
      };

      setTimeout(() => {
        if (!isResolved) reject(new Error("Connection timeout"));
      }, 10000);
    });
  }

  private async latestTokenData(data: unknown): Promise<TokenData | null> {
    if (data && typeof data === "object" && "Solana" in data) {
      const solanaData = data as { Solana: { TokenSupplyUpdates: Array<unknown> } };
      if (solanaData.Solana.TokenSupplyUpdates.length) {
        const latestData = solanaData.Solana.TokenSupplyUpdates[0];
        try {
          const metadataResponse = await fetch((latestData as any).TokenSupplyUpdate.Currency.Uri);
          const metadata = await metadataResponse.json();
          
          const now = new Date();
          const time5minAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
          const time1hAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

          const tradeData = await this.sendGraphQLRequest(
            tradeQuery,
            {
              token: (latestData as any).TokenSupplyUpdate.Currency.MintAddress,
              time_5min_ago: time5minAgo,
              time_1h_ago: time1hAgo,
            },
            "2"
          );
          
          const aggregatedTradeData = (tradeData as any)?.Solana?.DEXTradeByTokens?.[0] || null;
          return {
            data: latestData,
            metadata: {
              name: metadata.name,
              symbol: metadata.symbol,
              image: metadata.image,
              website: metadata.website,
              twitter: metadata.twitter,
              telegram: metadata.telegram,
              description: metadata.description,
            },
            tradeData: aggregatedTradeData ? {
              traded_volume: aggregatedTradeData.traded_volume || 0,
              traded_volume_5min: aggregatedTradeData.traded_volume_5min || 0,
              buy_volume: aggregatedTradeData.buy_volume,
              sell_volume: aggregatedTradeData.sell_volume,
              trades: aggregatedTradeData.trades,
              makers: aggregatedTradeData.makers
            } : null
          };
        } catch (error) {
          console.error("Error processing token data:", error);
          return null;
        }
      }
    }
    return null;
  }

  disconnect(): void {
    if (this.client) {
      this.client.send(JSON.stringify({ type: "stop", id: "1" }));
      this.client.close();
      console.log("WebSocket connection closed");
    }
  }
}