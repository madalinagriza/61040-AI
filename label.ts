/**
 * label.ts — Minimal AI-augmented Label concept (DayPlanner-style)
 * - IDs are simple string wrappers.
 * - Stateless suggestion (best guess) + manual commit.
 * - No validation/guards here; keep it lightweight for Assignment 3.
 */

import { GeminiLLM } from './gemini-llm';

//// Simple Id wrapper


export class Id {
  private constructor(private value: string) {}
  
  static from(value: string): Id {
    return new Id(value);
  }

  toString(): string {
    return this.value;
  }
}


const TRASH_CATEGORY_ID = Id.from("TRASH_CATEGORY");

//// Label record

export interface Label {
  tx_id: Id;
  category_id: Id;
  user_id: Id;
  created_at: Date;
}

type CategoryMeta = { id: Id; name: string };

export interface TransactionInfo {
  tx_id: Id;
  tx_name: string;
  tx_merchant: string;
}


export class LabelStore {
  private labelsByTx = new Map<string, Label>();

  private txInfoById = new Map<string, TransactionInfo>();
  private catHistory = new Map<string, Set<string>>(); // category_id -> set of tx_id strings
  
  private ensureHistorySet(cat: Id): Set<string> {
    const key = cat.toString();
    let set = this.catHistory.get(key);
    if (!set) {
      set = new Set<string>();
      this.catHistory.set(key, set);
    }
    return set;
  }

  apply(
    user_id: Id,
    tx_id: Id,
    tx_name: string,
    tx_merchant: string,
    category_id: Id,


  ): Label {
    // make transactionInfo
    const txInfo: TransactionInfo = { tx_id, tx_name, tx_merchant };
    this.txInfoById.set(tx_id.toString(), txInfo);
    // add to history
    this.ensureHistorySet(category_id).add(tx_id.toString());

    // create label
    const label: Label = { tx_id, category_id, user_id, created_at: new Date() };
    this.labelsByTx.set(tx_id.toString(), label);
    return label;
  }

  /** Change the category for an existing label. */
  update(user_id: Id, tx_id: Id, new_category_id: Id): Label {
    const key = tx_id.toString();
    const prev = this.labelsByTx.get(key);

    // move tx in category history (best-effort, no guards here)
    if (prev) {
      const oldSet = this.ensureHistorySet(prev.category_id);
      oldSet.delete(key);
    }
    this.ensureHistorySet(new_category_id).add(key);


    // existing will be used for requires checks
    const updated: Label = {
      tx_id,
      category_id: new_category_id,
      user_id,
      created_at: new Date()
    };
    this.labelsByTx.set(tx_id.toString(), updated);
    return updated;
  }

    /** Reassign the label for a transaction to the built-in Trash category. */
    remove(user_id: Id, tx_id: Id): void {
      this.update(user_id, tx_id, TRASH_CATEGORY_ID)
}


  /** Queries for demos/tests. */
  getLabel(tx_id: Id): Label | undefined { return this.labelsByTx.get(tx_id.toString()); }
  getTxInfo(tx_id: Id) { return this.txInfoById.get(tx_id.toString()); }
  getCategoryHistory(category_id: Id): string[] {
    return Array.from(this.ensureHistorySet(category_id).values());
  }
  all(): Label[] { return Array.from(this.labelsByTx.values()); }
  
  // more info about the transaction
  async suggest(
    llm: GeminiLLM,
    user_id: Id,
    allCategories: [string, Id][],
    txInfo :TransactionInfo,
  ): Promise<CategoryMeta> 
    {
    console.log('🤖 Requesting labeling suggestions from Gemini AI...');
    if (allCategories.length === 0) {
      throw new Error("No categories available");
    } 
    try {
    
      // Normalize tuples -> CategoryMeta[]
      const categories: CategoryMeta[] = allCategories.map(([name, id]) => ({ name, id }));

      const historyByCategory = this.buildHistorySnapshot(categories);

      const prompt = this.buildSuggestPrompt(user_id, categories, txInfo, historyByCategory);

      const text = await llm.executeLLM(prompt);

      const chosen = this.parseFindSuggestResponse(text, categories);
      console.log('✅ Received response from Gemini AI!\n');

      return chosen;


    } catch (error) {
        console.error('❌ Error calling Gemini API:', (error as Error).message);
        throw error;
    }
  
  }
  private buildHistorySnapshot(categories: CategoryMeta[]): Map<string, TransactionInfo[]> {
    const out = new Map<string, TransactionInfo[]>();
    for (const c of categories) {
      const catKey = c.id.toString();
      const set = this.catHistory.get(catKey);
      if (!set || set.size === 0) {
        out.set(catKey, []);
        continue;
      }
      const infos: TransactionInfo[] = [];
      for (const txKey of set) {
        const info = this.txInfoById.get(txKey);
        if (info) infos.push(info);
      }
      out.set(catKey, infos);
    }
    return out;
  }
  private buildSuggestPrompt(
    userId: Id,
    categories: CategoryMeta[],
    tx: TransactionInfo,
    history: Map<string, TransactionInfo[]>
  ): string {
    const categoriesBlock =
      categories.map(c => `- ${c.id.toString()}: ${c.name}`).join('\n');

    const historyBlock =
      categories.map(c => {
        const catKey = c.id.toString();
        const items = history.get(catKey) ?? [];
        if (items.length === 0) return `• ${c.name} (${c.id.toString()}): (no prior transactions)`;
        const lines = items.map(info => `  - "${info.tx_merchant}" | ${info.tx_name}`);
        return `• ${c.name} (${c.id.toString()}):\n${lines.join('\n')}`;
      }).join('\n');

    return`
You classify ONE bank transaction into exactly ONE of the user's categories.

The data can be noisy. Merchant and name fields may include:
- Processor prefixes/suffixes (e.g., "SQ *", "TST*", "POS", "AUTH", "COMNY", "ONLINE"). 
- Uppercase, punctuation, and partial words.
- Aggregators (DoorDash/Grubhub/UberEats) where the underlying restaurant is implied.

Rules:
1) Choose exactly one category from the list below. Do not invent categories.
2) Prefer matches based on normalized keywords (strip "SQ*", "TST*", "POS", "*", punctuation, repeated whitespace).
3) If a transaction appears in multiple categories historically, prefer the category with the strongest exact/near keyword match in history; break ties by the category with more matching historical examples.
4) If still uncertain, choose the most semantically appropriate category by name (e.g., "Coffee Shops" vs "Restaurants" for coffee chains).
5) Treat delivery aggregators (DoorDash/Grubhub/UberEats) as "Takeout / Delivery" unless the history for a specific restaurant clearly maps elsewhere.
6) If the text suggests transit (MBTA, MTA, LYFT/UBER rides) treat as "Transit".
7) Never output explanations—return only the JSON object.

USER: ${userId.toString()}

CATEGORIES (id: name):
${categoriesBlock}

FULL CATEGORY HISTORY (examples of previously labeled transactions):
${historyBlock || '(none yet)'}

TRANSACTION TO CLASSIFY (noisy, normalize before matching):
{ "id": "${tx.tx_id.toString()}", "merchant": "${tx.tx_merchant}", "name": "${tx.tx_name}" }

Return ONLY this JSON (no extra text):
{
  "suggestedCategoryId": "<one existing category id>",
  "suggestedCategoryName": "<that category's name as listed above>"
}
`.trim();
}

  private parseFindSuggestResponse(text: string, categories: CategoryMeta[]): CategoryMeta {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("No JSON object found in response");
    const json = JSON.parse(m[0]);

    // validate shape
    const id = json?.suggestedCategoryId;
    const name = json?.suggestedCategoryName;

    if (typeof id !== "string" || id.length === 0) {
      throw new Error("Invalid suggestedCategoryId");
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Invalid suggestedCategoryName");
    }

    const invalidVals = ["", "none", "null", "undefined", "n/a", "todo"];
    if (invalidVals.includes(id.toLowerCase()) || invalidVals.includes(name.toLowerCase())) {
      throw new Error(`Invalid placeholder value in response: id="${id}", name="${name}"`);
    }

    const idIsName = categories.some(c => c.name.toLowerCase() === id.toLowerCase());
    if (idIsName) throw new Error(`Response appears to have swapped name/id fields (id='${id}')`);

    // validate id exists
    const byId = categories.find(c => c.id.toString() === id);
    if (!byId) {
      const allowedIds = categories.map(c => c.id.toString());
      throw new Error(
        `No matching category for id "${id}". Expected one of: [${allowedIds.join(", ")}]`
      );
    }

    // validate name matches the id's name
    if (byId.name.toLowerCase() !== name.toLowerCase()) {
      throw new Error(
        `Name/id mismatch: got id="${id}" name="${name}", but canonical name for that id is "${byId.name}".`
      );
    }

    return byId;

  }


}
