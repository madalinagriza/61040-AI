## Prompt Variants

### Version 1: Labeling based on category names
`
You are a helpful assistant that classifies a single bank transaction into ONE of the user's categories.
Analyze the transaction details and based on the category names, recent examples as well as name meanings, 
clasify the single transaction into the most appropriate category.

USER_ID

CATEGORIES (id: name)

TRANSACTION TO CLASSIFY:
{ "id": .. "merchant": .. "name": .. }

Return ONLY a JSON object with this exact shape:\
{
  suggestedCategoryId: <one existing category id>,
}`

#### Notes:
Classified pretty ok based on meanings. In the [many categories testfile](label-many-cats.ts) and the [subtle testfile](label-subtle.ts) I tried to add some non-straightforward scenarios. 
For example, Target has both shower/kitchen supplies and food as well. To inform a better category I added the history of transactions into the prompt. 

### Version 2: Added category history

`
You are a helpful assistant that classifies a single bank transaction into ONE of the user's categories.
Analyze the transaction details and based on the category names, recent examples as well as name meanings, 
clasify the single transaction into the most appropriate category.

USER_ID

CATEGORIES (id: name)

FULL CATEGORY HISTORY (examples of previously labeled transactions):
{historyBlock}

TRANSACTION TO CLASSIFY:
{ "id": .. "merchant": .. "name": .. }

Return ONLY a JSON object with this exact shape:
{
  "suggestedCategoryId": "<one existing category id>",
  "suggestedCategoryName": "<that category's name as listed above>"
}`

#### Notes:
For the Target case specifically referenced in Version 1, now because we've used Target for household items, future transactions suggest Target-related things to be labeled as household and not groceries.  

So far, I have not encountered structural errors from the AI but I'd want to expand the prompt a little since I feel like the description of the task is too vague for my liking. 


### Version 3: Added Structure & Rules Based on Realistic Data

#### Notes:

Real life isn't as clean turns out! I tried to take transactions from a real bank statement, and I noticed there's way less clear information, keywords may be truncated, and overall the AI didn't accurately suggest categories well for the [realistic data](label-realistic.ts). 
I added specific rules and common format troubles AI may have when parsing these transactions, as well as more exact language.

With the significant prompt change, the results did not regress on the simple testcases! Nespresso transaction is now labeled as "misc" but before it was labeled as coffee, and in reality it's in between groceries and coffee.

`
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
`


#### Concluding Notes:
 The AI still has trouble with assignments if the transaction is not descriptive enough, or refers to company names that have not appeared in the transaction history. I'm assuming with a transaction history > 10 transactions per history this can significantly improve since a lot of purchases are recurring/happen more than once. 


## Validations
### Common Failures

1. **Malformed structure** — Response is missing fields or contains multiple JSON objects.  
2. **Nonexistent or swapped identifiers** — The model confuses `suggestedCategoryId` and `suggestedCategoryName`, or returns names instead of IDs.  
3. **Hallucinated categories** — The model invents categories not present in the provided list.  
4. **Placeholder or null-like responses** — Fields contain meaningless tokens such as `"none"`, `"unknown"`, `"null"`, `"N/A"`, or empty strings.  
5. **Inconsistent ID/name mapping** — The `suggestedCategoryName` does not correspond to the canonical name for the returned ID.

---

### Validation Rules

1. **Structural Validation**  
   - Ensure the model’s response contains *exactly one* valid JSON object.  
   - The object must include only these two keys:  
     ```json
     {
       "suggestedCategoryId": "...",
       "suggestedCategoryName": "..."
     }
     ```
   - Both fields must exist and be non-empty strings.

2. **Shape and Type Enforcement**  
   - Validate that both fields are present and of type `string`.  
   - Reject any numeric, boolean, or `null`-typed values.  

3. **Existence Check**  
   - Confirm that the returned `suggestedCategoryId` exists within the known category list.  
   - If no match is found, throw an explicit error enumerating all valid IDs.

4. **Field Consistency**  
   - Verify that the `suggestedCategoryName` matches the name corresponding to the given ID.  
   - If the names diverge, reject the response as inconsistent.

5. **Sanity Filtering**  
   - Disallow placeholder or meaningless values such as:  
     ```
     "none", "unknown", "null", "N/A", "todo"
     ```  
   - Reject responses where `id` and `name` are identical, or where either contains only punctuation or whitespace.
---

### Validation Guarantee

If a response passes all validation layers, the resulting `(id, name)` pair is guaranteed to:

- Be structurally well-formed JSON  
- Reference an existing category from the provided list  
- Maintain internal ID/name consistency  
- Contain no hallucinated, placeholder, or ambiguous data.
