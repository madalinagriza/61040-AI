import { LabelStore, Id, TransactionInfo } from '../label';
import { GeminiLLM, Config } from '../gemini-llm';

type TxInfo = { tx_id: Id; tx_name: string; tx_merchant: string };

/**
 * Load configuration from config.json
 */
function loadConfig(): Config {
    try {
        const config = require('../../config.json');
        return config;
    } catch (error) {
        console.error('❌ Error loading config.json. Please ensure it exists with your API key.');
        console.error('Error details:', (error as Error).message);
        process.exit(1);
    }
}


export async function main() {
    
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    const store = new LabelStore();

    const user = Id.from('u3');
    const catGroceries = Id.from('cat_groceries');
    const catHousehold   = Id.from('cat_household');
    const catHomeImprove = Id.from('cat_homeImprove');
    const catTransit     = Id.from('cat_transit');
    const catHealth      = Id.from('cat_health');
    const catEntertain   = Id.from('cat_entertain');
    const catMisc        = Id.from('cat_misc');

    const categoriesTuples: [string, Id][] = [
      ['Groceries',  catGroceries],
      ['HouseHold Supplies',  catHousehold],
      ['Home Improvement', catHomeImprove],
      ['Transit',     catTransit],
      ['Health & Pharmacy',  catHealth],
      ['Entertainment',   catEntertain],
      ['Miscellaneous',        catMisc],
    ];

  const previous: [Id, string, string, Id][] = [
    [Id.from('tx1'), 'Ibuprofen', 'CVS Pharmacy', catHealth],
    [Id.from('tx2'), 'Home Depot', 'Home Depot', catHomeImprove],
    [Id.from('tx3'), 'Wood', 'Lowe’s', catHomeImprove],
    [Id.from('tx4'), 'Target', 'Target', catHousehold],
    [Id.from('tx5'), 'Containers', 'Amazon Pantry', catGroceries],
    [Id.from('tx6'), 'Superman', 'AMC Theatres', catEntertain],
    [Id.from('tx7'), 'MTA ticket', 'MTA', catTransit],
  ];
  for (const transaction of previous){
    store.apply(user, transaction[0], transaction[1], transaction[2], transaction[3]);
  }
  const txs: TransactionInfo[] = [
    { tx_id: Id.from('m1'), tx_name: 'Home Depot', tx_merchant: 'Home Depot' },
    { tx_id: Id.from('m2'), tx_name: 'Target', tx_merchant: 'Target' },
    { tx_id: Id.from('m3'), tx_name: 'Ace Hardware', tx_merchant: 'Ace Hardware' },
    { tx_id: Id.from('m4'), tx_name: 'Lyft * Ride', tx_merchant: 'Lyft * Ride' },
    { tx_id: Id.from('m5'), tx_name: 'Steam Purchase', tx_merchant: 'Steam Purchase' },
    { tx_id: Id.from('m6'), tx_name: 'Walmart Supercenter', tx_merchant: 'Walmart Supercenter' },
    { tx_id: Id.from('m7'), tx_name: 'Walgreens', tx_merchant: 'Walgreens' },
  ];

  console.log('=== TEST 3 — MANY CATEGORIES + NEAR-COLLISIONS ===');
  for (const t of txs) {
    const suggested = await store.suggest(llm, user, categoriesTuples, t);
    console.log(`Tx ${t.tx_id.toString()} | ${t.tx_name} | ${t.tx_merchant} -> ${suggested.name}`);
    console.log('---\n');
  }
}
main();
