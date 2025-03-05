import { X, Star, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TokenMetadata } from "@/lib/Websocket";

type TokenEvent = {
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

export function TokenCard({
  name,
  mint,
  txType,
  solAmount,
  marketCapSol,
  symbol,
  metadata,
  uri
}: TokenEvent) {
  const hasImage = !!metadata?.image || !!uri;
  
  return (
    <div className="flex items-center w-full p-2 border border-gray-800 rounded-md cursor-pointer bg-[#141416] hover:bg-[#1a1a1c] transition-colors max-w-full">
      <div className="flex-shrink-0 mr-2">
        {hasImage ? (
          <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-700">
            <img src={metadata?.image || uri} alt={name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-700"></div>
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center overflow-hidden">
            <span className="font-medium truncate max-w-[100px]">{name}</span>
            <span className="ml-1 text-gray-400 text-xs truncate max-w-[50px]">{symbol}</span>
          </div>
          <div className="flex items-center text-xs">
            <span className="text-gray-400 mr-1">V</span>
            <span>{solAmount.toFixed(3)} SOL</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center text-xs space-x-1">
            <span className="text-gray-400">0s</span>
            <X className="h-3 w-3 text-gray-500" />
            <Star className="h-3 w-3 text-gray-500" />
            <Search className="h-3 w-3 text-gray-500" />
          </div>
          <div className="flex items-center text-xs">
            <span className="text-gray-400 mr-1">MC</span>
            <span>{marketCapSol.toFixed(2)} SOL</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-2">
            {[
              { label: "0%", color: "text-green-500" },
              { label: "0%", color: "text-green-500" },
              { label: "0%", color: "text-red-500" },
              { label: "0%", color: "text-green-500" },
            ].map((stat, index) => (
              <span key={index} className={`text-xs ${stat.color}`}>
                {stat.label}
              </span>
            ))}
            {txType === "buy" && <span className="text-xs bg-green-900 text-green-500 px-1 rounded">Paid</span>}
          </div>
          <div className="flex items-center text-xs">
            <span className="text-gray-400 mr-1">TX</span>
            <span>1</span>
          </div>
        </div>
      </div>

      <div className="ml-2 flex-shrink-0">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded px-2 py-1 h-6 whitespace-nowrap">0.002 SOL</Button>
      </div>
    </div>
  )
}
