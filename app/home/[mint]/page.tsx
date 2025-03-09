import React from 'react'
import { PriceChartWidget } from './trade'

export default function TokenDetail({params}: {params: {mint: string}}) {
    const { mint } = params;
    console.log(mint)
  return (
    // <Wget tokenAddress={mint} />
    <PriceChartWidget tokenAddress={mint} />
  )
}
