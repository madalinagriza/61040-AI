<concept_spec>

concept Label

purpose 
    record the user's assignment of a specific transaction to a specific category so that spending meaning is explicit and auditable

principle
    label ties exactly one transaction to exactly one category for its owner.  
AI suggests a most likely category to reduce cognitive effort, but the final decision always belongs to the user.  
Creating or changing a label never alters the transaction's imported data and preserves a traceable history of who assigned what and when.


state
    a set of Labels with  
        a tx_id ID  
        a category_id ID  
        an user_id ID  
        a created_at Timestamp

    a set of TransactionInfo with 
        a tx_id ID
        a tx_name String
        a tx_merchant String
    
    a set of CategoryHistory with
        a category_id ID 
        a set of transactions TransactionInfos

actions
    apply(user_id: ID, tx_id: ID, tx_name, tx_merchant, category_id: ID): (label: Label)  
        requires: transaction exists and transaction.owner_id = user_id;  
        category exists and category.owner_id = user_id;  
        no existing label for tx_id in Labels  
        effects: 
        creates a transactionInfo with associated id, name and merchant. 
        adds transactionInfo to the CategoryHistory
        creates a label associating tx_id to category_id with user_id and current timestamp; adds it; returns the label

    update(user_id: ID, tx_id: ID, new_category_id: ID): (label: Label)  
        requires: a label for tx_id exists; transaction.owner_id = user_id;  
            new_category_id exists and has owner_id = user_id  
            transactionInfo exists with transactionInfo.id = tx_id
        effects: 
        updates CategoryHistory, associating transactionInfo with the new_category_id 
        replaces the label's category_id with new_category_id; updates created_at to now; returns updated label

    remove(user_id: ID, tx_id: ID): 
        requires: a label for tx_id exists; transaction.owner_id = user_id  
        effects: reassigns the transaction's label to the user's built-in Trash category_id 
        updates CategoryHistory, associating the transaction with the trash category

    suggest(llm: GeminiLLM, user_id: Id, allCategories: [(ID, String)], transactionInfo): (suggested_category_id: ID)  
        requires: user has >= 1 category  
        effects: returns a best-guess category_id from the user's existing categories for this tx_id which is highlighted in the UI; suggested by AI, does not alter Labels state  


invariants
    at most one label per tx_id
    label.user_id = transaction.owner_id for the labeled transaction
    a label's category.owner_id = label.user_id
    suggestions do not create or modify labels until user explicitly applies or updates  

notes 
    CategoryHistory is a record used for AI suggestions and later, UX. Labels remain the source of truth for what’s currently assigned.
    TransactionInfo carries merchant and name fields since the AI needs them for interpreting.
    TransactionInfo has to be passed in the suggest since by definition we suggest categories for transactions not yet labeled (so there's no connection from transaction id -> transaction info that the Label concept can use)
</concept_spec>