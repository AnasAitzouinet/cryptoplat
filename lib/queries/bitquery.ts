
const subscriptionQuery = `
        subscription {
          Solana {
            TokenSupplyUpdates(
              where: {Instruction: {Program: {Address: {is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"}, Method: {is: "create"}}}}
            ) {
              Block {
                Time
              }
              Transaction {
                Signer
              }
              TokenSupplyUpdate {
                Amount
                Currency {
                  Symbol
                  ProgramAddress
                  PrimarySaleHappened
                  Native
                  Name
                  MintAddress
                  MetadataAddress
                  Key
                  IsMutable
                  Fungible
                  EditionNonce
                  Decimals
                  Wrapped
                  VerifiedCollection
                  Uri
                  UpdateAuthority
                  TokenStandard
                }
                PostBalance
              }
            }
          }
        }
      `;



const tradeQuery = `
            query MyQuery($token: String!, $time_5min_ago: DateTime!, $time_1h_ago: DateTime!) {
              Solana(dataset: realtime) {
                DEXTradeByTokens(
                  where: {Transaction: {Result: {Success: true}}, Trade: {Currency: {MintAddress: {is: $token}}}, Block: {Time: {since: $time_1h_ago}}}
                ) {
                  Trade {
                    Currency {
                      Name
                      MintAddress
                      Symbol
                    }
                    start: PriceInUSD(minimum: Block_Time)
                    min5: PriceInUSD(minimum: Block_Time, if: {Block: {Time: {after: $time_5min_ago}}})
                    end: PriceInUSD(maximum: Block_Time)
                    Dex {
                      ProtocolName
                      ProtocolFamily
                      ProgramAddress
                    }
                    Market {
                      MarketAddress
                    }
                    Side {
                      Currency {
                        Symbol
                        Name
                        MintAddress
                      }
                    }
                  }
                  makers: count(distinct: Transaction_Signer)
                  makers_5min: count(distinct: Transaction_Signer, if: {Block: {Time: {after: $time_5min_ago}}})
                  buyers: count(distinct: Transaction_Signer, if: {Trade: {Side: {Type: {is: buy}}}})
                  buyers_5min: count(distinct: Transaction_Signer, if: {Trade: {Side: {Type: {is: buy}}}, Block: {Time: {after: $time_5min_ago}}})
                  sellers: count(distinct: Transaction_Signer, if: {Trade: {Side: {Type: {is: sell}}}})
                  sellers_5min: count(distinct: Transaction_Signer, if: {Trade: {Side: {Type: {is: sell}}}, Block: {Time: {after: $time_5min_ago}}})
                  trades: count
                  trades_5min: count(if: {Block: {Time: {after: $time_5min_ago}}})
                  traded_volume: sum(of: Trade_Side_AmountInUSD)
                  traded_volume_5min: sum(of: Trade_Side_AmountInUSD, if: {Block: {Time: {after: $time_5min_ago}}})
                  buy_volume: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: buy}}}})
                  buy_volume_5min: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: buy}}}, Block: {Time: {after: $time_5min_ago}}})
                  sell_volume: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: sell}}}})
                  sell_volume_5min: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: sell}}}, Block: {Time: {after: $time_5min_ago}}})
                  buys: count(if: {Trade: {Side: {Type: {is: buy}}}})
                  buys_5min: count(if: {Trade: {Side: {Type: {is: buy}}}, Block: {Time: {after: $time_5min_ago}}})
                  sells: count(if: {Trade: {Side: {Type: {is: sell}}}})
                  sells_5min: count(if: {Trade: {Side: {Type: {is: sell}}}, Block: {Time: {after: $time_5min_ago}}})
                }
              }
            }
          `;

export { subscriptionQuery, tradeQuery };