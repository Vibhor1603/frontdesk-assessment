import { supabase } from "../src/core/db/supabase.js";
import { generateEmbedding } from "../src/features/knowledge/services/embeddingService.js";

async function fixMissingEmbeddings() {try {
    // Find all entries without embeddings
    const { data: entries, error: fetchError } = await supabase
      .from("knowledge_base")
      .select("id, question, answer")
      .is("embedding", null);

    if (fetchError) throw fetchError;

    if (!entries || entries.length === 0) {return;
    }let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];}..."`
      );

      try {
        // Generate embedding for the question
        const embedding = await generateEmbedding(entry.question);

        // Update the entry
        const { error: updateError } = await supabase
          .from("knowledge_base")
          .update({ embedding })
          .eq("id", entry.id);

        if (updateError) throw updateError;successCount++;

        // Rate limiting - wait 100ms between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ Failed:`, error.message);
        failCount++;
      }
    }if (successCount > 0) {}

    if (failCount > 0) {}
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the fix););fixMissingEmbeddings();
