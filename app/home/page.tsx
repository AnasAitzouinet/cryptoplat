"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { OwnedToken, PumpFunTokens, TokenEvent, TradeRequest } from "@/lib/Pump";
import { getUserWallet } from "@/server/Auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OwnedTokenCard, TokenCard } from '@/components/_components/token-card';
import { useDebounce } from "@/hooks/useDebounce";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { set } from "@coral-xyz/anchor/dist/cjs/utils/features";
interface SolanaWindow {
  solana?: {
    isPhantom?: boolean;
    publicKey?: string;
    connected?: boolean;
  };
}

declare global {
  interface Window extends SolanaWindow {}
}

export default function HomePage() {
  const [tokens, setTokens] = useState<TokenEvent[]>([]);
  const [Ownedtokens, setOwnedTokens] = useState<OwnedToken[]>([]);
  const [wsClient, setWsClient] = useState<PumpFunTokens | null>(null);
  const [quickBuyAmount, setQuickBuyAmount] = useState<string>("0.1");
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const debouncedQuickBuyAmount = useDebounce(quickBuyAmount, 500);

  // Initialize client and subscribe to tokens
  useEffect(() => {
    const client = new PumpFunTokens("wss://pumpportal.fun/api/data");

    client.onConnectionStatusChange((status) => {
      setConnectionStatus(status);
    });

    setWsClient(client);
    const fetchdev = async () => {
      try {
        const devtoken = await client.getOwnedTokens();
        const formattedTokens = devtoken.map(token => ({
          mint: token.mint,
          amount: token.amount,
          metadata: {
            createdOn: token.metadata?.createdOn || '',
            description: token.metadata?.description || '',
            image: token.metadata?.image || '',
            name: token.metadata?.name || '',
            showName: token.metadata?.showName || false,
            symbol: token.metadata?.symbol || '',
            twitter: token.metadata?.twitter || ''
          }
        }));
        setOwnedTokens((prev) => {
          return [...formattedTokens, ...prev].slice(0, 20);
        });
      }
      catch (error) {
        console.error("Error fetching dev token data:", error);
      }
    }

    fetchdev();

    const handleNewToken = (token: TokenEvent) => {
      setTokens((prevTokens) => {
        if (prevTokens.some(t => t.signature === token.signature)) {
          return prevTokens;
        }

        const updatedTokens = [token, ...prevTokens].slice(0, 20);
        localStorage.setItem("lastSeenTokens", JSON.stringify(updatedTokens));
        return updatedTokens;
      });
    };

    client.addListener(handleNewToken);
    client.connect();

    // Fetch balance immediately after connection
    const fetchBalance = async () => {
      try {
        const userData = await getUserWallet();
        if (userData?.publicKey) {
          const bal = await client.BallanceOfWallet(userData.publicKey);
          console.log("Balance fetched:", bal);
          setBalance(bal / LAMPORTS_PER_SOL);
        }
      } catch (error) {
        console.error("Balance fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const connectInterval = setInterval(() => {
      if (client.isConnected()) {
        client.subscribeToNewTokens();
        fetchBalance();
        clearInterval(connectInterval);
      }
    }, 1000);

    try {
      const storedTokens = localStorage.getItem("lastSeenTokens");
      if (storedTokens) {
        setTokens(JSON.parse(storedTokens));
      }
    } catch (err) {
      console.error("Error parsing stored tokens:", err);
    }

    const storedQuickBuy = localStorage.getItem("quickBuyAmount");
    if (storedQuickBuy) {
      setQuickBuyAmount(storedQuickBuy);
    }

    return () => {
      client.removeListener(handleNewToken);
      client.close();
      clearInterval(connectInterval);
    };
  }, []);

  // Save quickBuy amount to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("quickBuyAmount", debouncedQuickBuyAmount);
  }, [debouncedQuickBuyAmount]);

  // Handle token trading
  const handleTrade = useCallback(
    async (token: TokenEvent) => {
      if (!wsClient) {
        alert("Connection not established. Please refresh.");
        return;
      }

      const tradeAmount = parseFloat(quickBuyAmount);
      if (isNaN(tradeAmount) || tradeAmount <= 0) {
        alert("Please enter a valid amount greater than 0");
        return;
      }

      try {
        const tradeRequest: TradeRequest = {
          action: "buy",
          mint: token.mint,
          amount: tradeAmount,
          denominatedInSol: "true",
          slippage: 0.005,
          priorityFee: 0.0002,
          pool: "pump",
        };

        const result = await wsClient.Trade(tradeRequest);
        console.log("Trade result:", result);
        if (!result.success) {
          throw new Error(result.error?.toString() || "Trade failed");
        }

        setTimeout(async () => {
          const userData = await getUserWallet();
          if (userData?.walletPublicKey) {
            const bal = await wsClient.BallanceOfWallet(userData.walletPublicKey);
            setBalance(bal);
          }
        }, 2000);
      } catch (error) {
        console.error("Trade error:", error);
        alert("Transaction failed. Please try again.");
      }
    },
    [wsClient, quickBuyAmount]
  );

  const handleTransfer = async () => {
    if (!wsClient) {
      alert("Connection not established. Please refresh.");
      return;
    }

    const transferAmount = parseFloat(quickBuyAmount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }

    try {
      const res = await wsClient.exportFundsToPhantom(transferAmount);
      console.log("Transfer result:", res);
      return res;
    } catch (error) {
      console.error("Transfer error:", error);
      alert("Transaction failed. Please try again.");
    }
  }

  // Memoized token cards to reduce re-renders
  const tokenCards = useMemo(
    () =>
      tokens.slice(0, 50).map((token, index) => (
        <TokenCard
          key={token.signature || `token-${index}`}
          {...token}
          quickBuy={quickBuyAmount}
          handleTrade={() => handleTrade(token)}
        />
      )),
    [tokens, quickBuyAmount, handleTrade]
  );

  const OwnedTokenCards = useMemo(
    () =>
      Ownedtokens.map((token, index) => (
        <OwnedTokenCard
          key={token.mint || `token-${index}`}
          {...token}
          quickSell={quickBuyAmount}
          handleTrade={() =>console.log("Sell", token.mint, "Amount:", quickBuyAmount)}
        />
      )),
    [Ownedtokens, quickBuyAmount, handleTrade]
  );
  return (
    <>
      <header className="flex flex-col sm:flex-row h-auto sm:h-16 w-full justify-between sm:justify-end items-start sm:items-center gap-4 sm:gap-6 pt-5 px-4 sm:px-5">
        <div className="flex flex-col gap-1 sm:gap-2 w-full sm:w-auto">
          <span className="text-sm">Wallet Balance (SOL)</span>
          <span className="text-lg font-medium">
            {isLoading ? "Loading..." : balance }
          </span>
        </div>
        <div className="flex flex-col gap-1 sm:gap-2 w-full sm:w-auto">
          <span className="text-sm">Quick Buy Amount (SOL)</span>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={quickBuyAmount}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 0) {
                  setQuickBuyAmount(e.target.value);
                  localStorage.setItem("quickBuyAmount", e.target.value);
                }
              }}
              placeholder="0.0"
              className="w-full sm:w-32"
            />
            <Button
              onClick={handleTransfer}
              variant="outline"
              className="whitespace-nowrap"
              disabled={!quickBuyAmount || parseFloat(quickBuyAmount) <= 0}
            >
              Transfer {quickBuyAmount} SOL
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:gap-2 w-full sm:w-auto">
          <span className="text-sm">Public Key</span>
          <Button
            variant="outline"
            className="whitespace-nowrap"
            onClick={async () => {
              const userData = await getUserWallet();
              if (userData?.publicKey) {
                navigator.clipboard.writeText(userData.publicKey);
                alert('Public key copied to clipboard!');
              } else {
                alert('No public key found');
              }
            }}
          >
            Copy Public Key
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-5 pt-0">
        <div className="border border-gray-800 rounded-xl overflow-hidden h-[calc(100vh-12rem)] sm:h-[calc(100vh-6rem)] flex flex-col">
          <div className="flex justify-between items-center p-2 border-b border-gray-800 bg-[#1a1a1c]">
            <h2 className="font-medium text-sm sm:text-base">New Pairs</h2>
            <div className="text-xs text-gray-400">
              {connectionStatus === 'connected' ? 'Live' :
                connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </div>
          </div>
          <div className="p-1 sm:p-2 space-y-2 sm:space-y-3 overflow-y-auto">
            {tokens.length > 0 ? tokenCards : (
              <div className="text-center text-gray-400 py-4">
                Waiting for new tokens...
              </div>
            )}
          </div>
          
        </div>
        <div className="border border-gray-800 rounded-xl overflow-hidden h-[calc(100vh-12rem)] sm:h-[calc(100vh-6rem)] flex flex-col">
          <div className="flex justify-between items-center p-2 border-b border-gray-800 bg-[#1a1a1c]">
            <h2 className="font-medium text-sm sm:text-base">Owned</h2>
            <div className="text-xs text-gray-400">
              {connectionStatus === 'connected' ? 'Live' :
                connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </div>
          </div>
          <div className="p-1 sm:p-2 space-y-2 sm:space-y-3 overflow-y-auto">
            {Ownedtokens.length > 0 ? OwnedTokenCards : (
              <div className="text-center text-gray-400 py-4">
                {isLoading ? 'Loading Your tokens...' : 'You don\'t own any tokens yet'}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}