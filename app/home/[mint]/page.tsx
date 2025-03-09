import React from 'react'
import { PriceChartWidget } from './trade'

export default async function TokenDetail(props: {params: Promise<{mint: string}>}) {
  const params = await props.params;
  const { mint } = params;
  return (
    // <Wget tokenAddress={mint} />
    (<PriceChartWidget tokenAddress={mint} />)
  );
}
