import { LabelStore, Id, TransactionInfo } from '../label';
import { GeminiLLM, Config } from '../gemini-llm';




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

    const user = Id.from('u1');

    const catGroceries = Id.from('cat_groceries');
    const catClothes   = Id.from('cat_clothes');
    const catUtilities = Id.from('cat_utilities');

    const categoriesTuples: [string, Id][] = [
      ['Groceries',  catGroceries],
      ['Clothes',    catClothes],
      ['Utilities',  catUtilities],
    ];

    store.apply(user, Id.from('rx1'), 'Whole Foods', 'Whole Foods', catGroceries);
    store.apply(user, Id.from('rx2'), 'H&M',         'H&M',         catClothes);
    store.apply(user, Id.from('rx3'), 'Electricity',       'Eversource',       catUtilities);

    const txs: TransactionInfo[] = [
      { tx_id: Id.from('tx1'), tx_name: 'Trader Joe’s',  tx_merchant: 'Trader Joe’s' },
      { tx_id: Id.from('tx2'), tx_name: 'Uniqlo',        tx_merchant: 'Uniqlo' },
      { tx_id: Id.from('tx3'), tx_name: 'National Grid', tx_merchant: 'National Grid' },
    ];


  console.log('=== TEST 1 — CLEARLY SEPARATED CATEGORIES ===');
  for (const t of txs) {
    const suggested = await store.suggest(llm, user, categoriesTuples, t);
    console.log(`Tx ${t.tx_id.toString()} | ${t.tx_name} | ${t.tx_merchant} -> ${suggested.name}`);
    console.log('---\n');
  }

}
main();
