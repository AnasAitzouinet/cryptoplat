"use client";
import { useEffect, useState } from "react";
import { TokenEvent, WebSocketClientOP, TradeRequest, PhantomWallet } from "@/lib/Websocket";
import { Button } from "@/components/ui/button";
import Image from "next/image";


declare global {
    interface Window {
        solana?: PhantomWallet;
    }
}

const HomePage = () => {
    const [tokens, setTokens] = useState<TokenEvent[]>([]);
    const [phantomWallet, setPhantomWallet] = useState<PhantomWallet | null>(null);
    const [wsClient, setWsClient] = useState<WebSocketClientOP | null>(null);

    // Try to auto-reconnect if wallet info exists in localStorage
    useEffect(() => {
        if (typeof window !== "undefined" && window.solana && window.solana.isPhantom) {
            const storedWallet = localStorage.getItem('phantomWallet');
            if (storedWallet) {
                window.solana.connect({ onlyIfTrusted: true })
                    .then((res) => {
                        setPhantomWallet(window.solana!);
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
        if (typeof window !== "undefined" && window.solana && window.solana.isPhantom) {
            try {
                const response = await window.solana.connect();
                console.log(response);
                setPhantomWallet(window.solana);
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

        const connectInterval = setInterval(() => {
            if (client && client["isConnected"]) {
                client.subscribeToNewTokens();
                clearInterval(connectInterval);
            }
        }, 100);

        client.fetchWalletBalance("6kVvfjFnchSRwjGMw2HKRRmKCiqzzWpToHS1WoU83Woh").then((res) => {
            console.log("Wallet balance:", res);
        });

        return () => {
            client.removeListener(handleNewToken);
            client.close();
            clearInterval(connectInterval);
        };
    }, []);

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
      amount: 0.1,
      denominatedInSol: "true",
      slippage: 0.5,
      priorityFee: 0.0001,
      pool: "pump",
    };
    await wsClient.sendPumpTransaction(tradeRequest, phantomWallet!);
  };

    const handleLightTrade = async (token: TokenEvent) => {

        const tradeRequest: TradeRequest = {
            action: "buy",
            mint: token.mint,
            amount: 0.001,
            denominatedInSol: "true",
            slippage: 0.5,
            priorityFee: 0.0001,
            pool: "pump",
        };
        await wsClient?.sendLightTransaction(tradeRequest);

    }

    const handleUnsubscribe = () => {
        wsClient?.unsubscribeNewToken()
    }


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
                    <Button onClick={handleUnsubscribe}>
                        unsubscribe
                    </Button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {[...tokens].reverse().map((token, index) => (
                        <div
                            key={index}
                            className="bg-white p-4 rounded-lg shadow mb-4 flex items-center"
                        >
                            {(token.metadata?.image || token.uri) && (
                                <Image
                                    src={token.metadata?.image || token.uri}
                                    alt={token.name}
                                    width={48}
                                    height={48}
                                    className="rounded-full mr-4"
                                    unoptimized={true}
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
                                    Buy 0.001 SOL
                                </Button>
                                <Button onClick={() => handleLightTrade(token)} className="mt-2">
                                    Buy 0.001 SOL (Quick)
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
