"use client";
import { useEffect, useState } from "react";
import { TokenEvent, WebSocketClientOP, TradeRequest } from "@/lib/Websocket";
import { Button } from "@/components/ui/button";

const HomePage = () => {
  const [tokens, setTokens] = useState<TokenEvent[]>([]);
  const [phantomWallet, setPhantomWallet] = useState<any>(null);
  const [wsClient, setWsClient] = useState<WebSocketClientOP | null>(null);

  // Try to auto-reconnect if wallet info exists in localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).solana && (window as any).solana.isPhantom) {
      const storedWallet = localStorage.getItem('phantomWallet');
      if (storedWallet) {
        // Phantom wallets require user approval, so we call connect automatically if possible.
        (window as any).solana.connect({ onlyIfTrusted: true })
          .then((res: any) => {
            setPhantomWallet((window as any).solana);
            console.log("Auto reconnected to Phantom:", res.publicKey.toString());
          })
          .catch(() => {
            console.log("User not trusted or wallet not connected yet.");
          });
      }
    }
  }, []);

  // Connect to Phantom Wallet manually
  const handleConnectWallet = async () => {
    if (typeof window !== "undefined" && (window as any).solana && (window as any).solana.isPhantom) {
      try {
        const response = await (window as any).solana.connect();
        setPhantomWallet((window as any).solana);
        // Save wallet connection info to localStorage
        localStorage.setItem(
          "phantomWallet",
          JSON.stringify({ publicKey: response.publicKey.toString(), connected: true })
        );
        console.log("Connected to Phantom:", response.publicKey.toString());
      } catch (err) {
        console.error("Phantom connection error:", err);
        localStorage.removeItem("phantomWallet");
      }
    } else {
      alert("Phantom Wallet not found. Please install it.");
      localStorage.removeItem("phantomWallet");
    }
  };

  useEffect(() => {
    const client = new WebSocketClientOP("wss://pumpportal.fun/api/data");
    setWsClient(client);
    const handleNewToken = (token: TokenEvent) => {
      setTokens((prev) => [...prev, token]);
    };
    client.addListener(handleNewToken);
    client.connect();

    // Wait for connection then subscribe to new tokens.
    const connectInterval = setInterval(() => {
      if (client && (client as any)["isConnected"]) {
        client.subscribeToNewTokens();
        clearInterval(connectInterval);
      }
    }, 100);

    return () => {
      client.removeListener(handleNewToken);
      client.close();
      clearInterval(connectInterval);
    };
  }, []);

  // Quick trade handler using a token's data
  const handleQuickTrade = async (token: TokenEvent) => {
    if (!phantomWallet) {
      alert("Please connect your Phantom wallet to trade.");
      return;
    }
    if (!wsClient) {
      alert("WebSocket client not ready.");
      return;
    }
    const tradeRequest: TradeRequest = {
      action: "buy",
      mint: token.mint,
      amount: 0.1, // You can adjust this default
      denominatedInSol: "true",
      slippage: 0.5,
      priorityFee: 0.0001,
      pool: "pump",
    };
    await wsClient.sendPumpTransaction(tradeRequest, phantomWallet);
  };

  // Quick Buy: Automatically trade the most recent token without user input.
  const handleQuickBuy = async () => {
    if (!phantomWallet) {
      alert("Please connect your Phantom wallet to trade.");
      return;
    }
    if (!wsClient) {
      alert("WebSocket client not ready.");
      return;
    }
    // If tokens list is empty, alert the user.
    if (tokens.length === 0) {
      alert("No tokens available for quick buy.");
      return;
    }
    // For example, use the most recent token received
    const latestToken = tokens[tokens.length - 1];
    const tradeRequest: TradeRequest = {
      action: "buy",
      mint: latestToken.mint,
      amount: 0.01,
      denominatedInSol: "true",
      slippage: 0.5,
      priorityFee: 0.0001,
      pool: "pump",
    };
    await wsClient.sendPumpTransaction(tradeRequest, phantomWallet);
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div>
        <h1 className="text-3xl font-bold text-blue-600 mb-8">
          Real-Time Token Updates
        </h1>
        <div className="flex space-x-4 mb-4">
          <Button onClick={handleConnectWallet}>
            {phantomWallet ? "Wallet Connected" : "Connect Phantom Wallet"}
          </Button>
          <Button onClick={handleQuickBuy}>Quick Buy Latest Token</Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {[...tokens].reverse().map((token, index) => (
            <div
              key={index}
              className="bg-white p-4 rounded-lg shadow mb-4 flex items-center"
            >
              {(token.metadata?.image || token.uri) && (
                <img
                  src={token.metadata?.image || token.uri}
                  alt={token.name}
                  className="w-12 h-12 rounded-full mr-4"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div>
                <h2 className="font-bold">
                  {token.name} ({token.symbol})
                </h2>
                <p>Mint: {token.mint}</p>
                <p>Market Cap: {token.marketCapSol} SOL</p>
                {token.metadata && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>{token.metadata.description}</p>
                    <div className="flex space-x-2 mt-1">
                      {token.metadata.twitter && (
                        <a
                          href={token.metadata.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Twitter
                        </a>
                      )}
                      {token.metadata.telegram && (
                        <a
                          href={token.metadata.telegram}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Telegram
                        </a>
                      )}
                      {token.metadata.website && (
                        <a
                          href={token.metadata.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                )}
                <Button onClick={() => handleQuickTrade(token)} className="mt-2">
                  Buy 0.1 SOL
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
