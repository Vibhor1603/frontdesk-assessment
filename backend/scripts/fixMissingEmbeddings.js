import { supabase } from "../src/db/supabase.js";
import { generateEmbedding } from "../src/services/embeddingService.js";

async function fixMissingEmbeddings() {
  console.log("🔧 Fixing missing embeddings in knowledge_base...\n");

  try {
    // Find all entries without embeddings
    const { data: entries, error: fetchError } = await supabase
      .from("knowledge_base")
      .select("id, question, answer")
      .is("embedding", null);

    if (fetchError) throw fetchError;

    if (!entries || entries.length === 0) {
      console.log("✅ No missing embeddings found! All entries are good.");
      return;
    }

    console.log(`Found ${entries.length} entries without embeddings\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      console.log(
        `[${i + 1}/${entries.length}] Processing: "${entry.question.substring(
          0,
          50
        )}..."`
      );

      try {
        // Generate embedding for the question
        const embedding = await generateEmbedding(entry.question);

        // Update the entry
        const { error: updateError } = await supabase
          .from("knowledge_base")
          .update({ embedding })
          .eq("id", entry.id);

        if (updateError) throw updateError;

        console.log(`  ✅ Added embedding`);
        successCount++;

        // Rate limiting - wait 100ms between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ Failed:`, error.message);
        failCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📝 Total: ${entries.length}`);

    if (successCount > 0) {
      console.log(
        `\n✨ Successfully added embeddings to ${successCount} entries!`
      );
    }

    if (failCount > 0) {
      console.log(
        `\n⚠️  ${failCount} entries failed. Check your VOYAGE_API_KEY in .env`
      );
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the fix
console.log("=".repeat(60));
console.log("FIX MISSING EMBEDDINGS");
console.log("=".repeat(60));
console.log();

fixMissingEmbeddings();
