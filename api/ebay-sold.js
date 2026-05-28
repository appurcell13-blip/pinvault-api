module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing search query" });

  const EBAY_APP_ID = process.env.EBAY_APP_ID;
  if (!EBAY_APP_ID) return res.status(500).json({ error: "eBay App ID not configured" });

  try {
    const searchQuery = encodeURIComponent(query);
    const url = "https://svcs.ebay.com/services/search/FindingService/v1" +
      "?OPERATION-NAME=findCompletedItems" +
      "&SERVICE-VERSION=1.0.0" +
      "&SECURITY-APPNAME=" + EBAY_APP_ID +
      "&RESPONSE-DATA-FORMAT=JSON" +
      "&REST-PAYLOAD" +
      "&keywords=" + searchQuery +
      "&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true" +
      "&sortOrder=EndTimeSoonest" +
      "&paginationInput.entriesPerPage=10";

    const response = await fetch(url);
    const data = await response.json();

    // Return raw eBay response for debugging
    const root = data?.findCompletedItemsResponse?.[0];
    const ack = root?.ack?.[0];
    const items = root?.searchResult?.[0]?.item || [];
    const totalItems = root?.searchResult?.[0]?.["@count"] || 0;

    if (items.length === 0) {
      return res.status(200).json({ 
        sales: [], 
        message: "No recent sold listings found",
        debug: { ack, totalItems, query }
      });
    }

    const sales = items.map(item => ({
      title: item.title?.[0] || "",
      price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
      date: new Date(item.listingInfo?.[0]?.endTime?.[0]).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
      }),
      condition: item.condition?.[0]?.conditionDisplayName?.[0] || "Not specified",
      url: item.viewItemURL?.[0] || "",
      sellingState: item.sellingStatus?.[0]?.sellingState?.[0] || ""
    })).filter(s => s.price > 0);

    return res.status(200).json({ sales, debug: { ack, totalItems, query } });

  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch eBay data", details: err.message });
  }
};
