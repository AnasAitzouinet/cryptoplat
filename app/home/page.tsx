"use client";
import { useEffect, useState } from "react";
import { TokenEvent, WebSocketClientOP, TradeRequest, PhantomWallet } from "@/lib/Websocket";
import { Button } from '@/components/ui/button'
import { ChevronDown, ExternalLink, Maximize2, Settings, Wallet, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { TokenCard } from '@/components/_components/token-card'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function HomePage() {
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
      console.log("New token:", token);
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



  return (
    <>
      <header className="flex h-16 w-full justify-end items-center gap-6 pt-5 px-5">
        <div className="flex size-full justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Bolt</h1>
          

            <div className="*:not-first:mt-2 cursor-pointer ">
               <div className="flex rounded-full shadow-xs">
                <span className=" w-full  justify-center text-white   inline-flex items-center rounded-s-full border px-3 text-sm">
                 Quick Buy
                </span>
                <Input
                  id={"id"}
                  className="-ms-px rounded-s-none text-center rounded-e-full shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0.0 SOL"
                  type="number"
                  min="0"
                  onInput={(e) => {
                    if (e.currentTarget.value < "0") {
                      e.currentTarget.value = "0";
                    }
                  }}
                />
          
            </div>

          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 size-full  gap-4 p-5 pt-0  ">


        <div className="border border-gray-800 rounded-xl overflow-hidden h-[calc(100vh-6rem)] flex flex-col">
          <div className="flex justify-between items-center p-2 border-b border-gray-800 bg-[#1a1a1c]">
            <h2 className="font-medium">New Pairs</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-full w-full">
            <div className="p-2 space-y-3">
              {[...tokens].reverse().map((token, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="w-full"
                >
                  <TokenCard
                    name={token.name}
                    mint={token.mint}
                    solAmount={token.solAmount}
                    marketCapSol={token.marketCapSol}
                    metadata={token.metadata}
                    uri={token.uri}
                    txType={token.txType}
                    symbol={token.symbol}
                    pool={token.pool}
                    traderPublicKey={token.traderPublicKey}
                    signature={token.signature}
                    initialBuy={token.initialBuy}
                    boundingCurveKey={token.boundingCurveKey}
                    vTokensInBoundingCurve={token.vTokensInBoundingCurve}
                  />
                </motion.div>
              ))}
              <div className="h-20 w-full left-0 bg-gradient-to-t from-black via-black/40 to-transparent absolute bottom-0"></div>
            </div>
          </ScrollArea>
        </div>

        {/* <div className="border  border-gray-800 rounded-xl overflow-hidden">
          <div className="flex justify-between items-center p-2 border-b border-gray-800 bg-[#1a1a1c]">
            <h2 className="font-medium">New Pairs</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3 p-2">
            <TokenCard
              name="pweanut"
              fullName="pweanut"
              time="0s"
              price="$0"
              marketCap="$4K"
              stats={[
                { label: "0%", color: "text-green-500" },
                { label: "0%", color: "text-green-500" },
                { label: "0%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="1"
            />

            <TokenCard
              name="WHEAT"
              fullName="WHEAT Economy"
              time="1s"
              price="$330"
              marketCap="$5K"
              stats={[
                { label: "8%", color: "text-green-500" },
                { label: "4%", color: "text-green-500" },
                { label: "8%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="4"
            />

            <TokenCard
              name="childs"
              fullName="Judge Kim Childs"
              time="3s"
              price="$434"
              marketCap="$5K"
              stats={[
                { label: "10%", color: "text-green-500" },
                { label: "7%", color: "text-green-500" },
                { label: "10%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="3"
            />

            <TokenCard
              name="livemison"
              fullName="For the life of my son"
              time="5s"
              price="$326"
              marketCap="$5K"
              stats={[
                { label: "5%", color: "text-green-500" },
                { label: "7%", color: "text-green-500" },
                { label: "8%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="3"
            />

            <TokenCard
              name="Weld"
              fullName="Tig"
              time="6s"
              price="$391"
              marketCap="$4K"
              stats={[
                { label: "5%", color: "text-green-500" },
                { label: "3%", color: "text-green-500" },
                { label: "5%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="5"
            />
          </div>
        </div>

        <div className="border  border-gray-800 rounded-xl overflow-hidden">
          <div className="flex justify-between items-center p-2 border-b border-gray-800 bg-[#1a1a1c]">
            <h2 className="font-medium">New Pairs</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3 p-2">
            <TokenCard
              name="pweanut"
              fullName="pweanut"
              time="0s"
              price="$0"
              marketCap="$4K"
              stats={[
                { label: "0%", color: "text-green-500" },
                { label: "0%", color: "text-green-500" },
                { label: "0%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="1"
            />

            <TokenCard
              name="WHEAT"
              fullName="WHEAT Economy"
              time="1s"
              price="$330"
              marketCap="$5K"
              stats={[
                { label: "8%", color: "text-green-500" },
                { label: "4%", color: "text-green-500" },
                { label: "8%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="4"
            />

            <TokenCard
              name="childs"
              fullName="Judge Kim Childs"
              time="3s"
              price="$434"
              marketCap="$5K"
              stats={[
                { label: "10%", color: "text-green-500" },
                { label: "7%", color: "text-green-500" },
                { label: "10%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="3"
            />

            <TokenCard
              name="livemison"
              fullName="For the life of my son"
              time="5s"
              price="$326"
              marketCap="$5K"
              stats={[
                { label: "5%", color: "text-green-500" },
                { label: "7%", color: "text-green-500" },
                { label: "8%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="3"
            />

            <TokenCard
              name="Weld"
              fullName="Tig"
              time="6s"
              price="$391"
              marketCap="$4K"
              stats={[
                { label: "5%", color: "text-green-500" },
                { label: "3%", color: "text-green-500" },
                { label: "5%", color: "text-red-500" },
                { label: "0%", color: "text-green-500" },
              ]}
              tx="5"
            />
          </div>
        </div> */}

      </div >
    </>
  )
}
