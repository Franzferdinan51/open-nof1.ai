import ccxt from "ccxt";

// Check if exbitron exists in ccxt
if (ccxt.exbitron) {
  console.log("Exbitron is supported directly by CCXT!");
} else {
  console.log("Exbitron is NOT supported directly by CCXT.");
  // List all exchanges to be sure
  const exchanges = ccxt.exchanges;
  const similar = exchanges.filter(e => e.includes("exb") || e.includes("tron"));
  console.log("Similar names:", similar);
}
