"use client";
import { X, Star, Search, Globe, Twitter, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import React from "react";
import { TokenMetadata } from "@/lib/Pump";
import { useRouter } from "next/navigation";

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

export type TokenCardProps = TokenEvent & {
  quickBuy: string; // e.g., "0.05"
  handleTrade: () => void;
};

export type OwnedTokenCardProps = {
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
  quickSell: string;
  handleTrade: () => void;
};

function TokenCardComponent({
  name,
  solAmount,
  marketCapSol,
  symbol,
  metadata,
  uri,
  quickBuy,
  mint,
  handleTrade,
}: TokenCardProps) {
  const hasImage = !!metadata?.image || !!uri;
  const quickBuyFloat = parseFloat(quickBuy);
  const buttonLabel =
    quickBuy && quickBuyFloat > 0 ? `${quickBuyFloat.toFixed(3)} SOL` : "Buy Token";
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/home/${mint}`)}
      className="flex flex-col sm:flex-row items-center w-full p-2 border border-gray-800 rounded-md cursor-pointer bg-[#141416] hover:bg-[#1a1a1c] transition-colors max-w-full">
      <div className="flex-shrink-0 mr-2 mb-2 sm:mb-0">
        <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-700">
          {hasImage && <img src={metadata?.image || uri} alt={name} className="w-full h-full object-cover" />}
        </div>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center overflow-hidden w-full sm:w-auto">
            <span className="font-medium truncate max-w-[100px] sm:max-w-[150px]">{name}</span>
            <span className="ml-1 text-gray-400 text-xs truncate max-w-[50px] sm:max-w-[80px]">{symbol}</span>
          </div>
          <div className="flex items-center text-xs mt-1 sm:mt-0">
            <span className="text-gray-400 mr-1">V</span>
            <span>{solAmount.toFixed(3)} SOL</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between mt-1">
          <div className="flex items-center text-xs space-x-1">
             {metadata?.website && (
              <a href={metadata.website} target="_blank" rel="noopener noreferrer">
                <Globe className="h-3 w-3 text-gray-500 hover:text-gray-400" />
              </a>
            )}
            {metadata?.twitter && (
              <a href={`${metadata.twitter}`} target="_blank" rel="noopener noreferrer">
                <Twitter className="h-3 w-3 text-gray-500 hover:text-gray-400" />
              </a>
            )}
            {metadata?.telegram && (
              <a href={metadata.telegram} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3 w-3 text-gray-500 hover:text-gray-400" />
              </a>
            )}
          </div>
          <div className="flex items-center text-xs mt-1 sm:mt-0">
            <span className="text-gray-400 mr-1">MC</span>
            <span>{marketCapSol.toFixed(2)} SOL</span>
          </div>
        </div>
      </div>
      <div className="ml-0 sm:ml-2 flex-shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
        <Button
          onClick={handleTrade}
          className="bg-blue-600 hover:bg-blue-700 cursor-pointer text-white text-xs rounded px-2 py-1 h-6 whitespace-nowrap w-full sm:w-auto"
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function OwnedTokenCardComponent({
  mint,
  amount,
  metadata,
  quickSell,
  handleTrade,
}: OwnedTokenCardProps) {
  const hasImage = !!metadata?.image;
  const quickSellFloat = parseFloat(quickSell);
  const buttonLabel =
    quickSell && quickSellFloat > 0 ? `${quickSellFloat.toFixed(3)} SOL` : "Sell Token";
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/home/${mint}`)}
      className="flex flex-col sm:flex-row items-center w-full p-2 border border-gray-800 rounded-md cursor-pointer bg-[#141416] hover:bg-[#1a1a1c] transition-colors max-w-full">
      <div className="flex-shrink-0 mr-2 mb-2 sm:mb-0">
        <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-700">
          {hasImage && <img src={metadata.image} alt={metadata.name} className="w-full h-full object-cover" />}
        </div>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center overflow-hidden w-full sm:w-auto">
            <span className="font-medium truncate max-w-[100px] sm:max-w-[150px]">{metadata.name}</span>
            <span className="ml-1 text-gray-400 text-xs truncate max-w-[50px] sm:max-w-[80px]">{metadata.symbol}</span>
          </div>
          <div className="flex items-center text-xs mt-1 sm:mt-0">
            <span className="text-gray-400 mr-1">Amount</span>
            <span>{amount}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between mt-1">
          <div className="flex items-center text-xs space-x-1">
            {metadata.twitter && (
              <a href={`${metadata.twitter}`} target="_blank" rel="noopener noreferrer">
                <Twitter className="h-3 w-3 text-gray-500 hover:text-gray-400" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="ml-0 sm:ml-2 flex-shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
        <Button
          onClick={handleTrade}
          className="bg-red-600 hover:bg-red-700 cursor-pointer text-white text-xs rounded px-2 py-1 h-6 whitespace-nowrap w-full sm:w-auto"
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

export const TokenCard = React.memo(TokenCardComponent);
export const OwnedTokenCard = React.memo(OwnedTokenCardComponent);
