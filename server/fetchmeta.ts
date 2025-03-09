"use server"
export const fetchmeta = async (mint: string): Promise<any> => {
    const metadataUri = `https://solana-gateway.moralis.io/token/mainnet/${mint}/metadata`;
    
    try {
        const response = await fetch(metadataUri, {
            headers: {
                'X-API-Key': process.env.MORALIS_API_KEY || ''
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }

        const metadata = await response.json();
        console.log("Metadata result:", metadata);
        const mt = metadata.metaplex.metadataUri;

        const lastfetch = await fetch(mt);
        const lastfetchjson = await lastfetch.json();
        return lastfetchjson;
    } catch (error) {
        console.error("Error fetching metadata:", error);
        throw error;
    }
}